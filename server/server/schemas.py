import datetime
from typing import List
from pydantic import BaseModel

import uuid

from server.models import EventTypes


class GameBase(BaseModel):
    title: str
    description: str | None = None


class GameCreate(GameBase):
    pass


class Game(GameBase):
    id: int

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    session_id: uuid.UUID
    event_type: EventTypes
    event_data: dict | None = None
    from_player: int
    to_player: int
    item_id: int
    location: int


class EventCreate(EventBase):
    pass


class Event(EventBase):
    id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True


class MWSessionBase(BaseModel):
    is_active: bool
    mwdata: dict | None = None


class MWSessionCreate(MWSessionBase):
    game_id: int
    session_password: str | None = None


class MWSession(MWSessionBase):
    id: uuid.UUID
    created_at: datetime.datetime
    game: Game

    class Config:
        from_attributes = True


class EventSchema(Event):
    session: MWSession


class MWSessionSchema(MWSession):
    events: List[Event] = []


class SRAMStoreBase(BaseModel):
    player: int
    sram: str
    prev_sram: str | None = None
    session_id: uuid.UUID


class SRAMStoreCreate(SRAMStoreBase):
    pass


class SRAMStore(SRAMStoreBase):
    id: int
    updated_at: datetime.datetime

    class Config:
        from_attributes = True
