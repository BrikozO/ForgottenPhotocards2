from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import Photo, Post, PostType

SEED_FILE = Path(__file__).resolve().parent / "seed_posts.json"


async def seed_if_empty(session: AsyncSession) -> int:
    """Populate the DB from seed_posts.json on a fresh install. Returns the
    number of posts inserted (0 if the table already had rows)."""
    existing = await session.scalar(select(Post.id).limit(1))
    if existing is not None:
        return 0

    if not SEED_FILE.exists():
        return 0

    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    for entry in raw:
        post = Post(
            id=entry["id"],
            title=entry["title"],
            type=PostType(entry.get("type", "film")),
            date=date.fromisoformat(entry["date"]),
            time=entry.get("time"),
            location=entry.get("location"),
            description=entry.get("description") or "",
            camera=entry.get("camera"),
            lens=entry.get("lens"),
            film=entry.get("film"),
            views=entry.get("views", 0),
            models_json=entry.get("models"),
            reactions_json=entry.get("reactions"),
        )
        for i, ph in enumerate(entry.get("photos", [])):
            post.photos.append(
                Photo(
                    position=i,
                    src=ph["src"],
                    w=ph.get("w"),
                    h=ph.get("h"),
                    alt=ph.get("alt"),
                )
            )
        session.add(post)

    await session.commit()
    return len(raw)
