from __future__ import annotations

import enum
from datetime import date as date_t, datetime as datetime_t

from sqlalchemy import Boolean, DateTime, Date, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class PostType(str, enum.Enum):
    film = "film"
    digital = "digital"


class Post(Base):
    __tablename__ = "posts"

    # id is the ordinal post number (matches the TG channel message no.) —
    # set manually in admin, not autoincrement, so admins can keep numbering
    # aligned with the Telegram channel even when importing out of order.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[PostType] = mapped_column(
        Enum(PostType, name="post_type"),
        nullable=False,
        default=PostType.film,
        server_default=PostType.film.value,
    )
    date: Mapped[date_t] = mapped_column(Date, nullable=False, index=True)
    time: Mapped[str | None] = mapped_column(String, nullable=True)

    location: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    # Set true when the description has been edited via the admin panel — the
    # scraper must then leave it alone on subsequent syncs.
    description_edited: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )

    camera: Mapped[str | None] = mapped_column(String, nullable=True)
    lens: Mapped[str | None] = mapped_column(String, nullable=True)
    film: Mapped[str | None] = mapped_column(String, nullable=True)

    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    models_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    reactions_json: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="Photo.position",
        lazy="selectin",
    )


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    src: Mapped[str] = mapped_column(Text, nullable=False)
    w: Mapped[int | None] = mapped_column(Integer, nullable=True)
    h: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alt: Mapped[str | None] = mapped_column(String, nullable=True)

    # Original Telegram CDN URL — kept so we can re-fetch if the local file is lost.
    # Null for seed/dev photos that were never downloaded.
    tg_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    post: Mapped[Post] = relationship(back_populates="photos")


class ChannelMeta(Base):
    """Singleton row (id=1) with the public channel snapshot.

    Updated in-place by the scraper on every sync — we don't keep history,
    so subscriber counts etc. are point-in-time as of `last_scraped_at`.
    """

    __tablename__ = "channel_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)

    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscribers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photos_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    videos_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    files_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    links_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    last_scraped_at: Mapped[datetime_t | None] = mapped_column(DateTime, nullable=True)
