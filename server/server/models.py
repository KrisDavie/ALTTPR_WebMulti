import datetime
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    BigInteger,
    String,
    ARRAY,
    Enum,
    JSON,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.schema import UniqueConstraint
import uuid
import enum

from .database import Base
from typing import List, Optional


class EventTypes(enum.Enum):
    session_create = 1
    player_join = 2
    failed_join = 3
    player_leave = 4
    chat = 5
    command = 6
    new_item = 7
    player_forfeit = 8
    player_pause_receive = 9
    player_resume_receive = 10
    user_join_chat = 11
    player_kicked = 12


base_flags = {
    "chat": True,
    "pauseRecieving": True,
    "missingCmd": True,
    "duping": True,
    "forfeit": True,
}


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id")
    )
    player_id: Mapped[int] = mapped_column(Integer, index=True, nullable=True)
    content: Mapped[str] = mapped_column(String)
    session: Mapped["MWSession"] = relationship("MWSession", back_populates="logs")


class User(Base):
    __tablename__ = "users"

    # Base required fields
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_tokens: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    bot: Mapped[bool] = mapped_column(Boolean, default=False)
    username_as_player_name: Mapped[bool] = mapped_column(Boolean, default=False)

    # Discord fields
    discord_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    discord_username: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )
    discord_display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True, unique=True
    )
    avatar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(
        String, unique=True, index=True, nullable=True
    )
    refresh_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Custom fields
    supporter: Mapped[bool] = mapped_column(Boolean, default=False)
    colour: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    sessions: Mapped[List["UserSessions"]] = relationship(back_populates="user")

    owned_sessions: Mapped[List["MWSession"]] = relationship(
        secondary="owned_sessions", back_populates="owners"
    )
    events: Mapped[List["Event"]] = relationship("Event", back_populates="user")
    sramstores: Mapped[List["SRAMStore"]] = relationship(
        "SRAMStore", back_populates="user"
    )
    parent_account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    child_accounts: Mapped[List["User"]] = relationship(
        "User", back_populates="parent_account", foreign_keys=[parent_account_id]
    )
    parent_account: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="child_accounts",
        foreign_keys=[parent_account_id],
        remote_side=[id],
    )

    bot_owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    bot_owner: Mapped[Optional["User"]] = relationship(
        "User", back_populates="bots", foreign_keys=[bot_owner_id], remote_side=[id]
    )
    bots: Mapped[List["User"]] = relationship(
        "User", back_populates="bot_owner", foreign_keys=[bot_owner_id]
    )
    api_keys: Mapped[List["APIKey"]] = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    last_used: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )

    user: Mapped["User"] = relationship("User", back_populates="api_keys")


class MWSession(Base):
    __tablename__ = "mwsessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    game_id: Mapped[int] = mapped_column(Integer, ForeignKey("games.id"))
    session_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    tournament: Mapped[bool] = mapped_column(Boolean, default=False)
    owners: Mapped[List["User"]] = relationship(
        secondary="owned_sessions", back_populates="owned_sessions"
    )

    # Array of discord user ids
    allowed_users: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True
    )
    flags: Mapped[dict] = mapped_column(JSON, default=base_flags)
    mwdata: Mapped[dict] = mapped_column(JSON)

    game: Mapped["Game"] = relationship("Game", back_populates="mwsessions")
    logs: Mapped[List["Log"]] = relationship("Log", back_populates="session")
    events: Mapped[List["Event"]] = relationship("Event", back_populates="session")
    sramstores: Mapped[List["SRAMStore"]] = relationship(
        "SRAMStore", back_populates="session"
    )
    users: Mapped[List["UserSessions"]] = relationship(back_populates="session")


class UserSessions(Base):
    __tablename__ = "user_sessions"
    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("mwsessions.id"))

    player_id: Mapped[int] = mapped_column(Integer)

    user: Mapped["User"] = relationship(back_populates="sessions")
    session: Mapped["MWSession"] = relationship(back_populates="users")


class OwnedSessions(Base):
    __tablename__ = "owned_sessions"
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id"), primary_key=True
    )


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    mwsessions: Mapped[List["MWSession"]] = relationship(
        "MWSession", back_populates="game"
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id")
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    from_player: Mapped[int] = mapped_column(Integer, index=True)
    to_player: Mapped[int] = mapped_column(Integer, index=True)
    to_player_idx: Mapped[Optional[int]] = mapped_column(
        Integer, index=True, nullable=True
    )
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    location: Mapped[int] = mapped_column(Integer, index=True)
    event_type: Mapped[EventTypes] = mapped_column(Enum(EventTypes), index=True)
    frame_time: Mapped[Optional[int]] = mapped_column(BigInteger, index=True, nullable=True)
    event_data: Mapped[dict] = mapped_column(JSON)

    session: Mapped["MWSession"] = relationship("MWSession", back_populates="events")
    user: Mapped["User"] = relationship("User", back_populates="events")
    __table_args__ = (
        UniqueConstraint(
            "session_id", "to_player", "to_player_idx", name="player_receive_index"
        ),
    )


class SRAMStore(Base):
    __tablename__ = "sramstores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id")
    )
    player: Mapped[int] = mapped_column(Integer, index=True)
    sram: Mapped[dict] = mapped_column(JSON())
    prev_sram: Mapped[Optional[dict]] = mapped_column(JSON(), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    session: Mapped["MWSession"] = relationship(
        "MWSession", back_populates="sramstores"
    )
    user: Mapped["User"] = relationship("User", back_populates="sramstores")
