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
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.schema import UniqueConstraint
import uuid
import enum

from .database import Base


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


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id = Column(UUID(as_uuid=True), ForeignKey("mwsessions.id"))
    player_id = Column(Integer, index=True, nullable=True)
    content = Column(String)
    session = relationship("MWSession", back_populates="logs")


class User(Base):
    __tablename__ = "users"

    # Base required fields
    id = Column(Integer, primary_key=True, index=True)
    session_tokens = Column(ARRAY(String), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    is_superuser = Column(Boolean, default=False)
    bot = Column(Boolean, default=False)
    username_as_player_name = Column(Boolean, default=False)

    # Discord fields
    discord_id = Column(String, index=True, nullable=True)
    discord_username = Column(String, index=True, nullable=True)
    discord_display_name = Column(String, nullable=True)
    username = Column(String, index=True, nullable=True, unique=True)
    avatar = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    refresh_token = Column(String, nullable=True)

    # Custom fields
    supporter = Column(Boolean, default=False)
    colour = Column(String, nullable=True)

    sessions = relationship(
        "MWSession", secondary="user_sessions", back_populates="users"
    )
    owned_sessions = relationship(
        "MWSession", secondary="owned_sessions", back_populates="owners"
    )
    events = relationship("Event", back_populates="user")
    sramstores = relationship("SRAMStore", back_populates="user")
    parent_account_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    child_accounts = relationship(
        "User", back_populates="parent_account", foreign_keys=[parent_account_id]
    )
    parent_account = relationship(
        "User",
        back_populates="child_accounts",
        foreign_keys=[parent_account_id],
        remote_side=[id],
    )

    bot_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bot_owner = relationship(
        "User", back_populates="bots", foreign_keys=[bot_owner_id], remote_side=[id]
    )
    bots = relationship("User", back_populates="bot_owner", foreign_keys=[bot_owner_id])
    api_keys = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    description = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    last_used = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )

    user = relationship("User", back_populates="api_keys")


class MWSession(Base):
    __tablename__ = "mwsessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    game_id = Column(Integer, ForeignKey("games.id"))
    session_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    tournament = Column(Boolean, default=False)
    owners = relationship(
        "User", secondary="owned_sessions", back_populates="owned_sessions"
    )

    mwdata = Column(JSON)

    game = relationship("Game", back_populates="mwsessions")
    logs = relationship("Log", back_populates="session")
    events = relationship("Event", back_populates="session")
    sramstores = relationship("SRAMStore", back_populates="session")
    users = relationship("User", secondary="user_sessions", back_populates="sessions")


class UserSessions(Base):
    __tablename__ = "user_sessions"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id"), primary_key=True
    )
    player_id = Column(Integer, nullable=True)


class OwnedSessions(Base):
    __tablename__ = "owned_sessions"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("mwsessions.id"), primary_key=True
    )


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)

    mwsessions = relationship("MWSession", back_populates="game")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id = Column(UUID(as_uuid=True), ForeignKey("mwsessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    from_player = Column(Integer, index=True)
    to_player = Column(Integer, index=True)
    to_player_idx = Column(Integer, index=True, nullable=True)
    item_id = Column(Integer, index=True)
    location = Column(Integer, index=True)
    event_type = Column(Enum(EventTypes), index=True)
    frame_time = Column(BigInteger, index=True, nullable=True)
    event_data = Column(JSON)

    session = relationship("MWSession", back_populates="events")
    user = relationship("User", back_populates="events")
    __table_args__ = (
        UniqueConstraint(
            "session_id", "to_player", "to_player_idx", name="player_receive_index"
        ),
    )


class SRAMStore(Base):
    __tablename__ = "sramstores"

    id = Column(Integer, primary_key=True, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now,
        server_default=func.clock_timestamp(),
    )
    session_id = Column(UUID(as_uuid=True), ForeignKey("mwsessions.id"))
    player = Column(Integer, index=True)
    sram = Column(JSON())
    prev_sram = Column(JSON(), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    session = relationship("MWSession", back_populates="sramstores")
    user = relationship("User", back_populates="sramstores")
