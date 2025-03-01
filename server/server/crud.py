import datetime
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as postgres_upsert
from sqlalchemy import func, or_

from . import models, schemas

ignore_mask = {}

logger = logging.getLogger(__name__)


def add_log_entry(db: Session, log_entry: schemas.LogEntryCreate):
    db_log_entry = models.Log(**log_entry.model_dump())
    db.add(db_log_entry)
    db.commit()
    db.refresh(db_log_entry)
    return db_log_entry


def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def set_bot_username(db: Session, user_id: int, username: str):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_user.username = username
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user: schemas.User):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_user.username = user.username
    db_user.email = user.email
    db_user.supporter = user.supporter
    db_user.colour = user.colour
    db_user.avatar = user.avatar
    db_user.discord_username = user.discord_username
    db_user.discord_display_name = user.discord_display_name
    db_user.is_superuser = user.is_superuser
    db_user.username_as_player_name = user.username_as_player_name
    db_user.bots = user.bots
    db_user.api_keys = user.api_keys
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_discord_display_name(db: Session, user_id: int, display_name: str):
    """
    This is a migration function to update the discord display name for a user after we added the ability to change usernames
    """
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_user.discord_display_name = display_name
    db.commit()
    db.refresh(db_user)
    return db_user


def update_discord_user(
    db: Session, user_id: int, discord_user: schemas.DiscordAPIUser
):
    existing_discord_user = (
        db.query(models.User)
        .filter(models.User.discord_id == discord_user["id"])
        .one_or_none()
    )
    db_user = db.query(models.User).filter(models.User.id == user_id).first()

    if existing_discord_user == db_user:
        # Just need to update user details from discord
        db_user.discord_display_name = discord_user["global_name"]
        db_user.avatar = discord_user["avatar"]
        db_user.email = discord_user["email"]
        db_user.discord_username = discord_user["username"]
        db_user.refresh_token = discord_user["refresh_token"]
        db.commit()
        db.refresh(db_user)
        return db_user

    # If the user hasn't logged in before
    if not existing_discord_user:
        existing_username_user = (
            db.query(models.User)
            .filter(models.User.username == discord_user["global_name"])
            .count()
        )
        if existing_username_user > 0:
            db_user.username = discord_user["username"]
        else:
            db_user.username = discord_user["global_name"]
        db_user.discord_display_name = discord_user["global_name"]
        db_user.avatar = discord_user["avatar"]
        db_user.email = discord_user["email"]
        db_user.discord_username = discord_user["username"]
        db_user.discord_id = discord_user["id"]
        db_user.refresh_token = discord_user["refresh_token"]
        db.commit()
        db.refresh(db_user)
        return db_user

    if db_user.parent_account_id != None:
        raise Exception("User already linked to a discord account")

    # If the user _has_ logged in before
    # Update user details from discord and assign parent ID
    existing_discord_user.discord_display_name = discord_user["global_name"]
    existing_discord_user.avatar = discord_user["avatar"]
    existing_discord_user.email = discord_user["email"]
    existing_discord_user.discord_username = discord_user["username"]
    existing_discord_user.discord_id = discord_user["id"]
    existing_discord_user.refresh_token = discord_user["refresh_token"]
    existing_discord_user.session_tokens = (
        existing_discord_user.session_tokens + db_user.session_tokens
    )
    db_user.session_tokens = []
    db_user.parent_account_id = existing_discord_user.id

    # Update all sessions to the new user
    for session in db_user.owned_sessions:
        # We need to insert the new discord user in the same position as the old user because we assume owner 0 is the creator
        owner_ix = session.owners.index(db_user)
        session.owners.remove(db_user)
        session.owners.insert(owner_ix, existing_discord_user)

    for session in db_user.sessions:
        session.users.remove(db_user)
        session.users.append(existing_discord_user)

    db.commit()
    db.refresh(existing_discord_user)
    db.refresh(db_user)
    return existing_discord_user


def update_user_session_token(
    db: Session, user_id: int, session_token: str, old_session_token: str
):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if old_session_token in db_user.session_tokens:
        db_user.session_tokens.remove(old_session_token)
    # Just using append doesn't seem to work, so we'll just add the new token to a new list
    db_user.session_tokens = db_user.session_tokens + [session_token]
    db.commit()
    db.refresh(db_user)
    return db_user


def add_api_key(
    db: Session, owner_id: int, user_id: int, api_key: schemas.APIKeyCreate
):
    db_owner = db.query(models.User).filter(models.User.id == owner_id).first()
    if not db_owner:
        raise Exception("Owner not found")
    if (
        user_id not in [owner_id] + [x.id for x in db_owner.bots]
        and not db_owner.is_superuser
    ):
        raise Exception("Authorization error")

    db_api = models.APIKey(**api_key.model_dump(), user_id=user_id)
    db.add(db_api)
    db.commit()
    db.refresh(db_api)
    return db_api


def update_api_key_used(db: Session, api_key: str):
    db_api = db.query(models.APIKey).filter(models.APIKey.key == api_key).first()
    db_api.last_used = func.clock_timestamp()
    db.commit()
    db.refresh(db_api)
    return db_api


def revoke_api_key(db: Session, owner_id: int, bot_id: int, api_key_id: int):
    db_owner = db.query(models.User).filter(models.User.id == owner_id).first()
    if not db_owner:
        raise Exception("Owner not found")
    if (
        bot_id not in [owner_id] + [x.id for x in db_owner.bots]
        and not db_owner.is_superuser
    ):
        raise Exception("Authorization error")

    db_api = db.query(models.APIKey).filter(models.APIKey.id == api_key_id).first()
    db.delete(db_api)
    db.commit()
    return True


def get_user_by_api_key(db: Session, api_key: str):
    return (
        db.query(models.User)
        .filter(models.User.api_keys.any(models.APIKey.key == api_key))
        .first()
    )


def delete_bot(db: Session, bot_id: int):
    db_bot = db.query(models.User).filter(models.User.id == bot_id).first()
    if not db_bot:
        return False
    db_bot.parent_account_id = None
    db_bot.bot_owner_id = None

    for apikey in db_bot.api_keys:
        db.delete(apikey)

    db.commit()
    db.refresh(db_bot)
    return True


def delete_user(db: Session, user_id: int):
    # We're not going to delete the user, but we will purge all of their data
    # We also need to store a record that this user was deleted
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return False

    db_user.session_tokens = []
    db_user.email = None
    db_user.username = None
    db_user.avatar = None
    db_user.discord_id = None
    db_user.discord_username = None
    db_user.discord_display_name = None
    db_user.refresh_token = None
    db_user.username_as_player_name = False
    db_user.supporter = False
    db_user.colour = None
    return True


def remove_user_session_token(db: Session, user_id: int, session_token: str):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if session_token in db_user.session_tokens:
        db_user.session_tokens.remove(session_token)
    db.commit()
    db.refresh(db_user)
    return


def get_games(db: Session, skip: int = 0, limit: int = 0):
    if limit <= 0:
        return db.query(models.Game).offset(skip).all()
    return db.query(models.Game).offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_discord_id(db: Session, discord_id: str):
    return db.query(models.User).filter(models.User.discord_id == discord_id).first()


def add_owner_to_session(db: Session, session_id: str, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_session = (
        db.query(models.MWSession).filter(models.MWSession.id == session_id).first()
    )
    if db_user in db_session.owners:
        return db_session, db_user
    logger.debug(f"Adding user {db_user.id} to session {db_session.id}")
    db_session.owners.append(db_user)
    db.commit()
    db.refresh(db_session)
    db.refresh(db_user)
    logger.debug(
        f"Added user {db_user.id} to session {db_session.id}, owners: {db_session.owners}"
    )
    return db_session, db_user


def add_user_to_session(
    db: Session, session_id: str, user_id: int, player_id: int
) -> tuple[models.MWSession, models.User]:
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_session = (
        db.query(models.MWSession).filter(models.MWSession.id == session_id).first()
    )
    assoc = models.UserSessions(player_id=player_id)
    db_user.sessions.append(assoc)
    db_session.users.append(assoc)
    db.commit()
    db.refresh(db_user)
    db.refresh(db_session)

    return db_session, db_user


def get_session(db: Session, session_id: str):
    return db.query(models.MWSession).filter(models.MWSession.id == session_id).first()


def get_sessions(db: Session, skip: int = 0, limit: int = 0, game_id: int = 1):
    all_sessions = db.query(models.MWSession).filter(
        models.MWSession.game_id == game_id
    )
    if limit <= 0:
        return all_sessions.offset(skip).all()
    return all_sessions.offset(skip).limit(limit).all()


def get_user_sessions(db: Session, user_id: int, skip: int = 0, limit: int = 0):
    # Owned and joined sessions
    all_sessions = db.query(models.MWSession).filter(
        models.MWSession.owners.any(models.User.id == user_id)
        | models.MWSession.users.any(models.User.id == user_id)
    )
    if limit <= 0:
        return all_sessions.offset(skip).all()
    return all_sessions.offset(skip).limit(limit).all()


def get_user_session_links(db: Session, session_id: str):
    return (
        db.query(models.UserSessions)
        .filter(models.UserSessions.session_id == session_id)
        .all()
    )


def create_user_session_link(
    db: Session, user_id: int, session_id: str, player_id: str
):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    db_session = (
        db.query(models.MWSession).filter(models.MWSession.id == session_id).first()
    )

    if not db_user or not db_session:
        return False

    db_user_session = models.UserSessions(
        user_id=user_id, session_id=session_id, player_id=player_id
    )
    db.add(db_user_session)
    db.commit()
    db.refresh(db_user_session)
    return db_user_session


def get_last_event(db: Session, session_id: str):
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .order_by(models.Event.timestamp.desc())
        .first()
    )


def get_events(db: Session, skip: int = 0, limit: int = 0, session_id: str = None):
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


def get_events_after_frametime(
    db: Session,
    session_id: str,
    player_id: int,
    frame_time: int,
    skip: int = 0,
    limit: int = 0,
) -> list[models.Event]:
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.from_player == player_id)
            .filter(models.Event.frame_time >= frame_time)
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.from_player == player_id)
        .filter(models.Event.frame_time >= frame_time)
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_events_frametime(
    db: Session,
    session_id: str,
    player_id: int,
    events: list[schemas.EventCreate],
    frame_time: int,
):
    for event in events:
        db_event = (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.from_player == player_id)
            .filter(models.Event.id == event.id)
            .first()
        )
        db_event.frame_time = frame_time
    db.commit()
    return True


def get_items_for_player_from_others(
    db: Session,
    session_id: str,
    player_id: int,
    gt_idx: int = 0,
    skip: int = 0,
    limit: int = 0,
) -> list[models.Event]:
    if limit <= 0:
        return (
            db.query(models.Event)
            .filter(models.Event.session_id == session_id)
            .filter(models.Event.to_player == player_id)
            .filter(models.Event.event_type == models.EventTypes.new_item)
            .filter(models.Event.from_player != player_id)
            .filter(models.Event.to_player_idx > gt_idx)
            .order_by(models.Event.to_player_idx.asc())
            .offset(skip)
            .all()
        )
    return (
        db.query(models.Event)
        .filter(models.Event.session_id == session_id)
        .filter(models.Event.to_player == player_id)
        .filter(models.Event.event_type == models.EventTypes.new_item)
        .filter(models.Event.from_player != player_id)
        .filter(models.Event.to_player_idx > gt_idx)
        .order_by(models.Event.to_player_idx.asc())
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


def create_game(db: Session, game: schemas.GameCreate):
    db_game = models.Game(**game.model_dump())
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game


def create_session(
    db: Session,
    session: schemas.MWSessionCreate,
    user_id: int,
    admins: list[models.User] = [],
):
    db_session = models.MWSession(**session.model_dump())
    if not user_id:
        raise Exception("User ID is required to create a session")
    db_session.owners.append(
        db.query(models.User).filter(models.User.id == user_id).first()
    )
    for admin in admins:
        db_session.owners.append(admin)

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


def create_forfeit_events(
    db: Session, session_id: str, events: list[schemas.EventCreate]
):
    # Get the last event for each player from the db
    # session = get_session(db, session_id)
    # players = [x + 1 for x, _ in enumerate(session.mwdata["names"][0])]
    # last_events = db.query(models.Event).filter(models.Event.session_id == session_id).order_by(models.Event.to_player).order_by(models.Event.to_player_idx.asc()).distinct(models.Event.to_player).all()
    # last_event_map = {event.to_player: event.to_player_idx for event in last_events}
    # for player in players:
    #     if player not in last_event_map:
    #         last_event_map[player] = 0
    #     else:
    #         if type(last_event_map[player]) != int:
    #             last_event_map[player] = 0
    # Create the forfeit events
    for event in events:
        if event.to_player != event.from_player:
            # event.to_player_idx = last_event_map[event.to_player]
            # last_event_map[event.to_player] += 1

            # This will hit the db for each event, but it should be fine since we're only doing this for forfeit events
            last_event = (
                db.query(models.Event)
                .filter(models.Event.session_id == session_id)
                .filter(models.Event.to_player == event.to_player)
                .filter(models.Event.to_player_idx != None)
                .order_by(models.Event.to_player_idx.desc())
                .first()
            )
            if last_event:
                event.to_player_idx = last_event.to_player_idx + 1
            else:
                event.to_player_idx = 1
        ff_event = models.Event(**event.model_dump())

        # TODO: This could probably be dealt with better, but should be good for now.
        while True:
            try:
                db.add(ff_event)
                db.commit()
                db.refresh(ff_event)
                break
            except Exception as e:
                logger.error(f"Error creating event: {e}")
                db.rollback()
                ff_event.to_player_idx += 1

    # try:
    #     db.commit()
    #     return True
    # except Exception as e:
    #     logger.error(f"Error creating forfeit events: {e}")
    #     db.rollback()
    #     return False


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
        db_sramstore.updated_at = datetime.datetime.now()
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
