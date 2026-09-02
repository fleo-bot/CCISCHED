"""
init_db.py
----------
One-time setup script.  Run once to:
  1. Create all tables
  2. Seed semesters from the existing CSV
  3. Create a default chairperson account
  4. Seed faculty accounts from faculty.csv

Usage:
    cd backend
    python init_db.py
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

from werkzeug.security import generate_password_hash
import pandas as pd

# ── Make sure the backend package is importable ──
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from database import db
from models import User, Semester


def seed_semesters(app):
    DATA_DIR = Path(__file__).parent / "data"
    df = pd.read_csv(DATA_DIR / "Sememster.csv")

    with app.app_context():
        if Semester.query.count() > 0:
            print("  [skip] Semesters already seeded.")
            return

        for _, row in df.iterrows():
            sem = Semester(
                id            = int(row["semester_id"]),
                academic_year = str(row["academic_year"]),
                semester_term = str(row["semester_term"]),
                start_date    = _parse_date(str(row["start_date"])),
                end_date      = _parse_date(str(row["end_date"])),
                max_units_per_faculty = int(row["max_units_per_faculty"]),
                is_active     = bool(int(row["is_active"])),
            )
            db.session.add(sem)

        db.session.commit()
        print(f"  [ok] Seeded {df.shape[0]} semesters.")


def seed_users(app):
    DATA_DIR = Path(__file__).parent / "data"
    df = pd.read_csv(DATA_DIR / "faculty.csv")

    with app.app_context():
        if User.query.count() > 0:
            print("  [skip] Users already seeded.")
            return

        # ── Default chairperson ──
        chair = User(
            employee_number         = "EMP-2024-000",
            first_name              = "Admin",
            last_name               = "Chairperson",
            email                   = "chair@pup.edu.ph",
            password_hash           = generate_password_hash("chair1234"),
            role                    = "chairperson",
            specialization          = "Department Administration",
            academic_rank           = "Department Chair",
            highest_educ_attainment = "PhD",
            exp_years               = 10,
            employment_type         = "Full Time",
            max_units               = 0,
            avatar                  = "female",
        )
        db.session.add(chair)

        # ── Faculty from CSV ──
        for _, row in df.iterrows():
            user = User(
                id                      = int(row["faculty_id"]),
                employee_number         = str(row["employee_number"]),
                first_name              = str(row["first_name"]),
                last_name               = str(row["last_name"]),
                email                   = str(row["email"]),
                # Default password = employee_number (they should change on first login)
                password_hash           = generate_password_hash(str(row["employee_number"])),
                role                    = "faculty",
                specialization          = str(row.get("specialization", "")),
                academic_rank           = str(row.get("academic_rank", "")),
                highest_educ_attainment = str(row.get("highest_educ_attainment", "")),
                exp_years               = int(row.get("exp_years", 0)),
                employment_type         = str(row.get("employment_type", "Full Time")),
                max_units               = int(row.get("max_units", 21)),
                preferred_courses       = str(row.get("preferred_courses", "")),
                preferred_days          = str(row.get("preferred_days", "")),
                avatar                  = "female",   # can be updated via profile
            )
            db.session.add(user)

        db.session.commit()
        print(f"  [ok] Seeded chairperson + {df.shape[0]} faculty accounts.")
        print("  [info] Default faculty password = their employee number  (e.g. EMP-2024-001)")
        print("  [info] Chairperson password     = chair1234")


def _parse_date(val: str):
    """Parse M/D/YY or YYYY-MM-DD → date object."""
    from datetime import datetime
    for fmt in ("%m/%d/%y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


def main():
    app = create_app()

    with app.app_context():
        print("\n[init_db] Creating tables…")
        db.create_all()
        print("[init_db] Tables created.\n")

    print("[init_db] Seeding data…")
    seed_semesters(app)
    seed_users(app)
    print("\n[init_db] Done. You can now run:  python app.py\n")


if __name__ == "__main__":
    main()
