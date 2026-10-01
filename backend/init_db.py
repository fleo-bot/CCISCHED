"""
init_db.py
----------
One-time setup script. Reads the raw CCISched-*.csv exports directly from
backend/data/ \u2014 no preprocessing step needed. Drop new exports in that
folder with the same filenames and re-run.

Run to:
  1. Create all tables
  2. Seed semesters, courses, rooms from CSV
  3. Seed the program curriculum (which courses each program/year/term needs)
  4. Derive concrete Section (offering) rows by crossing raw section
     cohorts (e.g. "BSIT 4-1") against the curriculum
  5. Seed faculty accounts ("FA-000"-style IDs) + a default chairperson
  6. Seed faculty course qualifications (ranked course preferences)
  7. Seed faculty availability into the real submission/slot tables
  8. Seed a handful of easy-to-remember demo accounts

Usage:
    cd backend
    python init_db.py
"""

from __future__ import annotations

import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from dateutil import parser as dateparser
from werkzeug.security import generate_password_hash
import pandas as pd

# ── Make sure the backend package is importable ──
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from database import db
from id_utils import fa_to_id
from models import (
    User, Semester, Course, Room, Section,
    ProgramCurriculum, FacultyCourseQualification,
    AvailabilitySubmission, AvailabilitySlot,
)

DATA_DIR = Path(__file__).parent / "data"

# "1st Term" -> 1, etc. — needed to match a cohort's semester against
# ProgramCurriculum.semester_offered (which is just 1 or 2)
TERM_WORD_TO_NUM = {"1st Term": 1, "2nd Term": 2, "3rd Term": 3}

YEAR_LEVEL_BY_DIGIT = {
    "1": "First Year", "2": "Second Year", "3": "Third Year", "4": "Fourth Year",
}

DAY_NAME_TO_INDEX = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}

TODAY = date.today()   # use the actual run date to pick the active semester from date ranges


def _clean(val, default: str = "") -> str:
    """NaN-safe string cleanup."""
    if pd.isna(val):
        return default
    return str(val).strip()


def _clean_date(val) -> str:
    """Robust date parsing for the messy raw semester export \u2014 handles
    '---' placeholders and comma-without-space ('Feb 28,2024') which
    confuses dateutil into picking the wrong year."""
    if pd.isna(val) or str(val).strip() in ("", "---"):
        return ""
    s = re.sub(r",(?=\S)", ", ", str(val).strip())
    try:
        return dateparser.parse(s).date().isoformat()
    except Exception:
        return ""


def _normalize_password(identifier: str) -> str:
    """FA-023 -> fa023 \u2014 lowercase, dashes removed."""
    return identifier.strip().lower().replace("-", "")


def _read_csv(filename: str, strip_cols: bool = True) -> pd.DataFrame:
    """Read a raw export and optionally strip stray whitespace from column
    names \u2014 several of the raw files have trailing spaces in headers
    ('day _of_week', 'semester_id ') from how they were exported."""
    df = pd.read_csv(DATA_DIR / filename)
    if strip_cols:
        df.columns = [c.strip() for c in df.columns]
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]
    return df


# ─────────────────────────────────────────────────────────────
#  SEMESTERS
# ─────────────────────────────────────────────────────────────
def seed_semesters(app):
    df = _read_csv("CCISched-Semester.csv")
    df = df.rename(columns={"semester id": "semester_id"})

    with app.app_context():
        for _, row in df.iterrows():
            sid = int(row["semester_id"])
            sem = db.session.get(Semester, sid)
            if sem is None:
                sem = Semester(id=sid)
                db.session.add(sem)

            start = _clean_date(row["start_date"])
            end   = _clean_date(row["end_date"])
            sem.academic_year = _clean(row["academic_year"])
            sem.semester_term = _clean(row["semester_term"])
            sem.start_date    = date.fromisoformat(start) if start else None
            sem.end_date      = date.fromisoformat(end) if end else None
            sem.max_units_per_faculty = 21   # blank in source

            # Determine "active" from whichever date range contains today,
            # since the source column is blank for every row
            sem.is_active = bool(
                sem.start_date and sem.end_date and sem.start_date <= TODAY <= sem.end_date
            )

        db.session.commit()
        active = Semester.query.filter_by(is_active=True).first()
        label = f"{active.academic_year} {active.semester_term}" if active else "NONE FOUND"
        print(f"  [ok] Synced {len(df)} semesters. Active: {label}")


# ─────────────────────────────────────────────────────────────
#  COURSES
# ─────────────────────────────────────────────────────────────
def seed_courses(app):
    df = _read_csv("CCISched-Courses.csv")

    # The newer export renamed two columns: the owning track (IT/CS) is now
    # "department" and the college (CCIS) is now "college". The older export
    # called them "program" and "Department" respectively. Support both so
    # either file layout seeds the same Course.program / Course.department.
    new_layout = "college" in df.columns
    track_col   = "department" if new_layout else "program"
    college_col = "college"    if new_layout else "Department"

    with app.app_context():
        for _, row in df.iterrows():
            code = _clean(row["course_code"])
            course = Course.query.filter_by(course_code=code).first()
            if course is None:
                course = Course(course_code=code)
                db.session.add(course)
            course.course_title   = _clean(row["course_title"])
            course.lec_units      = int(row.get("lec_units", 0) or 0)
            course.lab_units      = int(row.get("lab_unit", 0) or 0)
            course.units          = int(row.get("credited_units", 3) or 3)
            course.program        = _clean(row.get(track_col))
            course.year_level     = _clean(row.get("year level"), "Unspecified")
            course.department     = _clean(row.get(college_col), "CCIS")
            course.classification = _clean(row.get("course_category"))
            course.is_active      = True
        db.session.commit()
        print(f"  [ok] Synced {len(df)} courses.")


# ─────────────────────────────────────────────────────────────
#  ROOMS
# ─────────────────────────────────────────────────────────────
def seed_rooms(app):
    df = _read_csv("CCISched-Rooms.csv")

    with app.app_context():
        for _, row in df.iterrows():
            code = _clean(row["room_code"])
            room = Room.query.filter_by(room_code=code).first()
            if room is None:
                room = Room(room_code=code)
                db.session.add(room)
            room.building     = _clean(row.get("building"))
            floor = row.get("floor number")
            room.floor_number = int(floor) if pd.notna(floor) else None
            room.capacity     = int(row.get("capacity", 40) or 40)
            room.room_type    = _clean(row.get("room type"), "Lecture")
            room.is_active    = True
        db.session.commit()
        print(f"  [ok] Synced {len(df)} rooms.")


# ─────────────────────────────────────────────────────────────
#  PROGRAM CURRICULUM
# ─────────────────────────────────────────────────────────────
def seed_program_curriculum(app):
    df = _read_csv("CCISched-Program-Curriculum.csv")

    with app.app_context():
        course_by_code = {c.course_code: c.id for c in Course.query.all()}
        synced, missing = 0, set()

        for _, row in df.iterrows():
            code = _clean(row["course_code"])
            course_id = course_by_code.get(code)
            if not course_id:
                missing.add(code)
                continue

            program_code = _clean(row["program_code"])
            year_level   = _clean(row["year_level"])
            term         = int(row["semester_offered"])

            entry = ProgramCurriculum.query.filter_by(
                program_code=program_code, course_id=course_id,
                year_level=year_level, semester_offered=term,
            ).first()
            if entry is None:
                db.session.add(ProgramCurriculum(
                    program_code=program_code, course_id=course_id,
                    year_level=year_level, semester_offered=term,
                ))
            synced += 1

        db.session.commit()
        print(f"  [ok] Synced {synced} curriculum entries.")
        if missing:
            print(f"  [warn] {len(missing)} curriculum rows referenced unknown course codes: {missing}")


# ─────────────────────────────────────────────────────────────
#  SECTIONS — derived from raw cohorts × curriculum
# ─────────────────────────────────────────────────────────────
def _parse_year_level(section_name: str, program_code: str) -> str | None:
    """'BSIT 4-1' -> 'Fourth Year' (digit right after the program code)."""
    rest = section_name.replace(program_code, "", 1).strip()
    digit = rest[0] if rest else ""
    return YEAR_LEVEL_BY_DIGIT.get(digit)


def seed_sections_from_cohorts(app):
    """
    The raw Sections CSV lists cohorts (e.g. "BSIT 4-1") \u2014 a group of
    students, not a single course. Real course offerings are derived by
    crossing each cohort against ProgramCurriculum: whatever courses that
    program/year/term requires becomes one Section (offering) row per
    course, all sharing the cohort's section_name. Day/time/room are left
    blank for now \u2014 that's a separate scheduling step, not a seeding one.
    """
    df = _read_csv("CCISched-Sections.csv")
    df["program_code"] = df["program_code"].str.strip()
    df["section_name"] = df["section_name"].str.strip()

    with app.app_context():
        created, updated, skipped_no_year, skipped_no_curriculum = 0, 0, 0, 0

        for _, cohort in df.iterrows():
            status = _clean(cohort.get("status"), "Active")
            if status.lower() != "active":
                continue

            program_code = _clean(cohort["program_code"])
            section_name = _clean(cohort["section_name"])
            semester_id  = int(cohort["semester_id"])

            sem = db.session.get(Semester, semester_id)
            if not sem:
                continue
            term_num = TERM_WORD_TO_NUM.get(sem.semester_term)
            if not term_num:
                continue

            year_level = _parse_year_level(section_name, program_code)
            if not year_level:
                skipped_no_year += 1
                continue

            applicable = ProgramCurriculum.query.filter_by(
                program_code=program_code, year_level=year_level, semester_offered=term_num,
            ).all()
            if not applicable:
                skipped_no_curriculum += 1
                continue

            for curr in applicable:
                existing = Section.query.filter_by(
                    course_id=curr.course_id, section_name=section_name, semester_id=semester_id,
                ).first()
                if existing:
                    existing.program_code = program_code
                    updated += 1
                    continue
                db.session.add(Section(
                    course_id=curr.course_id, section_name=section_name,
                    program_code=program_code, semester_id=semester_id, status="open",
                ))
                created += 1

        db.session.commit()
        print(f"  [ok] Derived sections: {created} created, {updated} updated "
              f"from {len(df)} cohorts.")
        if skipped_no_year:
            print(f"  [warn] {skipped_no_year} cohorts skipped \u2014 couldn't parse year level from name.")
        if skipped_no_curriculum:
            print(f"  [warn] {skipped_no_curriculum} cohorts skipped \u2014 no matching curriculum entries.")


# ─────────────────────────────────────────────────────────────
#  FACULTY + CHAIRPERSON
# ─────────────────────────────────────────────────────────────
DEPARTMENT_MAP = {
    "IT": "Department of Information Technology",
    "CS": "Department of Computer Science",
    "IS": "Department of Information Systems",
}


def _map_department(code: str) -> str:
    code = (code or "").strip()
    return DEPARTMENT_MAP.get(code.upper(), code)


def _map_gender(code: str) -> str:
    code = (code or "").strip().upper()
    if code in ("M", "MALE"):
        return "male"
    if code in ("F", "FEMALE"):
        return "female"
    return ""


def _format_ph_phone(raw: str) -> str:
    """Format a bare 10-digit PH mobile number (e.g. 9173911718) as
    '+63 917 391 1718'. Leaves already-formatted or malformed values as-is."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("63") and len(digits) == 12:
        digits = digits[2:]
    digits = digits.lstrip("0")
    if len(digits) != 10:
        return raw.strip() if raw else ""
    return f"+63 {digits[0:3]} {digits[3:6]} {digits[6:10]}"


def _first(row, *names):
    """Return the first non-empty value among several possible column names,
    e.g. 'middle_name' / 'middle name'. Header case and spaces/underscores
    are ignored, so CSV header spelling can't silently drop a column."""
    def norm(k):
        return re.sub(r"[\s_\-]+", "", str(k)).lower()
    lookup = {norm(k): k for k in row.index}
    for n in names:
        key = lookup.get(norm(n))
        if key is not None:
            val = _clean(row[key])
            if val:
                return val
    return ""


def _map_employment_type(raw: str) -> str:
    """CSV uses 'Full-Time' / 'Part-Time' / 'Designee'; keep the value the
    profile dropdown understands ('Full Time' / 'Part Time')."""
    v = (raw or "").strip().replace("-", " ")
    return v or "Full Time"


def seed_users(app):
    """
    Faculty get EXPLICIT ids derived from their FA-xxx code (FA-023 -> 24,
    via id_utils.fa_to_id \u2014 the same helper app.py uses for historical
    data) so everything lines up deterministically without a runtime
    lookup. This must run before the chairperson/demo accounts below so
    their auto-incremented ids land safely above the explicit faculty
    range (MySQL/InnoDB bumps the auto-increment counter past any
    explicit id it sees).
    """
    df = _read_csv("CCISched-Faculty.csv")

    with app.app_context():
        created, updated = 0, 0
        for _, row in df.iterrows():
            employee_number = _clean(row["faculty_id"])   # "FA-023"
            fid = fa_to_id(employee_number)
            user = db.session.get(User, fid)
            is_new = user is None
            if not is_new and user.role != "faculty":
                print(f"  [warn] {employee_number} -> id {fid} is already used by "
                      f"{user.email} (role={user.role}); skipped. Rebuild the DB "
                      f"(drop tables, re-run init_db.py) so faculty seed first.")
                continue
            if is_new:
                user = User(id=fid)
                db.session.add(user)

            user.employee_number         = employee_number
            user.first_name              = _clean(row["first_name"])
            user.middle_name             = _first(row, "middle_name", "middle name", "middle initial")
            user.last_name               = _clean(row["last_name"])
            user.email                   = _clean(row["webmail"])
            if is_new or not user.password_hash:
                # Default password only on creation, so re-importing the CSV
                # never resets a password someone has already changed.
                user.password_hash       = generate_password_hash(_normalize_password(employee_number))
            user.role                    = "faculty"
            age_raw = _clean(row.get("age"))
            user.age                     = int(age_raw) if age_raw.isdigit() else user.age
            gender_mapped = _map_gender(_clean(row.get("gender")))
            user.gender                  = gender_mapped or user.gender
            dept_raw = _clean(row.get("department"))
            user.department              = _map_department(dept_raw) if dept_raw else user.department
            phone_raw = _first(row, "phone_number", "contact", "contact_number", "phone")
            user.contact_number          = _format_ph_phone(phone_raw) if phone_raw else user.contact_number
            user.specialization          = _clean(row.get("specialization"))
            user.academic_rank           = _clean(row.get("academic rank")) or _clean(row.get("academic_rank"))
            user.highest_educ_attainment = user.highest_educ_attainment or ""   # not in this dataset
            user.exp_years                = user.exp_years or 0                  # not in this dataset
            user.employment_type         = _map_employment_type(_first(row, "employment type", "employment_type"))
            user.max_units               = int(row.get("max units", 15) or 15)
            user.avatar                  = _clean(row.get("Avatar"), "female")

            created += is_new
            updated += (not is_new)

        db.session.commit()
        print(f"  [ok] Faculty synced: {created} created, {updated} updated.")
        print("  [info] Default faculty password = normalized FA-code, e.g. FA-023 -> fa023")

        # ── Default chairperson (create-or-update, AFTER faculty so its
        #    auto-incremented id can't collide with an explicit faculty id) ──
        chair = User.query.filter_by(email="chair@pup.edu.ph").first()
        if chair is None:
            chair = User(employee_number="ADMIN-000", email="chair@pup.edu.ph")
            db.session.add(chair)
        chair.first_name              = "Admin"
        chair.last_name               = "Chairperson"
        chair.password_hash           = generate_password_hash("chair1234")
        chair.role                    = "chairperson"
        chair.specialization          = "Department Administration"
        chair.academic_rank           = "Department Chair"
        chair.highest_educ_attainment = "PhD"
        chair.exp_years               = 10
        chair.employment_type         = "Full Time"
        chair.max_units               = 0
        chair.avatar                  = chair.avatar or "female"
        db.session.commit()
        print("  [info] Chairperson password     = chair1234")


# ─────────────────────────────────────────────────────────────
#  CHAIRPERSONS (real accounts, CP-### ids)
# ─────────────────────────────────────────────────────────────


def seed_chairpersons(app):
    """
    Upserts chairperson accounts from CCISched-Chairpersons.csv (matched by
    chairperson_id, e.g. CP-000). To add a chairperson, add a row to that file
    and re-run init_db.py.

    Columns: chairperson_id, first_name, middle_name, last_name, webmail,
    gender, age, department, contact_number (middle_name, gender, age,
    department and contact_number may be blank).

    The default password is the normalized id, like faculty (CP-000 ->
    cp000), and is only set when the account is first created so it never
    overwrites a password the person has already changed.
    """
    df = _read_csv("CCISched-Chairpersons.csv")

    with app.app_context():
        created, updated, skipped = 0, 0, 0
        for _, row in df.iterrows():
            emp_no = _clean(row.get("chairperson_id"))
            email  = _clean(row.get("webmail"))
            first  = _clean(row.get("first_name"))
            last   = _clean(row.get("last_name"))
            if not (emp_no and email and first and last):
                skipped += 1
                print(f"  [warn] Chairperson row skipped (needs chairperson_id, first_name, "
                      f"last_name, webmail): {emp_no or email or '<blank>'}")
                continue

            user = User.query.filter_by(employee_number=emp_no).first()
            is_new = user is None
            if is_new:
                user = User(employee_number=emp_no)
                db.session.add(user)

            gender = _map_gender(_clean(row.get("gender")))
            age_raw = _clean(row.get("age"))
            try:
                age = int(float(age_raw)) if age_raw else None
            except ValueError:
                age = None
            dept_raw = _clean(row.get("department"))

            user.first_name     = first
            user.middle_name    = _clean(row.get("middle_name"))
            user.last_name      = last
            user.email          = email
            user.role           = "chairperson"
            user.gender         = gender
            user.age            = age
            user.department     = _map_department(dept_raw) if dept_raw else user.department
            user.contact_number = _clean(row.get("contact_number"))
            if gender:
                user.avatar     = gender
            if is_new:
                user.password_hash           = generate_password_hash(_normalize_password(emp_no))
                user.specialization          = ""
                user.academic_rank           = ""
                user.highest_educ_attainment = ""
                user.exp_years               = 0
                user.employment_type         = "Full Time"
                user.max_units               = 0
                if not gender:
                    user.avatar              = "female"
                print(f"  [info] {email} ({emp_no}) default password = {_normalize_password(emp_no)}")
            created += is_new
            updated += (not is_new)

        db.session.commit()
        print(f"  [ok] Chairpersons synced: {created} created, {updated} updated"
              + (f", {skipped} skipped." if skipped else "."))


def seed_demo_accounts(app):
    """
    A handful of easy-to-remember demo accounts matching the hint text
    shown on the login page. Runs every time and upserts, so these always
    work even on an already-seeded database.
    """
    demo_accounts = [
        dict(email="chairperson@pup.edu.ph", password="admin123",   role="chairperson",
             first_name="Admin",         last_name="Chairperson", employee_number="DEMO-CHAIR-01"),
        dict(email="demo.chair@pup.edu.ph",  password="chair123",   role="chairperson",
             first_name="Christian Rey", last_name="Dela Cruz",   employee_number="DEMO-CHAIR-02"),
        dict(email="faculty@pup.edu.ph",     password="faculty123", role="faculty",
             first_name="Test",          last_name="Faculty",     employee_number="DEMO-FAC-01"),
        dict(email="msantos@pup.edu.ph",     password="faculty123", role="faculty",
             first_name="Maria",         last_name="Santos",      employee_number="DEMO-FAC-02",
             middle_name="Doyen", age=40, gender="female", contact_number="+63 912 345 6789"),
    ]

    with app.app_context():
        for acc in demo_accounts:
            user = User.query.filter_by(email=acc["email"]).first()
            if user:
                user.password_hash = generate_password_hash(acc["password"])
                user.role          = acc["role"]
                if acc.get("middle_name"):    user.middle_name    = acc["middle_name"]
                if acc.get("age"):            user.age            = acc["age"]
                if acc.get("gender"):         user.gender         = acc["gender"]
                if acc.get("contact_number"): user.contact_number = acc["contact_number"]
            else:
                user = User(
                    employee_number         = acc["employee_number"],
                    first_name              = acc["first_name"],
                    middle_name             = acc.get("middle_name"),
                    last_name               = acc["last_name"],
                    email                   = acc["email"],
                    password_hash           = generate_password_hash(acc["password"]),
                    role                    = acc["role"],
                    age                     = acc.get("age"),
                    gender                  = acc.get("gender"),
                    contact_number          = acc.get("contact_number"),
                    specialization          = "Demo Account",
                    academic_rank           = "N/A",
                    highest_educ_attainment = "N/A",
                    exp_years               = 0,
                    employment_type         = "Full Time",
                    max_units               = 0 if acc["role"] == "chairperson" else 21,
                    avatar                  = "female",
                )
                db.session.add(user)
        db.session.commit()
        print("  [ok] Demo accounts ready:")
        for acc in demo_accounts:
            print(f"       {acc['email']} / {acc['password']}  ({acc['role']})")


# ─────────────────────────────────────────────────────────────
#  FACULTY COURSE QUALIFICATIONS
# ─────────────────────────────────────────────────────────────
def seed_faculty_qualifications(app):
    """
    Replaces the old flat comma-separated User.preferred_courses with a
    proper ranked table. Also backfills User.preferred_courses (comma-
    joined, ordered by rank) so the current RF feature code \u2014 which
    still reads that flat field \u2014 keeps working without modification.
    """
    df = _read_csv("CCISched-Faculty-Course-Qualifications.csv")

    # The newer export has no preference_rank column. Derive it from the
    # order each faculty's rows appear in the file (1 = first listed), which
    # is how the older export's ranks were laid out too.
    if "preference_rank" not in df.columns:
        df["preference_rank"] = df.groupby("faculty_id").cumcount() + 1

    with app.app_context():
        course_by_code = {c.course_code: c.id for c in Course.query.all()}
        synced, missing = 0, set()

        for _, row in df.iterrows():
            fid  = fa_to_id(row["faculty_id"])
            code = _clean(row["course_code"])
            course_id = course_by_code.get(code)
            if not course_id or not db.session.get(User, fid):
                missing.add(code)
                continue

            entry = FacultyCourseQualification.query.filter_by(
                faculty_id=fid, course_id=course_id
            ).first()
            if entry is None:
                entry = FacultyCourseQualification(faculty_id=fid, course_id=course_id)
                db.session.add(entry)
            entry.preference_rank = int(row.get("preference_rank", 1))
            synced += 1

        db.session.commit()

        # Backfill the legacy flat field, ordered by preference rank
        for user in User.query.filter_by(role="faculty").all():
            quals = (FacultyCourseQualification.query
                     .filter_by(faculty_id=user.id)
                     .order_by(FacultyCourseQualification.preference_rank).all())
            codes = [q.course.course_code for q in quals if q.course]
            user.preferred_courses = ",".join(codes)
        db.session.commit()

        print(f"  [ok] Synced {synced} faculty course qualifications.")
        if missing:
            print(f"  [warn] {len(missing)} rows referenced unknown course codes: {missing}")


# ─────────────────────────────────────────────────────────────
#  FACULTY AVAILABILITY
# ─────────────────────────────────────────────────────────────
def _hhmm(raw: str) -> str:
    """Normalize 12-hour or 24-hour CSV times to zero-padded HH:MM.

    Supports values such as '7:30 AM', '5:30 PM', '08:00:00', and '17:30'.
    Invalid values are returned unchanged so bad input remains visible in logs/data
    instead of being silently converted to a different time.
    """
    value = str(raw or "").strip()
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])?", value)
    if not match:
        return value
    hour, minute = int(match.group(1)), int(match.group(2))
    meridiem = (match.group(3) or "").upper()
    if minute > 59:
        return value
    if meridiem:
        if not 1 <= hour <= 12:
            return value
        hour = (hour % 12) + (12 if meridiem == "PM" else 0)
    elif not 0 <= hour <= 23:
        return value
    return f"{hour:02d}:{minute:02d}"


def _label12(hhmm: str) -> str:
    m = re.match(r"^(\d{2}):(\d{2})$", hhmm)
    if not m:
        return hhmm
    h, mi = int(m.group(1)), m.group(2)
    return f"{h % 12 or 12}:{mi} {'PM' if h >= 12 else 'AM'}"


def seed_faculty_availability(app):
    """
    Imports into the REAL availability submission/slot tables (the same
    ones the chairperson's 'View Availability' UI already reads) rather
    than a parallel one-off table. Each faculty gets one auto-approved
    submission for the active semester.

    The availability matrix lists availability per semester (a semester_id
    column) as separate shift blocks (Morning 07:30-12:30, Afternoon
    12:30-17:30, Evening 17:30-22:30). Only rows for the ACTIVE semester are
    seeded. Back-to-back blocks on the same day are merged into one
    continuous slot (e.g. Morning + Afternoon -> 07:30-17:30), because the
    CP-SAT solver only counts a 90-minute timetable block as available when
    it sits fully inside a single slot; leaving the blocks split would drop
    every class period that straddles a shift boundary (like 12:00-13:30).
    Older exports without a semester_id column are treated as belonging to
    the active semester.

    Also backfills the legacy per-day flat columns (time_preference_mon
    etc.). This is a known lossy step: a faculty available in several
    shifts on the same day can only have ONE value stored in the flat
    column (the latest shift that day wins).
    """
    df = _read_csv("CCISched-Faculty-Availability-Matrix.csv")

    with app.app_context():
        active_sem = Semester.query.filter_by(is_active=True).first()
        if not active_sem:
            print("  [warn] No active semester - skipping availability import.")
            return

        total_rows = len(df)
        if "semester_id" in df.columns:
            sem_ids = pd.to_numeric(df["semester_id"], errors="coerce")
            df = df[sem_ids == active_sem.id]
        skipped_other_sem = total_rows - len(df)

        by_faculty: dict[int, list] = {}
        for _, row in df.iterrows():
            fid = fa_to_id(row["faculty_id"])
            by_faculty.setdefault(fid, []).append(row)

        submissions_created, slots_created = 0, 0

        for fid, rows in by_faculty.items():
            user = db.session.get(User, fid)
            if not user or user.role != "faculty":
                continue

            submission = AvailabilitySubmission.query.filter_by(
                faculty_id=fid, semester_id=active_sem.id
            ).first()
            if submission is None:
                submission = AvailabilitySubmission(
                    faculty_id=fid, semester_id=active_sem.id,
                    status="approved", submitted_at=datetime.now(timezone.utc),
                    reviewed_at=datetime.now(timezone.utc),
                )
                db.session.add(submission)
                db.session.flush()   # need submission.id before adding slots
                submissions_created += 1
            else:
                # Re-seeding: replace old slots with fresh ones from the CSV
                AvailabilitySlot.query.filter_by(submission_id=submission.id).delete()

            # (day_idx, start, end, shift) per CSV row, in time order
            blocks = []
            for row in rows:
                day_name = _clean(row["day_of_week"])
                day_idx  = DAY_NAME_TO_INDEX.get(day_name)
                if day_idx is None:
                    continue
                blocks.append((
                    day_idx,
                    _hhmm(_clean(row["start_time"])),
                    _hhmm(_clean(row["end_time"])),
                    _clean(row.get("shift_block")),
                ))
            blocks.sort(key=lambda b: (b[0], b[1]))

            # Merge contiguous same-day blocks (end == next start)
            merged: list[list] = []
            for day_idx, start, end, shift in blocks:
                last = merged[-1] if merged else None
                if last and last[0] == day_idx and last[2] == start:
                    last[2] = end
                    last[3] = shift
                else:
                    merged.append([day_idx, start, end, shift])

            day_shift_map: dict[int, str] = {}   # for the flat-column backfill
            for i, (day_idx, start, end, shift) in enumerate(merged, start=1):
                db.session.add(AvailabilitySlot(
                    submission_id=submission.id,
                    slot_number=i,
                    day_indices=str(day_idx),
                    time_start=start,
                    time_end=end,
                    time_label=f"{_label12(start)} \u2013 {_label12(end)}",
                ))
                slots_created += 1
                day_shift_map[day_idx] = shift   # latest shift that day wins

            for day_idx, col in enumerate([
                "time_preference_mon", "time_preference_tue", "time_preference_wed",
                "time_preference_thu", "time_preference_fri", "time_preference_sat",
            ]):
                setattr(user, col, day_shift_map.get(day_idx, "Not available"))

        db.session.commit()
        print(f"  [ok] Availability ({active_sem.academic_year} {active_sem.semester_term}): "
              f"{submissions_created} submissions, {slots_created} slots across "
              f"{len(by_faculty)} faculty.")
        if skipped_other_sem:
            print(f"  [info] {skipped_other_sem} availability rows belong to other semesters "
                  f"and were not seeded.")


# ─────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────
#  LIGHTWEIGHT SCHEMA MIGRATION
# ─────────────────────────────────────────────────────────────
def sync_missing_columns(app):
    """
    db.create_all() only creates tables that don't exist yet — it never
    alters an existing table to add new columns. Since this project has
    no Alembic/Flask-Migrate setup, this patches any columns that exist
    on the SQLAlchemy models but are missing from the live table (works
    for both the SQLite dev fallback and MySQL).
    """
    from sqlalchemy import inspect, text

    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())

        for mapper in db.Model.registry.mappers:
            table = mapper.local_table
            if table.name not in existing_tables:
                continue  # brand-new table — create_all() already handled it

            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}

            for column in table.columns:
                if column.name in existing_cols:
                    continue

                col_type = column.type.compile(dialect=db.engine.dialect)
                ddl = f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}'
                print(f"  [migrate] {table.name}.{column.name} missing — adding it.")
                with db.engine.begin() as conn:
                    conn.execute(text(ddl))


def main():
    app = create_app()

    with app.app_context():
        print("\n[init_db] Creating tables\u2026")
        db.create_all()
        print("[init_db] Tables created.\n")

    print("[init_db] Checking for missing columns\u2026")
    sync_missing_columns(app)
    print("[init_db] Schema up to date.\n")

    print("[init_db] Seeding data\u2026")
    seed_semesters(app)
    seed_courses(app)
    seed_rooms(app)
    seed_program_curriculum(app)
    seed_sections_from_cohorts(app)
    seed_users(app)
    seed_faculty_qualifications(app)
    seed_faculty_availability(app)
    seed_chairpersons(app)
    seed_demo_accounts(app)

    with app.app_context():
        from faculty_status import sync_faculty_status
        flagged = sync_faculty_status()
        print(f"  [ok] Faculty status sync complete ({flagged} newly flagged).")

    print("\n[init_db] Done. You can now run:  python app.py\n")


if __name__ == "__main__":
    main()
