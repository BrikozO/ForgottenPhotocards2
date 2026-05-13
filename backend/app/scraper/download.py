"""Async image downloader for scraped Telegram posts.

Saves files under MEDIA_ROOT/photos/<post_id>/<position>.<ext>. Idempotent:
if the target file already exists, skip the network round-trip.

Returns the public URL path the frontend should use (e.g. /media/photos/342/0.jpg);
nginx serves that path directly from the shared volume.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# /srv/backend/data/media in containers, ./backend/data/media on a host venv.
MEDIA_ROOT = Path(
    os.getenv(
        "FPC_MEDIA_ROOT",
        str(Path(__file__).resolve().parent.parent.parent / "data" / "media"),
    )
)
MEDIA_URL_PREFIX = "/media"

# Telegram CDN serves JPEG by default; tolerate webp/png just in case.
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _ext_from_url(url: str) -> str:
    path = urlparse(url).path
    ext = Path(path).suffix.lower()
    return ext if ext in _ALLOWED_EXT else ".jpg"


def local_path(post_id: int, position: int, tg_url: str) -> Path:
    return MEDIA_ROOT / "photos" / str(post_id) / f"{position}{_ext_from_url(tg_url)}"


def public_url(post_id: int, position: int, tg_url: str) -> str:
    return f"{MEDIA_URL_PREFIX}/photos/{post_id}/{position}{_ext_from_url(tg_url)}"


async def download_one(
    client: httpx.AsyncClient,
    tg_url: str,
    target: Path,
) -> bool:
    """Download a single image. Returns True if a fresh fetch happened, False if cached."""
    if target.exists() and target.stat().st_size > 0:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    # Stream to a tmp path then rename, so a crash mid-download doesn't leave
    # a half-written file that future runs will treat as cached.
    tmp = target.with_suffix(target.suffix + ".part")
    try:
        async with client.stream("GET", tg_url) as resp:
            resp.raise_for_status()
            with tmp.open("wb") as fh:
                async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                    fh.write(chunk)
        tmp.replace(target)
        return True
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


async def download_photos(
    client: httpx.AsyncClient,
    post_id: int,
    photos: list[tuple[int, str]],  # [(position, tg_url), ...]
    concurrency: int = 4,
) -> list[tuple[int, str, str]]:
    """Download every photo for a post. Returns [(position, local_src, tg_url), ...]."""
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[int, str, str]] = []

    async def _one(position: int, tg_url: str):
        target = local_path(post_id, position, tg_url)
        async with sem:
            try:
                fetched = await download_one(client, tg_url, target)
            except Exception as e:  # noqa: BLE001
                logger.warning("photo download failed: post=%s pos=%s url=%s err=%s",
                               post_id, position, tg_url, e)
                return
        if fetched:
            logger.debug("photo saved: %s", target)
        results.append((position, public_url(post_id, position, tg_url), tg_url))

    await asyncio.gather(*(_one(p, u) for p, u in photos))
    results.sort(key=lambda r: r[0])
    return results
