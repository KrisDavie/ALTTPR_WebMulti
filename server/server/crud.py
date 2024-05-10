import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as postgres_upsert
from sqlalchemy import or_

from . import models, schemas

ignore_mask = {}

logger = logging.getLogger(__name__)

def get_games(db: Session, skip: int = 0, limit: int = 0):
    if limit <= 0:
        return db.query(models.Game).offset(skip).all()
    return db.query(models.Game).offset(skip).limit(limit).all()


def get_all_sessions(db: Session, skip: int = 0, limit: int = 0, game_id: int = None):
    if limit <= 0:
        if game_id:
            return (
                db.query(models.MWSession)
                .filter(models.MWSession.game_id == game_id)
                .offset(skip)
                .all()
            )
        return db.query(models.MWSession).offset(skip).all()
    if game_id:
        return (
            db.query(models.MWSession)
            .filter(models.MWSession.game_id == game_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    return db.query(models.MWSession).offset(skip).limit(limit).all()


def get_all_events(
    db: Session, skip: int = 0, limit: int = 0, session_id: str = None
):
    if limit <= 0:
        if session_id:
            return (
                db.query(models.Event)
                .filter(models.Event.session_id == session_id)
                .offset(skip)
                .all()
            )
        return db.query(models.Event).offset(skip).all()
    if session_id:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    return db.query(models.Event).offset(skip).limit(limit).all()


def get_events_for_player(
    db: Session, session_id: str, player_id: int, skip: int = 0, limit: int = 0
) -> list[models.Event]:
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.to_player == player_id)
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.to_player == player_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_items_for_player_from_others(
    db: Session, session_id: str, player_id: int, skip: int = 0, limit: int = 0
) -> list[models.Event]:
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.to_player == player_id)
            .filter(models.Event.event_type == models.EventTypes.new_item)
            .filter(models.Event.from_player != player_id)
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.to_player == player_id)
        .filter(models.Event.event_type == models.EventTypes.new_item)
        .filter(models.Event.from_player != player_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_events_from_player(
    db: Session, session_id: str, player_id: int, skip: int = 0, limit: int = 0
):
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.from_player == player_id)
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.from_player == player_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_game(db: Session, game_name: str):
    return db.query(models.Game).filter(models.Game.title == game_name).first()


def get_session(db: Session, session_id: str):
    return db.query(models.MWSession).filter(models.MWSession.id == session_id).first()


def create_game(db: Session, game: schemas.GameCreate):
    db_game = models.Game(**game.model_dump())
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game


def create_session(db: Session, session: schemas.MWSessionCreate):
    db_session = models.MWSession(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def create_event(db: Session, event: schemas.EventCreate):
    db_event = models.Event(**event.model_dump())
    # If this is a new item, find the last item sent to the player from other players and increment the to_player_idx by 1
    if db_event.event_type == models.EventTypes.new_item:
        if not db_event.to_player == db_event.from_player:
            last_item = (
                db.query(models.Event)
                .filter(models.Event.session_id == event.session_id)
                .filter(models.Event.to_player == event.to_player)
                .filter(models.Event.from_player != event.to_player)
                .filter(models.Event.event_type == models.EventTypes.new_item)
                .order_by(models.Event.timestamp.desc())
                .first()
            )
            if last_item:
                db_event.to_player_idx = last_item.to_player_idx + 1
            else:
                db_event.to_player_idx = 1
    while True:
        try:
            db.add(db_event)
            db.commit()
            db.refresh(db_event)
            break
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            db.rollback()
            db_event.to_player_idx += 1
    return db_event


def create_sramstore(db: Session, sramstore: schemas.SRAMStoreCreate):
    db_sramstore = models.SRAMStore(**sramstore.model_dump())
    db.add(db_sramstore)
    db.commit()
    db.refresh(db_sramstore)
    return db_sramstore


def update_sramstore(db: Session, sramstore: schemas.SRAMStoreCreate):
    # get the existing sramstore
    try:
        db_sramstore = (
            db.query(models.SRAMStore)
            .filter(models.SRAMStore.session_id == sramstore.session_id)
            .filter(models.SRAMStore.player == sramstore.player)
            .first()
        )
        if not db_sramstore:
            raise Exception("SRAMStore not found")
        db_sramstore.prev_sram = db_sramstore.sram
        db_sramstore.sram = sramstore.sram
        db.commit()
        db.refresh(db_sramstore)
        old_sram = json.loads(db_sramstore.prev_sram)
        new_sram = json.loads(db_sramstore.sram)
        return (old_sram, new_sram)

    except Exception as e:
        logger.error(f"Error updating sramstore: {e}")
        create_sramstore(db, sramstore)
        return (
            {
                k: [0 for x in range(len(v))]
                for k, v in json.loads(sramstore.sram).items()
            },
            json.loads(sramstore.sram),
        )

def get_sramstore(db: Session, session_id: str, player_id: int):
    return (
        db.query(models.SRAMStore)
        .filter(models.SRAMStore.session_id == session_id)
        .filter(models.SRAMStore.player == player_id)
        .first()
    )

def get_player_connection_events(db: Session, session_id: str, player_id: int):
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.from_player == player_id)
        .filter(
            or_(
                models.Event.event_type == models.EventTypes.player_join,
                models.Event.event_type == models.EventTypes.player_leave,
            )
        )
        # .all()
        .order_by(models.Event.timestamp.desc())
        .all()
        # .first()
    )
