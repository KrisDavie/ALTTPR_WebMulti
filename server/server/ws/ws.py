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
    WebSocketDisconnect,
)
from fastapi.websockets import WebSocketState

import server.main as main
from sqlalchemy.orm import Session
from sqlalchemy import event as listen_event

from server import crud, models, schemas, sram
from server.data import data as loc_data
from server.logging import logging_config
from server.dependencies import get_db
from server.utils import system_chat, sanitize_chat_message, countdown, user_allowed_in_session

logger = logging.getLogger(__name__)
logging.config.dictConfig(logging_config)

router = APIRouter()

# SPECIAL PLAYER IDS:
# -1: System
# -2: User lookup (not a player)


@router.websocket("/ws/{mw_session_id}")
async def websocket_endpoint(
    websocket: WebSocket, mw_session_id: str, db: Annotated[Session, Depends(get_db)]
):
    await websocket.accept()
    session = crud.get_session(db, mw_session_id)

    connection_init_time = time.time()

    user_type = None

    if not session:
        await websocket.close(reason="Session not found", code=4404)
        return

    # Security check
    if session.session_password != None:
        password = await websocket.receive_text()
        if password != session.session_password:
            await websocket.close(reason="Invalid password", code=4403)
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
                await websocket.close(reason="Player info not received", code=4403)
                return
            player_info = await websocket.receive_json()
            if player_info["type"] == "player_info":
                user_type = "player"
                time.sleep(0.1)
                break
            elif player_info["type"] == "user_info":
                user_type = "non_player"
                time.sleep(0.1)
                break
        except WebSocketDisconnect:
            return

    try:
        player_id = int(player_info["player_id"])
    except KeyError:
        await websocket.close(reason="Player info not received", code=4403)
        return

    multidata = session.mwdata

    mw_rom_names = [x[2] for x in multidata["roms"]]
    player_names = [x for x in multidata["names"][0]]

    if user_type == "player" and (
        ("rom_name" not in player_info)
        or ([ord(x) for x in player_info["rom_name"]] not in mw_rom_names)
    ):
        await websocket.send_json(
            {"type": "non_player_detected", "message": "No/Wrong ROM found"}
        )
        user_type = "non_player"

    user, token = main.verify_session_token(
        None,
        None,
        db,
        auth_only=True,
        from_ws={
            "user_id": player_info["user_id"],
            "session_token": player_info["session_token"],
        },
    )

    allowed = user_allowed_in_session(session, user)
    if not allowed:
        await websocket.close(reason="Authorized users only", code=4403)
        return

    if user_type == "player":
        player_name = player_names[player_id - 1]

        user_session_links = crud.get_user_session_links(db, session.id)
        player_links = [x for x in user_session_links if x.player_id == player_id]
        player_link = player_links[0] if len(player_links) > 0 else None

        if player_link and user and player_link.user_id != user.id:
            await websocket.close(reason=f"Player {player_id} already claimed!", code=4409)

        # Only allow players to be locked by logged in users
        if not player_link and user and user.discord_id != None:
            session, user = crud.add_user_to_session(db, session.id, user.id, player_id)

    elif user_type == "non_player":
        if not user:
            await websocket.close(reason="No user info detected", code=4401)
            return
        player_id = -2
        player_name = user.username

    # Get all events for the session of either join or leave for this player
    conn_events = crud.get_player_connection_events(db, session.id, player_id)
    if (
        user_type == "player"
        and len(conn_events) > 0
        and conn_events[0].event_type == models.EventTypes.player_join
    ):
        logger.warning(f"{player_name} already joined")
        await websocket.close(reason="Player already joined", code=4409)
        return

    # Log join event
    if user_type == "player":
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
    else:
        crud.create_event(
            db,
            schemas.EventCreate(
                session_id=session.id,
                event_type=models.EventTypes.user_join_chat,
                from_player=-2,
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
    processing_sram = False

    await websocket.send_json({"type": "flags", "data": session.flags})

    if user_type == "player":
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

        if target_event.event_type == models.EventTypes.player_kicked:
            if target_event.to_player == player_id:
                should_close = True

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

                # We do this at the end, so that we can include the kicked message as an event.
                # We'll use this on the frontend to close the connection and direct the user away from the session
                if should_close:
                    await websocket.close(reason="Should close", code=4400)
                    raise WebSocketDisconnect

            # Wait for a message from the client, but only for 1.5 seconds, then we loop back to the top and process events from other players
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
                ev_data = {"message": sanitize_chat_message(payload["data"]), "type": "chat"}
                if user_type == "non_player":
                    ev_data["user_id"] = user.id

                if session.flags["chat"] == False:
                    if not payload["data"].startswith("/") or payload["data"].split(
                        " "
                    )[0] not in [
                        "/countdown",
                        "/missing",
                    ]:  # TODO: Move this to a list variable somewher
                        system_chat(
                            "Chat is disabled in this session",
                            session,
                            db,
                            private=player_id,
                        )
                        continue

                # Check for commands
                ev = crud.create_event(
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
                        if session.flags["missingCmd"] == False:
                            system_chat(
                                "The /missing command is disabled in this session",
                                session,
                                db,
                                private=player_id,
                            )
                            continue
                        all_player_events = crud.get_events_from_player(
                            db, session.id, player_id
                        )
                        all_player_events = [
                            x
                            for x in all_player_events
                            if x.event_type == models.EventTypes.new_item
                        ]
                        all_player_locations = set(
                            [
                                x[0][0]
                                for x in multidata["locations"]
                                if x[0][1] == player_id
                            ]
                        )
                        for event in all_player_events:
                            if event.location in all_player_locations:
                                all_player_locations.remove(event.location)
                        missing_locs = [
                            loc_data.lookup_id_to_name[str(x)]
                            for x in all_player_locations
                        ]
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
            elif payload["type"] == "control":
                if payload["data"]["type"] == "kick":
                    if not user.is_superuser and user not in session.owners:
                        system_chat(
                            "You do not have permission to kick players.",
                            session,
                            db,
                            private=player_id,
                        )
                        continue
                    player_to_kick = payload["data"]["player_id"]
                    if player_to_kick == player_id:
                        system_chat(
                            "You cannot kick yourself",
                            session,
                            db,
                            private=player_id,
                        )
                        continue
                    if player_to_kick <= 0 or player_to_kick > len(player_names):
                        system_chat(
                            "Could not find player to kick",
                            session,
                            db,
                            private=player_id,
                        )
                        continue
                    ev = crud.create_event(
                        db,
                        schemas.EventCreate(
                            session_id=session.id,
                            event_type=models.EventTypes.player_kicked,
                            from_player=player_id,
                            to_player=player_to_kick,
                            item_id=-1,
                            location=-1,
                            event_data={"player_id": player_to_kick},
                        ),
                    )
                    await time.sleep(2.0)
                    conn_events = crud.get_player_connection_events(db, session.id, player_to_kick)
                    if (
                        len(conn_events) > 0
                        and conn_events[0].event_type == models.EventTypes.player_join
                    ):
                        ev = crud.create_event(
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
                    continue

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
                frame_time = (
                    new_sram["total_time"][2] << 16
                    | new_sram["total_time"][1] << 8
                    | new_sram["total_time"][0]
                )
                old_frame_time = (
                    old_sram["total_time"][2] << 16
                    | old_sram["total_time"][1] << 8
                    | old_sram["total_time"][0]
                )

                if frame_time < old_frame_time:
                    logger.debug(
                        f"{player_name} - Frame time went backwards - Save scum or reset"
                    )
                    events_to_update = crud.get_events_after_frametime(
                        db, session.id, player_id, frame_time
                    )
                    crud.update_events_frametime(
                        db, session.id, player_id, events_to_update, None
                    )
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

                    if loc_id not in checked_locations or (
                        checked_locations[loc_id] != None
                        and (
                            (checked_locations[loc_id] < frame_time)
                            and session.flags["duping"]
                        )
                    ):
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
        if user_type == "player":
            # Log leave event
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
