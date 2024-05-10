from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
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


def generate_uuid():
    return str(uuid.uuid4())


class MWSession(Base):
    __tablename__ = "mwsessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    game_id = Column(Integer, ForeignKey("games.id"))
    session_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    mwdata = Column(JSON)

    game = relationship("Game", back_populates="mwsessions")
    events = relationship("Event", back_populates="session")
    sramstores = relationship("SRAMStore", back_populates="session")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, index=True)

    mwsessions = relationship("MWSession", back_populates="game")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(UUID(as_uuid=True), ForeignKey("mwsessions.id"))

    from_player = Column(Integer, index=True)
    to_player = Column(Integer, index=True)
    to_player_idx = Column(Integer, index=True, nullable=True)
    item_id = Column(Integer, index=True)
    location = Column(Integer, index=True)
    event_type = Column(Enum(EventTypes), index=True)
    event_data = Column(JSON)

    session = relationship("MWSession", back_populates="events")
    __table_args__ = (UniqueConstraint("session_id", "to_player", "to_player_idx", name="player_receive_index"),)



class SRAMStore(Base):
    __tablename__ = "sramstores"

    id = Column(Integer, primary_key=True, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(UUID(as_uuid=True), ForeignKey("mwsessions.id"))
    player = Column(Integer, index=True)
    sram = Column(JSON(Integer))
    prev_sram = Column(JSON(Integer), nullable=True)

    session = relationship("MWSession", back_populates="sramstores")
