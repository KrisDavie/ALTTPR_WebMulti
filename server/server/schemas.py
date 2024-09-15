import datetime
from typing import List
from pydantic import BaseModel

import uuid

from server.models import EventTypes


class LogBase(BaseModel):
    session_id: uuid.UUID
    player_id: int | None = None
    content: str

class LogEntryCreate(LogBase):
    pass


class LogEntry(LogBase):
    id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True


class DiscordAPIUser(BaseModel):
    id: str
    username: str
    avatar: str | None = None
    discriminator: str
    public_flags: int
    flags: int
    banner: str | None = None
    accent_color: int | None = None
    global_name: str 
    avatar_decoration_data: str | None = None
    banner_color: str | None = None
    clan: str | None = None
    mfa_enabled: bool
    locale: str
    premium_type: int
    email: str
    verified: bool
    refresh_token: str | None = None

class UserBase(BaseModel):
    session_tokens: list[str]
    pass


class UserCreate(UserBase):
    pass


class DiscordUserCreate(UserBase):
    discord_id: str
    username: str
    email: str
    discord_username: str
    avatar: str | None = None
    refresh_token: str | None = None


class User(UserBase):
    id: int
    username: str | None = None
    supporter: bool = False
    colour: str | None = None
    avatar: str | None = None
    discord_username: str | None = None

    class Config:
        from_attributes = True


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
    user_id: int | None = None
    from_player: int
    to_player: int
    to_player_idx: int | None = None
    item_id: int
    location: int
    frame_time: int | None = None


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
    tournament: bool = False


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
