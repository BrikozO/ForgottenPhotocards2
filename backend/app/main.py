from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

# Wire up logging before any logger is created. uvicorn only configures its
# own loggers; without this our `app.*` and `apscheduler` INFO lines vanish.
# `force=True` lets us override anything imported modules may have set.
logging.basicConfig(
    level=os.getenv("FPC_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    stream=sys.stdout,
    force=True,
)
logging.getLogger("apscheduler").setLevel(logging.INFO)

from backend.app.db import SessionLocal, init_db  # noqa: E402
from backend.app.models import ChannelMeta, Post  # noqa: E402
from backend.app.schemas import AuthorOut, ChannelMetaOut, PostOut  # noqa: E402
from backend.app.scraper import sync_channel  # noqa: E402

# Sibling to seed_posts.json — kept inside the package so docker-compose's
# backend_data volume (mounted at /srv/backend/data) doesn't mask it.
AUTHOR_FILE = Path(__file__).resolve().parent / "author.json"


@lru_cache(maxsize=1)
def _load_author() -> AuthorOut:
    raw = json.loads(AUTHOR_FILE.read_text(encoding="utf-8"))
    return AuthorOut.model_validate(raw)

logger = logging.getLogger(__name__)

# Cron expression for the daily resync. Defaults to 03:00 UTC.
# Format: "minute hour day month dow" (standard 5-field cron).
SYNC_CRON = os.getenv("FPC_SYNC_CRON", "0 3 * * *")


def _build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        sync_channel,
        trigger=CronTrigger.from_crontab(SYNC_CRON, timezone="UTC"),
        kwargs={"full": False},
        id="daily_channel_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    return scheduler


async def _kickoff_backfill_if_empty() -> None:
    """Background task: if the Post table is empty, do a full scrape.

    Runs fire-and-forget so app startup isn't blocked by a multi-page crawl.
    """
    try:
        async with SessionLocal() as session:
            count = await session.scalar(select(func.count(Post.id)))
        if count and count > 0:
            logger.info("backfill skipped: %d posts already in DB", count)
            return
        logger.info("post table empty → starting initial full backfill")
        tally = await sync_channel(full=True)
        logger.info("initial backfill finished: %s", tally)
    except Exception:  # noqa: BLE001
        logger.exception("initial backfill failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("backend starting (channel=%s, sync_cron=%r)",
                os.getenv("FPC_TG_CHANNEL", "forgottenphotocards"), SYNC_CRON)
    await init_db()
    scheduler = _build_scheduler()
    scheduler.start()
    logger.info("scheduler started; daily job 'daily_channel_sync' registered")
    backfill_task = asyncio.create_task(_kickoff_backfill_if_empty())
    app.state.scheduler = scheduler
    app.state.backfill_task = backfill_task
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        backfill_task.cancel()


app = FastAPI(title="Forgotten Photocards API", version="0.1.0", lifespan=lifespan)

cors_env = os.getenv("FPC_CORS_ORIGINS", "").strip()
if cors_env:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_env.split(",") if o.strip()],
        allow_methods=["GET"],
        allow_headers=["*"],
    )


async def get_session():
    async with SessionLocal() as session:
        yield session


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/channel", response_model=ChannelMetaOut)
async def get_channel(session: AsyncSession = Depends(get_session)) -> ChannelMetaOut:
    row = await session.get(ChannelMeta, 1)
    if row is None:
        return ChannelMetaOut()
    return ChannelMetaOut.model_validate(row)


@app.get("/api/about", response_model=AuthorOut)
async def get_author() -> AuthorOut:
    return _load_author()


@app.get("/api/posts", response_model=list[PostOut])
async def list_posts(session: AsyncSession = Depends(get_session)) -> list[PostOut]:
    result = await session.scalars(select(Post).order_by(Post.date.desc(), Post.id.desc()))
    return [PostOut.from_orm_post(p) for p in result.all()]


@app.get("/api/posts/{post_id}", response_model=PostOut)
async def get_post(post_id: int, session: AsyncSession = Depends(get_session)) -> PostOut:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    return PostOut.from_orm_post(post)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
