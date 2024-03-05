import json
import zlib

import logging

from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Header,
    WebSocket,
    WebSocketDisconnect,
    File,
    Form,
)
from fastapi.websockets import WebSocketState
from starlette import status

from sqlalchemy.orm import Session
from sqlalchemy import event as listen_event

from . import crud, models, schemas
from .database import SessionLocal, engine

# from .data.locs import location_table_uw_by_room, multi_location_table
from .data import data as loc_data
from . import sram
import time

app = FastAPI(
    title="ALTTPR Multiworld Server",
    description="A server for ALTTPR Multiworld",
    version="0.1.0",
    root_path="/api/v1",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
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


# models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

ONE_MB = 1024 * 1024


def get_db():
    db = SessionLocal()
    db.expire_on_commit = False
    try:
        yield db
    finally:
        db.close()


async def valid_content_length(content_length: int = Header(..., lt=ONE_MB * 10)):
    return content_length


@app.post("/multidata")
def create_multi_session(
    file: Annotated[bytes, File()],
    game: Annotated[str, Form()],
    password: Annotated[str, Form()] = None,
    db: Session = Depends(get_db),
    file_size: int = Depends(valid_content_length),
):
    # Accept form multi-data

    if len(file) > file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Too large"
            )

    multidata = file
    db_game = crud.get_game(db, game)

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
    mw_session_id: str, db: Session = Depends(get_db)
) -> list[schemas.Event]:
    all_events = crud.get_all_events(db, session_id=mw_session_id)
    for event in all_events:
        if event.event_type == models.EventTypes.new_item:
            if event.event_data == None:
                event.event_data = {}
            event.event_data['item_name'] = loc_data.item_table[str(event.item_id)]
            event.event_data['location_name'] = loc_data.lookup_id_to_name[str(event.location)]
    return all_events


@app.websocket("/ws/{mw_session_id}")
async def websocket_endpoint(
    websocket: WebSocket, mw_session_id: str, db: Session = Depends(get_db)
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

    # Get all events for the session of either join or leave for this player
    conn_events = crud.get_player_connection_events(db, session.id, player_id)
    if (
        len(conn_events) > 0
        and conn_events[0].event_type == models.EventTypes.player_join
    ):
        logger.warning(f"Player {player_id} already joined")
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

    multidata = session.mwdata
    multidata_locs = {tuple(d[0]): tuple(d[1]) for d in multidata["locations"]}

    events_to_send = []
    should_close = False

    # This listens for new events and sends them to the client, it's never actually called itself
    @listen_event.listens_for(models.Event, "after_insert")
    def after_event(mapper, connection, target_event):
        nonlocal should_close
        nonlocal events_to_send
        if target_event.session_id != session.id:
            return

        if websocket.client_state != WebSocketState.CONNECTED:
            # TODO: Actually handle this
            should_close = True
            return

        # TODO
        # Here we need to deal with all of the possible commands.
        # For items, distinguish between displaying an event and obtaining an item
        # events_to_send.put(
        if (
            target_event.event_type == models.EventTypes.new_item
            and target_event.to_player == player_id
        ):
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
            target_event.event_data['item_name'] = loc_data.item_table[str(target_event.item_id)]
            target_event.event_data['location_name'] = loc_data.lookup_id_to_name[str(target_event.location)]
            new_event["data"]["event_idx"] = list(target_event.id.to_bytes(2, "big"))

        events_to_send.append(new_event)

    checked_locations = set()

    for p_event in crud.get_events_from_player(db, session.id, player_id):
        if p_event.event_type == models.EventTypes.new_item:
            checked_locations.add(p_event.location)

    try:
        while True:
            if len(events_to_send) > 0:
                new_items = [x for x in events_to_send if x["type"] == "new_item"]
                events_to_send = [x for x in events_to_send if x["type"] != "new_item"]
                events_to_send.append(
                    {
                        "type": "new_items",
                        "data": [x["data"] for x in new_items],
                    }
                )

                logger.debug(f"Player {player_id} - Sending {len(events_to_send)} events")
                if len(new_items) > 0:
                    items_per_player = {
                        p: len([x for x in new_items if x["data"]["to_player"] == p])
                        for p in set([x["data"]["to_player"] for x in new_items])
                    }
                    logger.debug(f"Player {player_id} - Also sending {len(new_items)} new items ({items_per_player})")

                for event in events_to_send:
                    await websocket.send_json(event)
                events_to_send = []
            payload = await websocket.receive_json()

            if payload["type"] == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if payload["type"] == "update_memory":
                # Update the memory for the session
                sramstore = schemas.SRAMStoreCreate(
                    session_id=session.id,
                    player=player_id,
                    sram=json.dumps(payload["data"]),
                )
                # NOTE: This sram store could be moved to on disconnect only if we want to save on writes
                old_sram, new_sram = crud.update_sramstore(db, sramstore)

                if old_sram == None:
                    continue

                sram_diff = sram.sram_diff(new_sram, old_sram)

                if len(sram_diff) == 0:
                    continue

                locations = sram.get_changed_locations(sram_diff, new_sram)

                for location in locations:
                    loc_id = int(loc_data.lookup_name_to_id[location])

                    if (loc_id, player_id) not in multidata_locs:
                        logger.error(
                            f"Player {player_id} - Location not in multidata_locs: {location} [{loc_id}]"
                        )
                        continue
                    item_id, item_player = multidata_locs[(loc_id, player_id)]

                    if loc_id not in checked_locations:
                        logger.info(
                            f"Player {player_id} - New Location Checked: {location} [{loc_id}]"
                        )

                        crud.create_event(
                            db,
                            schemas.EventCreate(
                                session_id=session.id,
                                event_type=models.EventTypes.new_item,
                                from_player=player_id,
                                to_player=item_player,
                                item_id=item_id,
                                item_name=loc_data.item_table[str(item_id)],
                                location=loc_id,
                                event_data={},
                            ),
                        )
                        checked_locations.add(loc_id)

                # Compare all events for the player with their sram to see if they need to be sent any items (save scummed)

                to_player_events = crud.get_events_for_player(db, session.id, player_id)
                last_event = int.from_bytes(new_sram["multiinfo"][:2], "big")
                if len(to_player_events) > 0:
                    logger.debug(
                        f"Player {player_id} - Last event: {last_event}. Total events: {len(to_player_events)}, last event: {
                            {k: v for k, v in to_player_events[-1].__dict__.items() if not k.startswith("_")}}"
                 )

                for event in to_player_events:
                    if event.id <= last_event:
                        continue
                    if event.event_type != models.EventTypes.new_item:
                        continue
                    # Don't send players items from their own games
                    if event.from_player == player_id or event.to_player != player_id:
                        continue
                    item_name = loc_data.item_table[str(event.item_id)]

                    logger.info(
                        f"Player {player_id} - Player doesn't have {item_name} from {event.from_player} id: {event.id}. Resending"
                    )
                    # events_to_send.put(
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
                                "item_name": item_name,
                                "event_idx": list(event.id.to_bytes(2, "big")),
                                "item_name": item_name,
                                "item_id": loc_data.item_table_reversed[item_name],
                                "location": event.location,
                            },
                        }
                    )
                    last_event = event.id

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
