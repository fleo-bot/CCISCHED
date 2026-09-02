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
    db_url = os.environ.get(
        "DATABASE_URL",
        "sqlite:///ccisched.db"   # dev fallback — no Postgres install needed
    )

    # Heroku / Railway ship postgres:// but SQLAlchemy needs postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"]        = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"]      = {
        "pool_pre_ping": True,          # auto-reconnect on stale connections
        "pool_recycle":  300,
    }

    db.init_app(app)
