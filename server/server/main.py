from collections import defaultdict
import datetime
import json
import logging
import os
import secrets
import time
import zlib

from alembic.config import Config
from alembic import command
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from contextlib import asynccontextmanager
from cryptography.fernet import Fernet
from fastapi import (
    Body,
    Depends,
    FastAPI,
    HTTPException,
    Header,
    Request,
    Response,
    File,
    Form,
)
from fastapi.responses import HTMLResponse
from typing import Annotated
from starlette import status
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session

from server import crud, models, schemas
from server.ws import ws
from server.data import data as loc_data
from server.logging import logging_config
from server.dependencies import get_db


def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "heads")


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

app.include_router(ws.router)


logger = logging.getLogger(__name__)
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


def user_logout(response: Response, unauthorized: bool = False):
    response.delete_cookie("session_token")
    response.delete_cookie("user_id")
    response.delete_cookie("user_type")
    if unauthorized:
        raise HTTPException(
            status_code=401,
            detail="Invalid or Missing Session Token",
            headers=response.headers,
        )
    return response


def verify_session_token(
    response: Response,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    auth_only: bool = False,
    from_ws: dict = {},
) -> tuple[models.User, str]:
    # TODO: Confirm we don't have auth headers in other use cases
    if request and "Authorization" in request.headers:
        auth_type, token = request.headers["Authorization"].split(" ")
        if auth_type.lower() != "bearer":
            return False, False
        
        user = crud.get_user_by_api_key(db, token)
        if not user:
            return False, False
        updated_token = crud.update_api_key_used(db, token)
        return user, updated_token

    if from_ws == {}:
        token = request.cookies.get("session_token")
        user_id = request.cookies.get("user_id")
    else:
        token = from_ws.get("session_token")
        user_id = from_ws.get("user_id")


    if not user_id:
        if not auth_only:
            return create_guest_user(response, db)
        return False, False
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
        user_logout(response, unauthorized=True)
    if fernet.decrypt(token.encode()) not in [
        fernet.decrypt(x.encode()) for x in user.session_tokens
    ]:
        user_logout(response, unauthorized=True)
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


@app.post("/users/bot")
def create_bot(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
    bot_name: Annotated[str, Body()] = "",
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if len(user.bots) >= 3 and not user.is_superuser:
        raise HTTPException(status_code=403, detail="Too many bots")
    if not user.discord_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if bot_name != "":
        existing_user = crud.get_user_by_username(db, bot_name)
        if existing_user:
            raise HTTPException(status_code=409, detail="Username already exists")
        
    bot = crud.create_user(
        db, schemas.UserCreate(bot=True, session_tokens=[], bot_owner_id=user.id)
    )
    bot_name = bot_name if bot_name != "" else f"Bot#{bot.id:04}"
    bot = crud.set_bot_username(db, bot.id, bot_name)
    return bot

@app.get("/users/{user_id}/username")
def get_username(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_id: int,
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"username": user.username}

@app.delete("/users/bot/{bot_id}")
def delete_bot(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    bot_id: int,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    bot = crud.get_user(db, bot_id)

    if not user.is_superuser and user.id != bot.bot_owner_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = crud.delete_bot(db, bot_id)

    if not success:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"message": "Bot removed"}


@app.post("/users/bot/{bot_id}/api_key")
def create_apikey(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    bot_id: int,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
    description: str = None,
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    bot = crud.get_user(db, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if not bot.bot:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if not user.is_superuser and user.id != bot.bot_owner_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    apikey = crud.add_api_key(
        db,
        owner_id=user.id,
        user_id=bot_id,
        api_key=schemas.APIKeyCreate(
            key=secrets.token_urlsafe(32), description='test_description'
        ),
    )
    return apikey


@app.delete("/users/bot/{bot_id}/api_key/{apikey_id}")
def delete_apikey(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    bot_id: int,
    apikey_id: int,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    bot = crud.get_user(db, bot_id)

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if not bot.bot:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if not user.is_superuser and user.id != bot.bot_owner_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    success = crud.revoke_api_key(db, user.id, bot.id, apikey_id)
    if not success:
        raise HTTPException(status_code=404, detail="API Key not found")
    return {"message": "API Key removed"}


@app.post("/users/auth", response_model=schemas.User)
def auth_user(
    response: Response,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    auth_only: bool,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    if (user.discord_id and not user.discord_display_name):
        user.discord_display_name = user.username
        user = crud.update_user(db, user.id, user)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user.token = token
    return user

@app.post("/users/update", response_model=schemas.User)
def set_username(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
    username: str = Body(None),
    username_as_player_name: bool = Body(None),

):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if username is not None:
        existing_user = crud.get_user_by_username(db, username)
        if existing_user:
            raise HTTPException(status_code=409, detail="Username already exists")
        user.username = username
    if username_as_player_name is not None:
        user.username_as_player_name = username_as_player_name

    user = crud.update_user(db, user.id, user)
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
            user_logout(response, unauthorized=True)
    # No user set in the browser
    if not user:
        # TODO: This workflow could be better
        user = crud.get_user_by_email(db, discord_user["email"])
    # User hasn't logged in before
    if not user:
        user, token = create_guest_user(response, db)

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


@app.post("/users/logout")
def logout_user(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)] = None,
):
    user_logout(response)
    user, token = user_info
    crud.remove_user_session_token(db, user.id, token)
    return {"message": "Logged out", "logoutResult": "success"}


@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(
    response: Response,
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.is_superuser:
        return crud.get_user(db, user_id)
    if user_id != user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return user


def get_session_info(
    db: Annotated[Session, Depends(get_db)], session: schemas.MWSession, user_id: int
):
    player_srams = [
        crud.get_sramstore(db, session.id, x + 1)
        for x in range(len(session.mwdata["names"][0]))
    ]
    last_updated = crud.get_last_event(db, session.id).timestamp.timestamp()
    if not last_updated:
        last_updated = session.created_at.timestamp()
    player_datas = []
    players_tot_cr = defaultdict(int)
    for loc in session.mwdata["locations"]:
        players_tot_cr[loc[0][1]] += 1

    for player_id, (player_name, player_sram) in enumerate(
        zip(session.mwdata["names"][0], player_srams)
    ):
        if not player_sram:
            cr = 0
            goal_completed = False
        else:
            sram = json.loads(player_sram.sram)
            cr = int.from_bytes(sram["inventory"][0xE3:0xE5], "little")
            goal_completed = bool(sram["inventory"][0x103])
        player_datas.append(
            schemas.PlayerInfo(
                playerNumber=player_id + 1,
                playerName=player_name,
                collectionRate=cr,
                totalLocations=players_tot_cr[player_id + 1],
                goalCompleted=goal_completed,
                curCoords=[0, 0],
                userId=None,
            )
        )
    TIME_TO_IDLE = datetime.timedelta(days=2)

    tot_complete = all([x.goalCompleted for x in player_datas])
    if tot_complete == len(player_datas):
        status = "completed"
    elif last_updated <= (datetime.datetime.now() - TIME_TO_IDLE).timestamp():
        status = "inactive"
    else:
        status = "active"

    owners_info = [
        (x.username if x.username else f"Guest#{x.id:04}", x.id) for x in session.owners
    ]

    session_model = schemas.MWSessionInfo(
        id=str(session.id),
        players=player_datas,
        status=status,
        owner=owners_info[0],
        admins=owners_info,
        createdTimestamp=int(session.created_at.timestamp() * 1000),
        lastChangeTimestamp=int(last_updated * 1000),
        featureFlags=schemas.Features(
            chat=True,
            pauseRecieving=True,
            missingCmd=True,
            duping=True,
        ),
        race=session.tournament,
    )
    return session_model


@app.get("/session/{mw_session_id}", response_model=schemas.MWSessionInfo)
def get_session(
    db: Annotated[Session, Depends(get_db)],
    mw_session_id: str,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    return get_session_info(db, crud.get_session(db, mw_session_id), user.id)


@app.get("/users/{user_id}/sessions", response_model=list[schemas.MWSessionInfo])
def get_user_sessions(
    db: Annotated[Session, Depends(get_db)],
    user_id: int,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    user, token = user_info
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # TODO support public profiles
    if user.id != user_id and not user.is_superuser:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if user.is_superuser:
        all_sessions = sorted(crud.get_sessions(db), key=lambda x: x.created_at)
    else:
        all_sessions = sorted(
            crud.get_user_sessions(db, user.id), key=lambda x: x.created_at
        )
    sessions = []
    for session in all_sessions:
        sessions.append(get_session_info(db, session, user.id))
    return sessions


@app.post("/multidata")
def create_multi_session(
    file: Annotated[bytes, File()],
    game: Annotated[str, Form()],
    db: Annotated[Session, Depends(get_db)],
    file_size: Annotated[int, Depends(valid_content_length)],
    password: Annotated[str, Form()] = None,
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)] = None,
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
    all_events = crud.get_events(db, session_id=mw_session_id)
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


@app.post("/session/{mw_session_id}/adminSend")
def admin_send_event(
    mw_session_id: str,
    send_data: dict,
    db: Annotated[Session, Depends(get_db)],
    user_info: Annotated[tuple[models.User, str], Depends(verify_session_token)],
):
    session = crud.get_session(db, mw_session_id)
    user, token = user_info

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.id not in [x.id for x in session.owners] and not user.is_superuser:
        raise HTTPException(status_code=403, detail="Unauthorized")

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
