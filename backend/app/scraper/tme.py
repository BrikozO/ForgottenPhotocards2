"""HTTP client + parser for https://t.me/s/<channel>.

Telegram's public preview ("/s/") pages are server-rendered HTML and parse
cleanly without auth. One page shows ~20 newest message cards; older ones are
fetched via ?before=<msg_id>. Albums (multi-photo posts) appear as one card
with multiple .tgme_widget_message_photo_wrap nodes.

Channel-specific caption convention (Forgotten Photocards):

    Place name                                ← becomes title + location
    [blank line]
    [Models: NameA, NameB]                    ← optional, comma-separated
    [blank line]
    Ph:   #Camera_Tag                         ← becomes camera
    Lens: #Lens_Tag                           ← becomes lens
    Film: #Film_Tag                           ← becomes film

Any free text outside the first line and the meta block becomes description.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date as date_t, datetime as datetime_t

import httpx
from selectolax.parser import HTMLParser

logger = logging.getLogger(__name__)

BASE_URL = "https://t.me/s/{channel}"

# Conservative defaults — Telegram is fine with browser-shaped requests.
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Lines like "Ph: #Foo_Bar" — case-insensitive, optional spaces.
_META_LINE = re.compile(r"^\s*(Ph|Lens|Film|Models|Cam)\s*:\s*(.+?)\s*$", re.IGNORECASE)
_KEY_TO_FIELD = {"ph": "camera", "cam": "camera", "lens": "lens", "film": "film"}

# Telegram CDN URLs inside `background-image:url('...')`.
_BG_URL = re.compile(r"background-image\s*:\s*url\(\s*['\"]?([^'\")]+)['\"]?\s*\)")


@dataclass
class ScrapedPhoto:
    tg_url: str
    position: int


@dataclass
class ScrapedPost:
    id: int
    title: str
    description: str
    date: date_t
    time: str | None
    location: str | None
    camera: str | None
    lens: str | None
    film: str | None
    views: int
    models: list[str] | None
    reactions: dict[str, int] | None
    photos: list[ScrapedPhoto]


@dataclass
class ScrapedChannel:
    title: str | None = None
    description: str | None = None
    subscribers: int | None = None
    photos_count: int | None = None
    videos_count: int | None = None
    files_count: int | None = None
    links_count: int | None = None
    posts: list[ScrapedPost] = field(default_factory=list)
    # Oldest post id on this page — useful to drive ?before= pagination.
    oldest_post_id: int | None = None


# ─── HTTP ────────────────────────────────────────────────────────

async def fetch_page(
    client: httpx.AsyncClient,
    channel: str,
    before: int | None = None,
) -> str:
    url = BASE_URL.format(channel=channel)
    params = {"before": before} if before else None
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    return resp.text


def make_client(user_agent: str = DEFAULT_USER_AGENT) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": user_agent, "Accept-Language": "en,ru;q=0.8"},
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
        http2=True,
    )


# ─── Parsing: channel header ─────────────────────────────────────

def _parse_int(s: str | None) -> int | None:
    if not s:
        return None
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else None


def parse_channel(html: str) -> ScrapedChannel:
    tree = HTMLParser(html)
    ch = ScrapedChannel()

    title_node = tree.css_first(".tgme_channel_info_header_title, .tgme_page_title")
    if title_node:
        ch.title = title_node.text(strip=True) or None

    desc_node = tree.css_first(".tgme_channel_info_description, .tgme_page_description")
    if desc_node:
        ch.description = desc_node.text(strip=True) or None

    # Counters: <div class="tgme_channel_info_counter"><span class="counter_value">N</span><span class="counter_type">subscribers</span></div>
    for counter in tree.css(".tgme_channel_info_counter"):
        value_node = counter.css_first(".counter_value")
        type_node = counter.css_first(".counter_type")
        if not (value_node and type_node):
            continue
        kind = type_node.text(strip=True).lower()
        value = _parse_int(value_node.text(strip=True))
        if value is None:
            continue
        if "subscriber" in kind or "подпис" in kind:
            ch.subscribers = value
        elif "photo" in kind or "фото" in kind:
            ch.photos_count = value
        elif "video" in kind or "видео" in kind:
            ch.videos_count = value
        elif "file" in kind or "файл" in kind:
            ch.files_count = value
        elif "link" in kind or "ссыл" in kind:
            ch.links_count = value

    ch.posts = list(_parse_posts(tree))
    if ch.posts:
        ch.oldest_post_id = min(p.id for p in ch.posts)
    return ch


# ─── Parsing: posts ──────────────────────────────────────────────

def _post_id_from_link(href: str | None) -> int | None:
    # Expected form: "/forgottenphotocards/342" or "https://t.me/.../342"
    if not href:
        return None
    m = re.search(r"/(\d+)(?:[/?#]|$)", href)
    return int(m.group(1)) if m else None


_BREAK_TAGS = re.compile(r"</?(?:br|p|div)\s*/?>", re.IGNORECASE)


def _extract_text_preserving_breaks(node) -> str:
    """Pull text out of a caption node, treating block tags as line breaks."""
    if node is None:
        return ""
    raw_html = node.html or ""
    # Replace every <br>/<p>/<div> boundary with a newline, then strip the
    # remaining tags via a second parse. Works regardless of how the caption
    # is nested (some posts wrap text in extra <span>/<a>).
    with_breaks = _BREAK_TAGS.sub("\n", raw_html)
    text = HTMLParser(with_breaks).text(separator="")
    # Normalize NBSP and trailing whitespace per line.
    text = text.replace(" ", " ")
    return "\n".join(line.rstrip() for line in text.split("\n")).strip()


def _split_caption(text: str) -> tuple[str, str, dict[str, str | list[str]]]:
    """Return (first_line, description, meta_dict).

    meta_dict keys: camera, lens, film, models (list).
    description is what's left after dropping first line + meta lines, trimmed.
    """
    if not text:
        return "", "", {}

    lines = text.split("\n")
    first_idx = next((i for i, ln in enumerate(lines) if ln.strip()), None)
    if first_idx is None:
        return "", "", {}

    first_line = lines[first_idx].strip()
    rest_lines = lines[first_idx + 1:]

    meta: dict[str, str | list[str]] = {}
    leftover: list[str] = []
    for line in rest_lines:
        m = _META_LINE.match(line)
        if not m:
            leftover.append(line)
            continue
        key = m.group(1).lower()
        value = m.group(2).strip()
        if key == "models":
            meta["models"] = [s.strip() for s in value.split(",") if s.strip()]
        else:
            field_name = _KEY_TO_FIELD.get(key)
            if field_name:
                meta[field_name] = _hashtag_to_value(value)

    description = "\n".join(leftover).strip()
    return first_line, description, meta


def _hashtag_to_value(raw: str) -> str:
    """`#Canon_EOS_650D` → `Canon EOS 650D`. If multiple hashtags, take first."""
    raw = raw.split()[0] if raw else raw
    raw = raw.lstrip("#")
    return raw.replace("_", " ").strip()


def _parse_views(node_text: str) -> int:
    """'1.2K' → 1200, '342' → 342. Best-effort."""
    s = node_text.strip().upper().replace(" ", "")
    if not s:
        return 0
    mult = 1
    if s.endswith("K"):
        mult, s = 1000, s[:-1]
    elif s.endswith("M"):
        mult, s = 1_000_000, s[:-1]
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


def _parse_reactions(card) -> dict[str, int] | None:
    # Telegram markup: <span class="tgme_reaction"><i class="emoji"><b>EMOJI</b></i>COUNT</span>
    # Counter is a bare text node trailing the <i>, not a child element.
    out: dict[str, int] = {}
    for r in card.css(".tgme_reaction"):
        emoji_node = r.css_first(".emoji b, .emoji")
        if emoji_node is None:
            continue
        emoji = emoji_node.text(strip=True)
        if not emoji:
            continue
        # Strip the emoji from the span's full text to isolate the counter.
        count = _parse_views(r.text(strip=True).replace(emoji, "", 1))
        if count:
            out[emoji] = count
    return out or None


def _parse_posts(tree: HTMLParser):
    # `.tgme_widget_message_wrap` is the outer per-post container; the inner
    # `.tgme_widget_message` carries data-post and the actual content. We iterate
    # only wraps — combining both classes in one selector yielded each post
    # twice (one row from the wrap, one from the inner).
    for wrap in tree.css(".tgme_widget_message_wrap"):
        msg = wrap.css_first(".tgme_widget_message")
        if msg is None:
            continue

        data_post = msg.attributes.get("data-post") if hasattr(msg, "attributes") else None
        post_id = _post_id_from_link(data_post) if data_post else None
        if post_id is None:
            link = msg.css_first("a.tgme_widget_message_date")
            post_id = _post_id_from_link(link.attributes.get("href") if link else None)
        if post_id is None:
            continue

        # Date + time. Must select on the `datetime` attribute — posts with
        # videos also carry a <time class="message_video_duration"> with no
        # `datetime`, and grabbing it would silently fall back to today.
        time_node = msg.css_first("time[datetime]")
        dt_attr = time_node.attributes.get("datetime") if time_node else None
        post_date: date_t | None = None
        post_time: str | None = None
        if dt_attr:
            try:
                dt = datetime_t.fromisoformat(dt_attr.replace("Z", "+00:00"))
                post_date = dt.date()
                post_time = dt.strftime("%H:%M")
            except ValueError:
                logger.debug("bad datetime on post %s: %r", post_id, dt_attr)

        # Caption
        text_node = msg.css_first(".tgme_widget_message_text")
        caption = _extract_text_preserving_breaks(text_node)
        title, description, meta = _split_caption(caption)

        # Photos: every photo (single or album member) carries the class
        # .tgme_widget_message_photo_wrap with a background-image: url(...).
        # Album-only selectors like _grouped_wrap > a doubled the count because
        # those <a> elements *are* photo_wraps too.
        photos: list[ScrapedPhoto] = []
        for i, wrap in enumerate(msg.css(".tgme_widget_message_photo_wrap")):
            style = wrap.attributes.get("style") if hasattr(wrap, "attributes") else None
            if not style:
                continue
            m = _BG_URL.search(style)
            if not m:
                continue
            photos.append(ScrapedPhoto(tg_url=m.group(1), position=i))
        if not photos:
            # Posts with no photos (text-only / video / file) are out of scope
            # for this scraper — frontend assumes at least one photo per post.
            continue

        views_node = msg.css_first(".tgme_widget_message_views")
        views = _parse_views(views_node.text()) if views_node else 0

        yield ScrapedPost(
            id=post_id,
            title=title or f"№{post_id}",
            description=description,
            date=post_date or datetime_t.now().date(),
            time=post_time,
            location=title or None,
            camera=meta.get("camera"),  # type: ignore[arg-type]
            lens=meta.get("lens"),  # type: ignore[arg-type]
            film=meta.get("film"),  # type: ignore[arg-type]
            views=views,
            models=meta.get("models") if isinstance(meta.get("models"), list) else None,
            reactions=_parse_reactions(msg),
            photos=photos,
        )
