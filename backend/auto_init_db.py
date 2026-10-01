"""
auto_init_db.py
---------------
Automatically initialize database on first startup if tables don't exist.
This is called from app.py on startup to handle production deployments
where we don't have shell access.
"""

import os
from pathlib import Path


def should_auto_init():
    """Check if we should auto-initialize the database.
    Only runs in production when AUTO_INIT_DB env var is set."""
    return os.environ.get("AUTO_INIT_DB", "").lower() == "true"


def auto_init_database(app):
    """Initialize database if it's empty (no tables exist)."""
    if not should_auto_init():
        return
    
    from database import db
    from models import User
    
    with app.app_context():
        try:
            # Check if tables exist by trying to query User table
            User.query.first()
            print("[auto_init_db] Database already initialized.")
            return
        except Exception:
            # Tables don't exist, initialize them
            print("[auto_init_db] Database empty, initializing...")
            
            try:
                # Create all tables
                db.create_all()
                print("[auto_init_db] Tables created successfully!")
                
                # Try to import data from CSV files
                try:
                    from init_db import (
                        seed_semesters, seed_courses, seed_rooms,
                        seed_program_curriculum, seed_sections_from_cohorts,
                        seed_users, seed_chairpersons, seed_demo_accounts,
                        seed_faculty_qualifications, seed_faculty_availability
                    )
                    
                    print("[auto_init_db] Importing data from CSV files...")
                    seed_semesters(app)
                    seed_courses(app)
                    seed_rooms(app)
                    seed_program_curriculum(app)
                    seed_sections_from_cohorts(app)
                    seed_users(app)
                    seed_chairpersons(app)
                    seed_demo_accounts(app)
                    seed_faculty_qualifications(app)
                    seed_faculty_availability(app)
                    
                    print("[auto_init_db] ✅ Database initialization complete!")
                    
                except Exception as import_error:
                    print(f"[auto_init_db] ⚠️  Tables created but CSV import failed: {import_error}")
                    print("[auto_init_db] You can import data manually later via the admin panel.")
                    
            except Exception as e:
                print(f"[auto_init_db] ❌ Failed to initialize database: {e}")
                raise
