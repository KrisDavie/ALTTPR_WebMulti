import json

# from queue import Queue
import zlib
from typing import Annotated
from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, File, Form

from fastapi.websockets import WebSocketState

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
)


models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    db.expire_on_commit = False
    try:
        yield db
    finally:
        db.close()


@app.post("/multidata")
def create_multi_session(
    file: Annotated[bytes, File()],
    game: Annotated[str, Form()],
    password: Annotated[str, Form()] = None,
    db: Session = Depends(get_db),
):
    # Accept form multi-data
    multidata = file
    db_game = crud.get_game(db, game)

    if not db_game:
        db_game = crud.create_game(db, schemas.GameCreate(title=game))
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
        print(f"Session created: {session.id}")
        return {"mw_session": session.id, "password": session.session_password}
    else:
        return {"error": "Failed to create session"}


@app.get("/session/{mw_session_id}/events")
def get_session_events(
    mw_session_id: str, db: Session = Depends(get_db)
) -> list[schemas.Event]:
    return crud.get_all_events(db, session_id=mw_session_id)


@app.websocket("/ws/{mw_session_id}")
async def websocket_endpoint(
    websocket: WebSocket, mw_session_id: str, db: Session = Depends(get_db)
):
    await websocket.accept()
    session = crud.get_session(db, mw_session_id)

    if not session:
        await websocket.send_json({"type": "session_not_found"})
        await websocket.close()
        return

    # Security check
    if session.session_password != None:
        password = await websocket.receive_text()
        if password != session.session_password:
            await websocket.send_json({"type": "connection_rejected"})
            await websocket.close()
            # Log failed join event
            crud.create_event(
                db,
                schemas.EventCreate(
                    session_id=session.id,
                    event_type=models.EventTypes.failed_join,
                    from_player=-1,
                    to_player=-1,
                    event_data={},
                ),
            )
            return
        else:
            await websocket.send_json({"type": "connection_accepted"})
    else:
        await websocket.send_json({"type": "connection_accepted"})

    await websocket.send_json({"type": "player_info_request"})
    while True:
        try:

            player_info = await websocket.receive_json()
            if player_info["type"] == "player_info":
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
        print(f"Player {player_id} already joined")
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
    #  TODO: parse multidata and determine progressive and/or retro mode per player
    # Adjust items send depending on modes

    # events_to_send = Queue()
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
            new_event["data"]["item_name"] = loc_data.item_table[
                str(target_event.item_id)
            ]
            new_event["data"]["event_idx"] = list(target_event.id.to_bytes(2, "big"))

        events_to_send.append(new_event)

    checked_locations = set()

    for p_event in crud.get_events_from_player(db, session.id, player_id):
        if p_event.event_type == models.EventTypes.new_item:
            checked_locations.add(p_event.location)

    try:
        while True:
            # while not events_to_send.empty():
            if len(events_to_send) > 0:
                # event_to_send = events_to_send.get()
                new_items = [x for x in events_to_send if x["type"] == "new_item"]
                events_to_send = [x for x in events_to_send if x["type"] != "new_item"]
                events_to_send.append(
                    {
                        "type": "new_items",
                        "data": [x["data"] for x in new_items],
                    }
                )

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
                        print(
                            f"Location not in multidata_locs: Player {player_id} - {location} [{loc_id}]"
                        )
                        continue
                    item_id, item_player = multidata_locs[(loc_id, player_id)]

                    if loc_id not in checked_locations:
                        print(
                            f"New Location Checked (Player {player_id}): {location} [{loc_id}]"
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
                                event_data={},
                            ),
                        )
                        checked_locations.add(loc_id)

                # Compare all events for the player with their sram to see if they need to be sent any items (save scummed)

                to_player_events = crud.get_events_for_player(db, session.id, player_id)
                # player_inv = sram.get_inventory(new_sram)
                last_event = int.from_bytes(new_sram["multiinfo"])

                for event in to_player_events:
                    if event.id <= last_event:
                        continue
                    if event.event_type != models.EventTypes.new_item:
                        continue
                    # Don't send players items from their own games
                    if event.from_player == player_id or event.to_player != player_id:
                        continue
                    item_name = loc_data.item_table[str(event.item_id)]
                    # if event.id <= new_sram['multiinfo']

                    # else:
                    print(
                        f"Player doesn't have {item_name} from {event.from_player} id: {event.id}. Resending"
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
