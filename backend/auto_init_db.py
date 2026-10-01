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
    """Initialize database if it's empty (no tables exist).
    Also ensures critical data like chairpersons and availability are seeded."""
    if not should_auto_init():
        return
    
    from database import db
    from models import User
    
    with app.app_context():
        try:
            # Check if tables exist by trying to query User table
            existing_user = User.query.first()
            
            if existing_user is None:
                # Database is completely empty - do full initialization
                print("[auto_init_db] Database empty, initializing...")
                _full_initialization(app, db)
            else:
                # Tables exist - check and seed missing critical data
                print("[auto_init_db] Database tables exist, checking for missing data...")
                _ensure_critical_data(app, db)
                
        except Exception:
            # Tables don't exist, initialize them
            print("[auto_init_db] Database empty, initializing...")
            _full_initialization(app, db)


def _full_initialization(app, db):
    """Full database initialization with all CSV imports."""
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


def _ensure_critical_data(app, db):
    """Ensure chairpersons and availability are seeded even if other data exists."""
    from models import User, AvailabilitySubmission
    
    try:
        # Check if chairpersons exist
        chair_count = User.query.filter_by(role="chairperson").count()
        if chair_count == 0:
            print("[auto_init_db] No chairpersons found, importing...")
            try:
                from init_db import seed_chairpersons, seed_demo_accounts
                seed_chairpersons(app)
                seed_demo_accounts(app)
                print("[auto_init_db] ✅ Chairpersons imported!")
            except Exception as e:
                print(f"[auto_init_db] ⚠️  Failed to import chairpersons: {e}")
        else:
            print(f"[auto_init_db] Found {chair_count} chairperson(s)")
        
        # Check if availability data exists
        avail_count = AvailabilitySubmission.query.count()
        if avail_count == 0:
            print("[auto_init_db] No availability data found, importing...")
            try:
                from init_db import seed_faculty_availability
                seed_faculty_availability(app)
                print("[auto_init_db] ✅ Faculty availability imported!")
            except Exception as e:
                print(f"[auto_init_db] ⚠️  Failed to import availability: {e}")
        else:
            print(f"[auto_init_db] Found {avail_count} availability submission(s)")
            
    except Exception as e:
        print(f"[auto_init_db] ⚠️  Error checking critical data: {e}")
