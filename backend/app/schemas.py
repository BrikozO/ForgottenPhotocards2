from __future__ import annotations

from datetime import date as date_t, datetime as datetime_t

from pydantic import BaseModel, ConfigDict

from backend.app.models import PostType


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    src: str
    w: int | None = None
    h: int | None = None
    alt: str | None = None


class PostOut(BaseModel):
    """Response shape consumed by the SPA (frontend/src/api.js).

    Optional metadata (camera/lens/film/location/models/time/reactions) can be
    null — the frontend already guards on these. `type` is always present
    (defaults to film) and `description` is always present (defaults to "").
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    type: PostType
    date: date_t
    time: str | None = None

    location: str | None = None
    description: str = ""

    camera: str | None = None
    lens: str | None = None
    film: str | None = None

    views: int = 0

    models: list[str] | None = None
    reactions: dict[str, int] | None = None

    photos: list[PhotoOut]

    @classmethod
    def from_orm_post(cls, post) -> "PostOut":
        return cls(
            id=post.id,
            title=post.title,
            type=post.type,
            date=post.date,
            time=post.time,
            location=post.location,
            description=post.description or "",
            camera=post.camera,
            lens=post.lens,
            film=post.film,
            views=post.views,
            models=post.models_json,
            reactions=post.reactions_json,
            photos=[PhotoOut.model_validate(ph) for ph in post.photos],
        )


class ChannelMetaOut(BaseModel):
    """Public snapshot of the Telegram channel header (see ChannelMeta model)."""

    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    description: str | None = None
    subscribers: int | None = None
    photos_count: int | None = None
    videos_count: int | None = None
    files_count: int | None = None
    links_count: int | None = None
    last_scraped_at: datetime_t | None = None


class AuthorOut(BaseModel):
    """Author bio served at GET /api/about. Sourced from backend/app/author.json;
    not yet stored in DB — see main.py:get_author."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    bio: list[str] = []
    base: str | None = None
    shooting_since: str | None = None
    channel_since: str | None = None
    cameras: str | None = None
    email: str | None = None
    telegram: str | None = None
