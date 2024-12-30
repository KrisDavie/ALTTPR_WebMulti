from .database import SessionLocal

def get_db():
    db = SessionLocal()
    db.expire_on_commit = False
    try:
        yield db
    finally:
        db.close()