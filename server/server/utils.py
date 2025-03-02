from collections import defaultdict
import datetime

from asyncio import sleep
import json
from fastapi import Depends
from sqlalchemy.orm import Session
from typing import Annotated

from . import models, schemas, crud
from .dependencies import get_db

from .data.data import DUNGEON_IDS

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
            from_player=-1,
            to_player=private,
            item_id=-1,
            location=-1,
            event_data={
                "message": message,
                "type": type,
                "private": False if private == -1 else True,
            },
        ),
    )


def player_chat(
    message: str,
    session: models.MWSession,
    db: Annotated[Session, Depends(get_db)],
    player_id: int,
    extra_data: dict = {},
):
    ev_data = {"message": message, "type": "chat", "private": False, **extra_data}
    return crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.chat,
            from_player=player_id,
            to_player=-1,
            item_id=-1,
            location=-1,
            event_data=ev_data,
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


def sanitize_chat_message(message: str):
    if message.startswith("/"):
        command = message.split(" ")
        if command[0] == "/countdown":
            final_message = command[0]
            if len(command) > 1:
                try:
                    final_message = " ".join(command[0], int(command[1]))
                except:
                    pass
        else:
            final_message = command[0]
    else:
        final_message = message
    return final_message[:1000]


def user_allowed_in_session(session: models.MWSession, user: models.User):
    if session.allowed_users == None:
        return True
    if not user:
        return False
    if user.is_superuser:
        return True
    all_allowed_users = session.allowed_users + [x.discord_id for x in session.owners]
    return user.discord_id in all_allowed_users


def get_session_players_info_from_db(
    db: Annotated[Session, Depends(get_db)], session: models.MWSession
) -> list[schemas.PlayerInfo]:
    user_session_links = {
        x.player_id: crud.get_user(db, x.user_id)
        for x in crud.get_user_session_links(db, session.id)
    }
    player_srams = [
        crud.get_sramstore(db, session.id, x + 1)
        for x in range(len(session.mwdata["names"][0]))
    ]
    player_datas = []
    players_tot_cr = defaultdict(int)
    for loc in session.mwdata["locations"]:
        players_tot_cr[loc[0][1]] += 1

    for player_id, (player_name, player_sram) in enumerate(
        zip(session.mwdata["names"][0], player_srams)
    ):
        player_id += 1
        cr = 0
        goal_completed = False
        connected = False
        coords = [0, 0]
        world = "EG1"
        health = 3.0
        maxHealth = 3.0
        userId = None
        usernameAsPlayerName = False
        userName = None
        colour = None

        conn_events = crud.get_player_connection_events(db, session.id, player_id)
        if (
            len(conn_events) > 0
            and conn_events[0].event_type == models.EventTypes.player_join
        ):
            connected = True

        if player_sram:
            sram = json.loads(player_sram.sram)
            game_mode = sram["game_mode"][0]
            lw_dw = sram.get("lw_dw", [0x00])[0]
            cr = int.from_bytes(sram["inventory"][0xE3:0xE5], "little")
            goal_completed = bool(sram["inventory"][0x103])
            x = int.from_bytes(sram.get("coords", b"0000")[0:2], "little")
            y = int.from_bytes(sram.get("coords", b"0000")[2:4], "little")
            coords = [x, y]

            if game_mode == 0x07:
                if x > 8192:
                    world = "EG2"
                    x -= 8192
                else:
                    world = DUNGEON_IDS.get(int.from_bytes(sram["dungeon_id"], "little"), "EG1")
            elif game_mode == 0x09:
                if lw_dw == 0x00:
                    world = "LW"
                else:
                    world = "DW"

            health = float(sram["inventory"][0x2D]) / 0x08
            maxHealth = float(sram["inventory"][0x2C]) / 0x08

        if player_id in user_session_links:
            user = user_session_links[player_id]
            userId = user.id
            usernameAsPlayerName = user.username_as_player_name
            userName = user.username
            colour = user.colour

        player_datas.append(
            schemas.PlayerInfo(
                playerNumber=player_id,
                playerName=player_name,
                connected=connected,
                collectionRate=cr,
                totalLocations=players_tot_cr[player_id - 1],
                goalCompleted=goal_completed,
                curCoords=coords,
                world=world,
                maxHealth=maxHealth,
                health=health,
                userId=userId,
                usernameAsPlayerName=usernameAsPlayerName,
                userName=userName,
                colour=colour,
            )
        )
    return player_datas
