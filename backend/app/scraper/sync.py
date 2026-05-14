"""Orchestrator: pull channel meta + posts, upsert into the DB, download photos.

`sync_channel(full=False)` does a single page (newest posts) — cheap, runs daily
to pick up new posts, edits, and updated view/reaction counts.

`sync_channel(full=True)` walks back via ?before= until no more posts are returned.
Used for the initial backfill on an empty DB.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import SessionLocal
from backend.app.models import ChannelMeta, Photo, Post, PostType
from backend.app.scraper.download import download_photos
from backend.app.scraper.tme import ScrapedPost, fetch_page, make_client, parse_channel

logger = logging.getLogger(__name__)

CHANNEL = os.getenv("FPC_TG_CHANNEL", "forgottenphotocards")
USER_AGENT = os.getenv("FPC_SCRAPER_USER_AGENT", "").strip()

# Pagination safety: bail out after this many pages even if the channel claims
# more. 200 pages × ~20 posts ≈ 4000 posts — plenty for our case.
_MAX_PAGES = 200
# Polite delay between pagination requests.
_PAGE_DELAY_SEC = 0.7


async def _upsert_channel_meta(session: AsyncSession, scraped) -> None:
    row = await session.get(ChannelMeta, 1)
    if row is None:
        row = ChannelMeta(id=1)
        session.add(row)
    row.title = scraped.title
    row.description = scraped.description
    row.subscribers = scraped.subscribers
    row.photos_count = scraped.photos_count
    row.videos_count = scraped.videos_count
    row.files_count = scraped.files_count
    row.links_count = scraped.links_count
    row.last_scraped_at = datetime.now(timezone.utc).replace(tzinfo=None)


async def _upsert_post(
    session: AsyncSession,
    sp: ScrapedPost,
    photo_rows: list[tuple[int, str, str]],
) -> str:
    """Insert or update a post + its photos. Returns 'inserted' | 'updated' | 'unchanged'."""
    existing = await session.get(Post, sp.id)
    if existing is None:
        post = Post(
            id=sp.id,
            title=sp.title,
            type=PostType.film,  # Channel doesn't expose digital/film — default film.
            date=sp.date,
            time=sp.time,
            location=sp.location,
            description=sp.description or "",
            camera=sp.camera,
            lens=sp.lens,
            film=sp.film,
            views=sp.views,
            models_json=sp.models,
            reactions_json=sp.reactions,
        )
        for position, src, tg_url in photo_rows:
            post.photos.append(Photo(position=position, src=src, tg_url=tg_url))
        session.add(post)
        return "inserted"

    # Update mutable fields. Captions can be edited; views/reactions drift.
    # If the description was edited via the admin panel, leave it alone — the
    # admin's version is the source of truth from that point on.
    updates: list[tuple[str, object]] = [
        ("title", sp.title),
        ("date", sp.date),
        ("time", sp.time),
        ("location", sp.location),
        ("camera", sp.camera),
        ("lens", sp.lens),
        ("film", sp.film),
        ("views", sp.views),
        ("models_json", sp.models),
        ("reactions_json", sp.reactions),
    ]
    if not existing.description_edited:
        updates.append(("description", sp.description or ""))

    changed = False
    for field, value in updates:
        if getattr(existing, field) != value:
            setattr(existing, field, value)
            changed = True

    # Replace photo rows if the set of source URLs changed (rare — only on edits
    # that swap or reorder photos). Keeps the relation simple instead of diffing.
    existing_tg = [p.tg_url for p in existing.photos]
    incoming_tg = [tg for _, _, tg in photo_rows]
    if existing_tg != incoming_tg:
        await session.execute(delete(Photo).where(Photo.post_id == existing.id))
        for position, src, tg_url in photo_rows:
            session.add(Photo(post_id=existing.id, position=position, src=src, tg_url=tg_url))
        changed = True

    return "updated" if changed else "unchanged"


async def _process_post(session: AsyncSession, client, sp: ScrapedPost) -> str:
    photo_rows = await download_photos(
        client,
        sp.id,
        [(ph.position, ph.tg_url) for ph in sp.photos],
    )
    if not photo_rows:
        logger.warning("post %s skipped: no photos could be downloaded", sp.id)
        return "skipped"
    return await _upsert_post(session, sp, photo_rows)


async def sync_channel(full: bool = False) -> dict[str, int]:
    """Pull the channel and persist new/updated posts.

    Returns a tally dict: {inserted, updated, unchanged, skipped, pages}.
    """
    tally = {"inserted": 0, "updated": 0, "unchanged": 0, "skipped": 0, "pages": 0}
    seen_ids: set[int] = set()

    ua_kwargs = {"user_agent": USER_AGENT} if USER_AGENT else {}
    async with make_client(**ua_kwargs) as client:
        async with SessionLocal() as session:
            before: int | None = None
            for _page in range(_MAX_PAGES):
                html = await fetch_page(client, CHANNEL, before=before)
                scraped = parse_channel(html)
                tally["pages"] += 1

                if tally["pages"] == 1:
                    await _upsert_channel_meta(session, scraped)

                if not scraped.posts:
                    break

                new_oldest = scraped.oldest_post_id
                # Telegram pagination repeats the boundary post — drop dupes.
                fresh = [p for p in scraped.posts if p.id not in seen_ids]
                if not fresh:
                    break
                seen_ids.update(p.id for p in fresh)

                for sp in fresh:
                    outcome = await _process_post(session, client, sp)
                    tally[outcome] = tally.get(outcome, 0) + 1

                await session.commit()

                if not full:
                    break
                if new_oldest is None or (before is not None and new_oldest >= before):
                    # No progress — break to avoid an infinite loop.
                    break
                before = new_oldest
                await asyncio.sleep(_PAGE_DELAY_SEC)

    logger.info(
        "sync_channel(full=%s) done: %s",
        full,
        " ".join(f"{k}={v}" for k, v in tally.items()),
    )
    return tally
