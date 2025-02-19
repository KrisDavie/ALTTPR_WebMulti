from asyncio import sleep
import asyncio
from contextlib import asynccontextmanager
import json
import os
import secrets
import zlib
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError

import datetime

from cryptography.fernet import Fernet

import logging

from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Header,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    File,
    Form,
)
from fastapi.responses import HTMLResponse
from fastapi.websockets import WebSocketState
from starlette import status
from starlette.middleware.sessions import SessionMiddleware

from sqlalchemy.orm import Session
from sqlalchemy import event as listen_event

from alembic.config import Config
from alembic import command

from . import crud, models, schemas
from .database import SessionLocal, engine

from .data import data as loc_data
from . import sram
import time

def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app_: FastAPI):
    logger.info("Starting up...")
    logger.info("run alembic upgrade head...")
    run_migrations()
    yield
    logger.info("Shutting down...")



app = FastAPI(
    title="ALTTPR Multiworld Server",
    description="A server for ALTTPR Multiworld",
    version="0.1.0",
    root_path="/api/v1",
    lifespan=lifespan,
)

app.add_middleware(
    SessionMiddleware, secret_key=os.environ.get("FASTAPI_SESSION_SECRET")
)

logging_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "DEBUG",
    },
}

logger = logging.getLogger("ALTTPR WebMulti")
logging.config.dictConfig(logging_config)

oauth = OAuth()
oauth.register(
    name="discord",
    server_metadata_url="https://discord.com/.well-known/openid-configuration",
    client_kwargs={"scope": "identify email"},
    client_id=os.environ.get("DISCORD_OAUTH_CLIENT_ID"),
    client_secret=os.environ.get("DISCORD_OAUTH_CLIENT_SECRET"),
    api_base_url="https://discord.com/api/v10",
)


fernet = Fernet(os.environ.get("FERNET_SECRET"))

ONE_MB = 1024 * 1024
SESSION_EXPIRE_DAYS = max(
    2, int(os.environ.get("SESSION_EXPIRE_DAYS", 28))
)  # Minimum 2 days


def get_db():
    db = SessionLocal()
    db.expire_on_commit = False
    try:
        yield db
    finally:
        db.close()


async def valid_content_length(content_length: int = Header(..., lt=ONE_MB * 10)):
    return content_length


def create_guest_user(response: Response, db: Annotated[Session, Depends(get_db)]):
    token = fernet.encrypt(secrets.token_urlsafe(16).encode()).decode()
    user = crud.create_user(db, schemas.UserCreate(session_tokens=[token]))
    response.set_cookie(
        "session_token",
        token,
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    response.set_cookie(
        "user_id",
        str(user.id),
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    response.set_cookie(
        "user_type",
        "guest",
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    return user, token


def verify_session_token(
    response: Response, request: Request, db: Annotated[Session, Depends(get_db)]
):
    token = request.cookies.get("session_token")
    user_id = request.cookies.get("user_id")
    if not user_id:
        return create_guest_user(response, db)
    if not token:
        return False, False
    user = crud.get_user(db, int(user_id))
    if not user:
        return False, False
    if len(user.session_tokens) == 0:
        return False, False
    try:
        fernet.decrypt(token.encode())
    except:
        response.delete_cookie("session_token")
        raise HTTPException(status_code=401, detail="Invalid session token")
    if fernet.decrypt(token.encode()) not in [
        fernet.decrypt(x.encode()) for x in user.session_tokens
    ]:
        # if fernet.decrypt(user.session_token.encode()) != fernet.decrypt(token.encode()):
        response.delete_cookie("session_token")
        raise HTTPException(status_code=401, detail="Invalid session token")
    if (
        fernet.extract_timestamp(token.encode())
        < (
            datetime.datetime.now(datetime.UTC)
            - datetime.timedelta(days=SESSION_EXPIRE_DAYS + 1)
        ).timestamp()
    ):
        return update_session_token(response, db, user.id, token)
    return user, token


def update_session_token(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_id: int,
    old_token: str,
):
    token = fernet.encrypt(secrets.token_urlsafe(16).encode()).decode()
    user = crud.update_user_session_token(db, user_id, token, old_token)
    response.set_cookie(
        "session_token",
        token,
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    return user, token


@app.post("/users/auth", response_model=schemas.User)
def auth_user(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[dict, Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


@app.get("/users/discord_login")
async def discord_login(request: Request):
    redirect_uri = request.url_for("discord_auth")
    return await oauth.discord.authorize_redirect(request, redirect_uri)


@app.get("/users/discord_auth", response_class=HTMLResponse)
async def discord_auth(
    request: Request, response: Response, db: Annotated[Session, Depends(get_db)]
):
    try:
        discord_token = await oauth.discord.authorize_access_token(request)
    except OAuthError as e:
        return e.error
    resp = await oauth.discord.get("users/@me", token=discord_token)

    discord_user: schemas.DiscordAPIUser = resp.json()
    discord_user["refresh_token"] = discord_token["refresh_token"]

    token = request.cookies.get("session_token")
    user_id = request.cookies.get("user_id")
    user = None
    if user_id:
        if token:
            logger.debug(f"User ID: {user_id}, should verify")
            user, token = verify_session_token(response, request, db)
        else:
            response.delete_cookie("session_token")
            user, token = verify_session_token(response, request, db)
            raise HTTPException(status_code=401, detail="Invalid session token")
    # No user set in the browser
    if not user:
        # TODO: This workflow could be better
        user = crud.get_user_by_email(db, discord_user["email"])
    # User hasn't logged in before
    if not user:
        user, token = create_guest_user(response, db)
    # User was a guest previously
    if user.email != discord_user["email"]:
        user = crud.update_discord_user(db, user.id, discord_user)

    if not token:
        token = fernet.encrypt(secrets.token_urlsafe(16).encode()).decode()
        user = crud.update_user_session_token(db, user.id, token, None)
    response.set_cookie(
        "user_type",
        "discord",
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    response.set_cookie(
        "user_id",
        str(user.id),
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    response.set_cookie(
        "session_token",
        token,
        expires=datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    return f"""
    <html>
        <head
            data-user-id="{user.id}"
        >
            <title>Discord Login</title>
        </head>
        <body>
           Successfully logged in as: {user.username}
        </body>
    </html>
    """


@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(
    response: Response,
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[dict, Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.is_superuser:
        return crud.get_user(db, user_id)
    if user_id != user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return user


@app.post("/multidata")
def create_multi_session(
    file: Annotated[bytes, File()],
    game: Annotated[str, Form()],
    db: Annotated[Session, Depends(get_db)],
    file_size: Annotated[int, Depends(valid_content_length)],
    password: Annotated[str, Form()] = None,
    user_info: Annotated[dict, Depends(verify_session_token)] = None,
):
    # Accept form multi-data

    if len(file) > file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Too large"
        )

    multidata = file
    db_game = crud.get_game(db, game)
    user, _ = user_info

    if not db_game:
        db_game = crud.create_game(db, schemas.GameCreate(title=game))
        logger.error(f"Game does not exist, creating it: {game}")
        # return {"error": "Game does not exist, please create it first"}

    parsed_data = json.loads(zlib.decompress(multidata).decode("utf-8"))

    # Create a session for the game
    session = crud.create_session(
        db,
        schemas.MWSessionCreate(
            game_id=db_game.id,
            is_active=True,
            mwdata=parsed_data,
            session_password=password if password else None,
        ),
        user.id,
    )

    create_event = crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.session_create,
            from_player=-1,
            to_player=-1,
            item_id=-1,
            location=-1,
            user_id=user.id,
            event_data={"session_id": str(session.id)},
        ),
    )
    if session.id:
        logger.info(f"Session created: {session.id}")
        return {"mw_session": session.id, "password": session.session_password}
    else:
        logger.error(f"Failed to create session")
        return {"error": "Failed to create session"}


@app.get("/session/{mw_session_id}/events")
def get_session_events(
    mw_session_id: str, db: Annotated[Session, Depends(get_db)]
) -> list[schemas.Event]:
    all_events = crud.get_all_events(db, session_id=mw_session_id)
    for event in all_events:
        if event.event_type == models.EventTypes.new_item:
            if event.event_data == None:
                event.event_data = {}
            event.event_data["item_name"] = loc_data.item_table[str(event.item_id)]
            event.event_data["location_name"] = loc_data.lookup_id_to_name[
                str(event.location)
            ]
        event.event_data["timestamp"] = int(time.mktime(event.timestamp.timetuple()))
    return all_events


@app.get("/session/{mw_session_id}/players")
def get_session_players(
    mw_session_id: str, db: Annotated[Session, Depends(get_db)]
) -> list[str]:
    session = crud.get_session(db, mw_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.mwdata["names"][0]


@app.post("/admin/{mw_session_id}/send")
def admin_send_event(
    mw_session_id: str,
    send_data: dict,
    db: Annotated[Session, Depends(get_db)],
):
    session = crud.get_session(db, mw_session_id)
    if not session:
        return {"error": "Session not found"}
    if session.session_password != None:
        if send_data["password"] != session.session_password:
            return {"error": "Invalid password"}
    if send_data["event_type"] == "send_single":
        new_event = crud.create_event(
            db,
            schemas.EventCreate(
                session_id=session.id,
                event_type=models.EventTypes.new_item,
                from_player=0,
                to_player=send_data["to_players"],
                item_id=send_data["item_id"],
                location=0,
                event_data={
                    "item_name": loc_data.item_table[str(send_data["item_id"])],
                    "location_name": loc_data.lookup_id_to_name["0"],
                    "reason": "admin_send",
                },
            ),
        )
    elif send_data["event_type"] == "send_multi":
        for player in send_data["to_players"]:
            new_event = crud.create_event(
                db,
                schemas.EventCreate(
                    session_id=session.id,
                    event_type=models.EventTypes.new_item,
                    from_player=0,
                    to_player=player,
                    item_id=send_data["item_id"],
                    location=0,
                    event_data={
                        "item_name": loc_data.item_table[str(send_data["item_id"])],
                        "location_name": loc_data.lookup_id_to_name["0"],
                        "reason": "admin_send",
                    },
                ),
            )
    return new_event




@app.post("/session/{mw_session_id}/log")
async def log_event(
    mw_session_id: str,
    send_data: dict,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = crud.get_session(db, mw_session_id)
    if not session:
        return {"error": "Session not found"}

    new_entry = schemas.LogEntryCreate(
        session_id=session.id,
        player_id=send_data["player_id"],
        content=send_data["message"],
    )

    log_entry = crud.add_log_entry(db, new_entry)

    if not log_entry:
        return {"error": "Failed to log message"}
    return {"log_id": log_entry.id}


@app.post("/session/{mw_session_id}/player_forfeit")
async def player_forfeit(
    mw_session_id: str,
    send_data: dict,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = crud.get_session(db, mw_session_id)
    if not session:
        return {"error": "Session not found"}

    # TODO: Maybe add some security here.
    # Potentially a unique code generated per player when the session is made?
    player_id = send_data["player_id"]
    player_events = crud.get_events_from_player(db, session.id, player_id)
    all_player_items = [x for x in session.mwdata["locations"] if x[0][1] == player_id]
    all_player_items = {x[0][0]: x[1] for x in all_player_items}

    response = {"found_item_count": 0, "forfeit_item_count": 0}
    for sent_event in player_events:
        if sent_event.event_type == models.EventTypes.player_forfeit:
            return {"error": "Player already forfeited"}
        if sent_event.event_type != models.EventTypes.new_item:
            continue
        if sent_event.location in all_player_items:
            all_player_items.pop(sent_event.location)
            response["found_item_count"] += 1
        else:
            logger.error(
                f"Player {player_id} - Sent item not in player's items: {sent_event.location}"
            )
    ff_events = [
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.new_item,
            from_player=player_id,
            to_player=item_info[1],
            item_id=item_info[0],
            location=location,
            event_data={
                "reason": "forfeit",
                "item_name": loc_data.item_table[str(item_info[0])],
                "location_name": loc_data.lookup_id_to_name[str(location)],
            },
        )
        for location, item_info in all_player_items.items()
    ]
    response["forfeit_item_count"] = len(ff_events)
    success = crud.create_forfeit_events(db, session.id, ff_events)
    if not success:
        return {"error": "Failed to create forfeit events"}
    new_event = crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.player_forfeit,
            from_player=player_id,
            to_player=-1,
            item_id=-1,
            location=-1,
            event_data={"player_id": player_id},
        ),
    )
    response["event_id"] = (new_event.id,)

    return response


def system_chat(
    message: str,
    session: models.MWSession,
    db: Annotated[Session, Depends(get_db)],
    type: str = "chat",
    private: int = -1,
):
    return crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.chat,
            from_player=0,
            to_player=private,
            item_id=-1,
            location=-1,
            event_data={"message": message, "type": type, "private": False if private == -1 else True},
        ),
    )


async def countdown(
    countdown_time: int,
    session: models.MWSession,
    db: Annotated[Session, Depends(get_db)],
):
    await sleep(0.5)
    start_time = datetime.datetime.now()
    for i in range(countdown_time, -1, -1):
        while True:
            if datetime.datetime.now() >= start_time + datetime.timedelta(
                seconds=countdown_time - i
            ):
                if i <= 0:
                    break
                system_chat(f"{i}", session, db, type="countdown")
                break
            else:
                await sleep(0.010)
    system_chat("GO!", session, db, type="countdown")


@app.websocket("/ws/{mw_session_id}")
async def websocket_endpoint(
    websocket: WebSocket, mw_session_id: str, db: Annotated[Session, Depends(get_db)]
):
    await websocket.accept()
    session = crud.get_session(db, mw_session_id)

    connection_init_time = time.time()

    if not session:
        await websocket.close(reason="Session not found")
        return

    # Security check
    if session.session_password != None:
        password = await websocket.receive_text()
        if password != session.session_password:
            await websocket.close(reason="Invalid password")
            # Log failed join event
            crud.create_event(
                db,
                schemas.EventCreate(
                    session_id=session.id,
                    event_type=models.EventTypes.failed_join,
                    from_player=-1,
                    to_player=-1,
                    event_data={"reason": "Invalid password"},
                ),
            )
            return

    await websocket.send_json({"type": "connection_accepted"})
    await websocket.send_json({"type": "player_info_request"})
    while True:
        try:
            if time.time() - connection_init_time > 600:
                await websocket.close(reason="Player info not received")
                return
            player_info = await websocket.receive_json()
            if player_info["type"] == "player_info":
                time.sleep(0.1)
                break
        except WebSocketDisconnect:
            return

    try:
        player_id = int(player_info["player_id"])
        player_name = player_info["player_name"]
    except KeyError:
        await websocket.close(reason="Player info not received")
        return

    multidata = session.mwdata

    mw_rom_names = [x[2] for x in multidata["roms"]]
    player_names = [x for x in multidata["names"][0]]
    player_name = player_names[player_id - 1]

    if player_info["rom_name"] not in mw_rom_names:
        await websocket.close(reason="Incorrect ROM found")
        return

    # Get all events for the session of either join or leave for this player
    conn_events = crud.get_player_connection_events(db, session.id, player_id)
    if (
        len(conn_events) > 0
        and conn_events[0].event_type == models.EventTypes.player_join
    ):
        logger.warning(f"{player_name} already joined")
        await websocket.close(reason="Player already joined")
        return

    # Log join event
    crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.player_join,
            from_player=player_id,
            to_player=-1,
            item_id=-1,
            location=-1,
            event_data={"player_id": player_id, "player_name": player_name},
        ),
    )

    multidata_locs = {tuple(d[0]): tuple(d[1]) for d in multidata["locations"]}

    events_to_send = []
    should_close = False
    skip_update = 0
    witheld_items = []
    processing_sram = False

    await websocket.send_json({"type": "init_success"})

    # This listens for new events and sends them to the client, it's never actually called itself
    @listen_event.listens_for(models.Event, "after_insert")
    def after_event(mapper, connection, target_event):
        nonlocal should_close
        nonlocal events_to_send
        nonlocal skip_update
        nonlocal websocket

        if target_event.session_id != session.id:
            return
        elif target_event.event_type == models.EventTypes.player_forfeit:
            # I don't remember why I did this, but it's probably important
            skip_update = 3
            return
        elif websocket.client_state != WebSocketState.CONNECTED:
            # TODO: Actually handle this
            should_close = True
            return
        new_event = {
            "type": target_event.event_type.name,
            "data": {
                "id": target_event.id,
                "timestamp": int(time.mktime(target_event.timestamp.timetuple())),
                "event_type": target_event.event_type.name,
                "from_player": target_event.from_player,
                "to_player": target_event.to_player,
                "item_id": target_event.item_id,
                "location": target_event.location,
                "event_data": target_event.event_data,
            },
        }
        if target_event.event_type == models.EventTypes.new_item:
            if target_event.event_data == None:
                target_event.event_data = {}
            target_event.event_data["item_name"] = loc_data.item_table[
                str(target_event.item_id)
            ]
            target_event.event_data["location_name"] = loc_data.lookup_id_to_name[
                str(target_event.location)
            ]
            if target_event.to_player != target_event.from_player:
                new_event["data"]["event_idx"] = list(
                    target_event.to_player_idx.to_bytes(2, "big")
                )
        if target_event.event_type == models.EventTypes.chat:
            if target_event.event_data["type"] == "countdown":
                loop = asyncio.get_event_loop()
                logger.debug(f"Countdown: {datetime.datetime.now()}")
                loop.create_task(websocket.send_json(new_event))
                return
            if target_event.to_player != -1:
                if target_event.to_player != player_id:
                    return

        events_to_send.append(new_event)

    checked_locations = {}

    for p_event in crud.get_events_from_player(db, session.id, player_id):
        if p_event.event_type == models.EventTypes.new_item:
            checked_locations[p_event.location] = p_event.frame_time

    try:
        while True:
            if len(events_to_send) > 0:
                new_items = [x for x in events_to_send if x["type"] == "new_item"]
                events_to_send = [x for x in events_to_send if x["type"] != "new_item"]
                if len(new_items) > 0:
                    new_items = sorted(new_items, key=lambda x: x["data"]["id"])
                    # Here we make sure that no item events are missed, to_player_idx should ALWAYS be sequential
                    from_others_events = [
                        x for x in new_items if "to_player_idx" in x["data"]
                    ]
                    if len(from_others_events) > 0:
                        try:
                            last_event = int.from_bytes(
                                new_sram["multiinfo"][:2], "big"
                            )
                        except NameError:
                            last_event = 0
                        lowest_event = min(
                            [x["data"]["to_player_idx"] for x in from_others_events]
                        )
                        highest_event = max(
                            [x["data"]["to_player_idx"] for x in from_others_events]
                        )
                        extra_events = []

                        if (
                            (highest_event - lowest_event)
                            != (len(from_others_events) - 1)
                        ) or (lowest_event > (last_event + 1)):
                            logger.error(
                                f"{player_name} - Missing events between {last_event}, {lowest_event} and {highest_event} ({len(from_others_events)} events found)"
                            )
                            extra_events = crud.get_items_for_player_from_others(
                                db,
                                session.id,
                                player_id,
                                gt_idx=last_event,
                            )
                            # Reset new_items because we're just going to get everything again
                            new_items = []

                            for event in extra_events:
                                item_name = loc_data.item_table[str(event.item_id)]
                                new_items.append(
                                    {
                                        "type": "new_item",
                                        "data": {
                                            "id": event.id,
                                            "timestamp": int(
                                                time.mktime(event.timestamp.timetuple())
                                            ),
                                            "event_type": event.event_type.name,
                                            "from_player": event.from_player,
                                            "to_player": event.to_player,
                                            "event_idx": list(
                                                event.to_player_idx.to_bytes(2, "big")
                                            ),
                                            "item_id": loc_data.item_table_reversed[
                                                item_name
                                            ],
                                            "location": event.location,
                                            "event_data": {
                                                "item_name": item_name,
                                                "location_name": loc_data.lookup_id_to_name[
                                                    str(event.location)
                                                ],
                                            },
                                        },
                                    }
                                )
                    events_to_send.append(
                        {
                            "type": "new_items",
                            "data": [x["data"] for x in new_items],
                        }
                    )

                    items_per_player = {
                        p: len([x for x in new_items if x["data"]["to_player"] == p])
                        for p in set([x["data"]["to_player"] for x in new_items])
                    }
                    logger.debug(
                        f"{player_name} - Also sending {len(new_items)} new items ({items_per_player})"
                    )

                logger.debug(f"{player_name} - Sending {len(events_to_send)} events")

                # Get all item events
                item_event_lists = [
                    event for event in events_to_send if event["type"] == "new_items"
                ]

                # Flatten the list of lists
                all_items = [
                    item_event
                    for item_event_list in item_event_lists
                    for item_event in item_event_list["data"]
                ]

                # filter all_items to remove duplicates where event.id is identical
                all_items = list({event["id"]: event for event in all_items}.values())

                logger.debug(f"{player_name} - {len(all_items)} - {all_items}")
                logger.debug(
                    f"{player_name} - {len(events_to_send)} - {events_to_send}"
                )

                non_item_events = [
                    event for event in events_to_send if event["type"] != "new_items"
                ]

                events_to_send = non_item_events
                if len(all_items) > 0:
                    events_to_send.append({"type": "new_items", "data": all_items})

                for event in events_to_send:
                    await websocket.send_json(event)

                events_to_send = []

                if len(witheld_items) > 0:
                    logger.debug(f"{player_name} - Appending witheld items")
                    events_to_send = [{"type": "new_items", "data": witheld_items}]
                    witheld_items = []

            try:
                payload = await asyncio.wait_for(websocket.receive_json(), timeout=1.5)
            except asyncio.TimeoutError:
                continue

            if payload["type"] == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            elif payload["type"] == "pause_receiving":
                crud.create_event(
                    db,
                    schemas.EventCreate(
                        session_id=session.id,
                        event_type=models.EventTypes.player_pause_receive,
                        from_player=player_id,
                        to_player=-1,
                        item_id=-1,
                        location=-1,
                        event_data={"player_id": player_id},
                    ),
                )
                continue
            elif payload["type"] == "resume_receiving":
                crud.create_event(
                    db,
                    schemas.EventCreate(
                        session_id=session.id,
                        event_type=models.EventTypes.player_resume_receive,
                        from_player=player_id,
                        to_player=-1,
                        item_id=-1,
                        location=-1,
                        event_data={"player_id": player_id},
                    ),
                )
                continue
            elif payload["type"] == "chat":
                ev = crud.create_event(
                    db,
                    schemas.EventCreate(
                        session_id=session.id,
                        event_type=models.EventTypes.chat,
                        from_player=player_id,
                        to_player=-1,
                        item_id=-1,
                        location=-1,
                        event_data={"message": payload["data"], "type": "chat"},
                    ),
                )
                # Check for commands
                if payload["data"].startswith("/"):
                    command = payload["data"].split(" ")
                    if command[0] == "/countdown":
                        if len(command) < 2:
                            countdown_time = 5
                        else:
                            try:
                                countdown_time = int(command[1])
                                if countdown_time > 60:
                                    system_chat(
                                        "Time too high, max is 60 seconds",
                                        session,
                                        db,
                                        private=player_id,
                                    )
                                    continue
                            except ValueError:
                                system_chat(
                                    "Invalid time value.",
                                    session,
                                    db,
                                    private=player_id,
                                )
                                continue
                        loop = asyncio.get_event_loop()
                        loop.create_task(countdown(countdown_time, session, db))
                    else:
                        await websocket.send_json(
                            {"type": "chat", "data": "Unknown command"}
                        )
            elif payload["type"] == "update_memory":
                # Update the memory for the session
                if processing_sram:
                    continue
                processing_sram = True

                # logger.debug(f"Got SRAM update from {player_name}")
                if skip_update > 0:
                    logger.debug(f"Skipping update for {player_name}")
                    skip_update -= 1
                    processing_sram = False
                    continue

                sramstore = schemas.SRAMStoreCreate(
                    session_id=session.id,
                    player=player_id,
                    sram=json.dumps(payload["data"]),
                )
                # NOTE: This sram store could be moved to on disconnect only if we want to save on writes
                old_sram, new_sram = crud.update_sramstore(db, sramstore)

                if old_sram == None:
                    processing_sram = False
                    continue

                sram_diff = sram.sram_diff(new_sram, old_sram)

                if len(sram_diff) == 0:
                    processing_sram = False
                    continue

                locations = sram.get_changed_locations(sram_diff, old_sram, new_sram)
                frame_time = new_sram["total_time"][2] << 16 | new_sram["total_time"][1] << 8 | new_sram["total_time"][0]
                old_frame_time = old_sram["total_time"][2] << 16 | old_sram["total_time"][1] << 8 | old_sram["total_time"][0]

                if frame_time < old_frame_time:
                    logger.debug(f"{player_name} - Frame time went backwards - Save scum or reset")
                    events_to_update = crud.get_events_after_frametime(
                        db, session.id, player_id, frame_time
                    )
                    crud.update_events_frametime(db, session.id, player_id, events_to_update, None)
                    for event in events_to_update:
                        checked_locations[event.location] = None


                for location in locations:
                    loc_id = int(loc_data.lookup_name_to_id[location])

                    if (loc_id, player_id) not in multidata_locs:
                        logger.error(
                            f"{player_name} - Location not in multidata_locs: {location} [{loc_id}]"
                        )
                        continue
                    item_id, item_player = multidata_locs[(loc_id, player_id)]

                    if loc_id not in checked_locations or (checked_locations[loc_id] != None and checked_locations[loc_id] < frame_time):
                        logger.info(
                            f"{player_name} - New Location Checked: {location} [{loc_id}]"
                        )

                        crud.create_event(
                            db,
                            schemas.EventCreate(
                                session_id=session.id,
                                event_type=models.EventTypes.new_item,
                                from_player=player_id,
                                to_player=item_player,
                                item_id=item_id,
                                location=loc_id,
                                frame_time=frame_time,
                                event_data={
                                    "item_name": loc_data.item_table[str(item_id)],
                                    "location_name": location,
                                },
                            ),
                        )
                        checked_locations[loc_id] = frame_time

                # Compare all events for the player with their sram to see if they need to be sent any items (save scummed)
                last_event = int.from_bytes(new_sram["multiinfo"][:2], "big")
                to_player_events = crud.get_items_for_player_from_others(
                    db, session.id, player_id, gt_idx=last_event
                )
                for event in to_player_events:
                    item_name = loc_data.item_table[str(event.item_id)]
                    logger.info(
                        f"{player_name} - Player doesn't have {item_name} from {event.from_player} id: {event.id}. Resending"
                    )
                    events_to_send.append(
                        {
                            "type": "new_item",
                            "data": {
                                "id": event.id,
                                "timestamp": int(
                                    time.mktime(event.timestamp.timetuple())
                                ),
                                "event_type": event.event_type.name,
                                "from_player": event.from_player,
                                "to_player": event.to_player,
                                "event_idx": list(
                                    event.to_player_idx.to_bytes(2, "big")
                                ),
                                "item_id": loc_data.item_table_reversed[item_name],
                                "location": event.location,
                                "event_data": {
                                    "item_name": item_name,
                                    "location_name": loc_data.lookup_id_to_name[
                                        str(event.location)
                                    ],
                                },
                            },
                        }
                    )
                    last_event = event.id

                # logger.debug(f"{player_name} - Finished processing sram update")
                processing_sram = False
                continue
            else:
                logger.error(f"Unknown message: {payload}")
                continue
    except WebSocketDisconnect:
        crud.create_event(
            db,
            schemas.EventCreate(
                session_id=session.id,
                event_type=models.EventTypes.player_leave,
                from_player=player_id,
                to_player=-1,
                item_id=-1,
                location=-1,
                event_data={"player_id": player_id, "player_name": player_name},
            ),
        )
