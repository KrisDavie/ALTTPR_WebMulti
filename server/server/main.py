import json
from queue import Queue
import zlib
from typing import Annotated
from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, File, Form

import asyncio
from fastapi.websockets import WebSocketState

from sqlalchemy.orm import Session

from sqlalchemy import event


from . import crud, models, schemas
from .database import SessionLocal, engine
# from .data.locs import location_table_uw_by_room, multi_location_table
from .data import data as loc_data

app = FastAPI(
    title="ALTTPR Multiworld Server",
    description="A server for ALTTPR Multiworld",
    version="0.1.0",
    root_path="/api/v1",
)


# models.Base.metadata.drop_all(bind=engine)
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
    # Does game exist in the database?
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
            event_type=models.EventTypes.create,
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

    player_id = int(player_info["player_id"])
    player_name = player_info["player_name"]

    # Get all events for the session of either join or leave for this player
    conn_events = crud.get_player_connection_events(db, session.id, player_id)
    if len(conn_events) > 0 and conn_events[0].event_type == models.EventTypes.join:
        print(f"Player {player_id} already joined")
        await websocket.close(reason="Player already joined")

    # Log join event
    crud.create_event(
        db,
        schemas.EventCreate(
            session_id=session.id,
            event_type=models.EventTypes.join,
            from_player=player_id,
            to_player=-1,
            item_id=-1,
            location=-1,
            event_data={"player_id": player_id, "player_name": player_name},
        ),
    )

    multidata = session.mwdata
    multidata_locs = {tuple(d[0]): tuple(d[1]) for d in multidata["locations"]}

    events_to_send = Queue()
    should_close = False

    # This listens for new events and sends them to the client, it's never actually called itself
    @event.listens_for(models.Event, "after_insert")
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
        events_to_send.put({"type": "new_item", "data": target_event.event_data})

    checked_locations = set()

    for p_event in crud.get_events_from_player(db, session.id, player_id):
        if p_event.event_type == models.EventTypes.item_send:
            checked_locations.add(p_event.location)

    try:
        while True:
            while not events_to_send.empty():
                event_to_send = events_to_send.get()
                await websocket.send_json(event_to_send)
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
                sram_diff = {
                    k: {
                        ix: dv
                        for ix, dv in enumerate(v)
                        if dv != old_sram[k][ix]  # and ix not in ignore_mask[k]
                    }
                    for k, v in new_sram.items()
                    if v != old_sram[k]
                }

                if len(sram_diff) == 0:
                    continue

                for loc_group, diff_data in sram_diff.items():
                    for mem_loc, _ in diff_data.items():
                        locations = []
                        if loc_group in ['base', 'pots', 'sprites']:
                            if loc_group in ['base']:
                                room_id = int(mem_loc) // 2
                            elif loc_group in ['pots', 'sprites']:
                                room_id = int(mem_loc) if int(mem_loc) % 2 == 0 else int(mem_loc) - 1
                                mem_loc = room_id
                            else:
                                room_id = int(mem_loc)
                            if not room_id in loc_data.location_info_by_room[loc_group]:
                                continue
                            room_data = new_sram[loc_group][mem_loc] | (
                                new_sram[loc_group][mem_loc + 1] << 8
                            )
                            for name, mask in loc_data.location_info_by_room[loc_group][room_id]:
                                if room_data & mask != 0:
                                    locations.append(name)

                        elif loc_group == 'overworld':
                            try:
                                name = loc_data.location_info_reversed[loc_group][mem_loc]
                                if new_sram[loc_group][mem_loc] & 0x40 != 0:
                                    locations.append(name)
                            except KeyError:
                                print(f"KeyError: {mem_loc}")
                                continue

                        elif loc_group == 'npcs':
                            npc_data = new_sram[loc_group][0] | (
                                new_sram[loc_group][1] << 8)
                            for name, mask in loc_data.location_info[loc_group].items():
                                if npc_data & mask != 0:
                                    locations.append(name)

                        elif loc_group == 'misc':
                            for name, mask in loc_data.location_info_by_room[loc_group][mem_loc + 0x3c6]:
                                if new_sram[loc_group][mem_loc] & mask != 0:
                                    locations.append(name)

                        elif loc_group == 'shops':
                            name = loc_data.location_info_reversed[loc_group][0x400000 + mem_loc]
                            if int(new_sram[loc_group][mem_loc]) > 0:
                                locations.append(name)

                        for location in locations:
                            loc_id = int(loc_data.lookup_name_to_id[location])
                            print(f"Location Checked: {location} [{loc_id}]")

                            if (loc_id, player_id) not in multidata_locs:
                                print(f"Location not in multidata_locs: Player {player_id} - {location} [{loc_id}]")
                                continue
                            item_id, item_player = multidata_locs[
                                (loc_id, player_id)
                            ] 

                            if loc_id not in checked_locations:
                                crud.create_event(
                                    db,
                                    schemas.EventCreate(
                                        session_id=session.id,
                                        event_type=models.EventTypes.item_send,
                                        from_player=player_id,
                                        to_player=item_player,
                                        item_id=item_id,
                                        location=loc_id,
                                        event_data={
                                        }, 
                                    ),
                                )
                                checked_locations.add(loc_id)
                            else:
                                print(f"Location already checked: {location} [{loc_id}]")
                continue
    except WebSocketDisconnect:
        crud.create_event(
            db,
            schemas.EventCreate(
                session_id=session.id,
                event_type=models.EventTypes.leave,
                from_player=player_id,
                to_player=-1,
                item_id=-1,
                location=-1,
                event_data={"player_id": player_id, "player_name": player_name},
            ),
        )
