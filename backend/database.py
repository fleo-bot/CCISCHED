"""
database.py
-----------
SQLAlchemy instance + configuration helper.

Usage in app.py:
    from database import db
    db.init_app(app)
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def configure_db(app):
    """
    Attach database config to the Flask app.
    Reads DATABASE_URL from environment (set in .env).
    Falls back to a local SQLite file for development.
    """
    import os
    from pathlib import Path
    from dotenv import load_dotenv

    # Explicitly load backend/.env regardless of the current working
    # directory the app was launched from — without this, DATABASE_URL
    # is never picked up and everything silently falls back to SQLite.
    load_dotenv(Path(__file__).parent / ".env")

    db_url = os.environ.get(
        "DATABASE_URL",
        "sqlite:///ccisched.db"   # dev fallback — no MySQL install needed
    )

    # Plain "mysql://" (e.g. copied from a hosting provider) needs to be
    # pointed at the PyMySQL driver explicitly for SQLAlchemy.
    if db_url.startswith("mysql://"):
        db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)

    engine_options = {
        "pool_pre_ping": True,          # auto-reconnect on stale connections
        "pool_recycle":  300,
    }

    # MySQL defaults to latin1 unless told otherwise — force utf8mb4 so
    # names, remarks, etc. can safely contain any Unicode character.
    if db_url.startswith("mysql"):
        engine_options["connect_args"] = {"charset": "utf8mb4"}

    app.config["SQLALCHEMY_DATABASE_URI"]        = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"]      = engine_options

    db.init_app(app)
