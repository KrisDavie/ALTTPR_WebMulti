import json
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as postgres_upsert
from sqlalchemy import or_

from . import models, schemas

ignore_mask = {
}

def get_games(db: Session, skip: int = 0, limit: int = 100):
    if limit <= 0:
        return db.query(models.Game).offset(skip).all()
    return db.query(models.Game).offset(skip).limit(limit).all()


def get_all_sessions(db: Session, skip: int = 0, limit: int = 100, game_id: int = None):
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
    db: Session, skip: int = 0, limit: int = 100, session_id: str = None
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


def get_events_for_player(db: Session, player_id: int, skip: int = 0, limit: int = 100):
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.to_player == player_id)
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.to_player == player_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_events_from_player(
    db: Session, session_id: str, player_id: int, skip: int = 0, limit: int = 100
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
    # Create the insert event using the upsert method and IGNORE errors on conflict
    # TODO: This skips the ORM event, can we do this with the ORM? Or can we get the event from this?
    # db_event = postgres_upsert(models.Event).values(**event.model_dump())
    # db_event = db_event.on_conflict_do_nothing(index_elements=["session_id", "from_player", "to_player", "item_id", "location"])
    # db.execute(db_event)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
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
        print(e)
        create_sramstore(db, sramstore)
        return ({k: [0 for x in range(len(v))] for k, v in json.loads(sramstore.sram).items()}, json.loads(sramstore.sram))


def get_player_connection_events(db: Session, session_id: str, player_id: int):
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.to_player == player_id)
        .filter(or_(models.Event.event_type == models.EventTypes.join, models.Event.event_type == models.EventTypes.leave))
        # .all()
        .order_by(models.Event.timestamp.desc())
        .all()
        # .first()
    )