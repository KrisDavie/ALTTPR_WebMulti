import datetime
from typing import List, Literal
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
    bot: bool = False
    bot_owner_id: int | None = None
    pass


class UserCreate(UserBase):
    session_tokens: list[str]
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
    token: str | None = None
    supporter: bool = False
    colour: str | None = None
    avatar: str | None = None
    discord_username: str | None = None
    discord_display_name: str | None = None
    is_superuser: bool = False
    username_as_player_name: bool = False
    bots: List["User"] = []
    api_keys: List["APIKey"] = []

    class Config:
        from_attributes = True

class APIKeyBase(BaseModel):
    description: str | None = None


class APIKeyCreate(APIKeyBase):
    key: str
    pass


class APIKey(APIKeyBase):
    id: int
    user_id: int
    created_at: datetime.datetime
    last_used: datetime.datetime


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
    flags: dict | None = None
    allowed_users: List[str] | None = []


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


class UserSession(BaseModel):
    id: int
    user_id: int
    session_id: uuid.UUID

    class Config:
        from_attributes = True


class UserSessionCreate(UserSession):
    player_id: int | None = None
    pass


class PlayerInfo(BaseModel):
    playerNumber: int
    playerName: str
    connected: bool
    collectionRate: int
    totalLocations: int
    goalCompleted: bool
    curCoords: list[int]
    world: Literal["EG1", "EG2", "LW", "DW", "HC", "EP", "DP", "AT", "SP", "PD", "MM", "SW", "IP", "TH", "TT", "TR", "GT"]
    health: float
    maxHealth: float
    userId: int | None = None
    usernameAsPlayerName: bool = False
    userName: str | None = None
    colour: str | None = None

class Features(BaseModel):
    chat: bool
    pauseRecieving: bool
    missingCmd: bool
    duping: bool
    forfeit: bool

class MWSessionInfo(BaseModel):
    id: str
    players: List[PlayerInfo]
    status: str
    owner: tuple[str, int]
    admins: List[tuple[str, int]] | None = None
    createdTimestamp: int
    lastChangeTimestamp: int
    featureFlags: Features
    race: bool

    