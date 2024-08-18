from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLALCHEMY_DATABASE_URL = "sqlite:////data/sql_app.db"
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@db/postgres"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_size=512, max_overflow=100)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()