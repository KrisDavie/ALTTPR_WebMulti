import datetime

from asyncio import sleep
from fastapi import Depends
from sqlalchemy.orm import Session
from typing import Annotated

from . import models, schemas, crud
from .dependencies import get_db

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


def sanitize_chat_message(message: str):
    if message.startswith('/'):
        command = message.split(' ')
        if command[0] == '/countdown':
            final_message = command[0]
            if len(command) > 1:
                try:
                    final_message = ' '.join(command[0], int(command[1]))
                except:
                    pass
        else:
            final_message = command[0]
    else:
        final_message = message
    return final_message[:1000]