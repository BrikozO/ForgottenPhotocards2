from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.app.models import Base


def _default_db_url() -> str:
    db_path = Path(__file__).resolve().parent.parent / "data" / "fpc.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{db_path}"


DATABASE_URL = os.getenv("FPC_DATABASE_URL", _default_db_url())

engine: AsyncEngine = create_async_engine(DATABASE_URL, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


# SQLite columns we may need to add to a pre-existing DB. create_all() only
# creates missing *tables*, not missing *columns*, so we apply this by hand.
# Keep entries idempotent (PRAGMA-check, then ALTER if absent).
_PENDING_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("photos", "tg_url", "TEXT"),
)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for table, column, coltype in _PENDING_COLUMNS:
            cols = await conn.execute(text(f"PRAGMA table_info({table})"))
            existing = {row[1] for row in cols}
            if column not in existing:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
