import asyncio
import datetime
import json
import logging
import time

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect
)
from fastapi.websockets import WebSocketState

from sqlalchemy.orm import Session
from sqlalchemy import event as listen_event

from server import crud, models, schemas, sram
from server.data import data as loc_data
from server.logging import logging_config
from server.dependencies import get_db
from server.utils import system_chat, countdown

logger = logging.getLogger(__name__)
logging.config.dictConfig(logging_config)

router = APIRouter()

@router.websocket("/ws/{mw_session_id}")
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
                    elif command[0] == "/missing":
                        all_player_events = crud.get_events_from_player(db, session.id, player_id)
                        all_player_events = [x for x in all_player_events if x.event_type == models.EventTypes.new_item]
                        all_player_locations = set([x[0][0] for x in multidata["locations"] if x[0][1] == player_id])
                        for event in all_player_events:
                            if event.location in all_player_locations:
                                all_player_locations.remove(event.location)
                        missing_locs = [loc_data.lookup_id_to_name[str(x)] for x in all_player_locations]
                        system_chat(
                            f"Missing locations:",
                            session,
                            db,
                            private=player_id,
                        ) 
                        for loc in missing_locs:
                            system_chat(
                                f"    {loc}",
                                session,
                                db,
                                private=player_id,
                            )

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
