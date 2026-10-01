"""Chairperson CSV import hub.

Supports all source CSV datasets used by CCISched's database bootstrap:
faculty, semesters, courses, rooms, program curriculum, sections/cohorts,
faculty-course qualifications, faculty availability, and historical data.
"""
from __future__ import annotations

import io
import shutil
from pathlib import Path

import pandas as pd
from flask import Blueprint, jsonify, request, current_app

from database import db
from models import User, Course, Room, Semester, Section, ProgramCurriculum, FacultyCourseQualification
from routes.auth import login_required, role_required

imports_bp = Blueprint("imports", __name__, url_prefix="/api/manage/import")
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

DATASETS = {
    "faculty": {
        "label": "Faculty",
        "filename": "CCISched-Faculty.csv",
        "required": ["faculty_id", "first_name", "last_name", "webmail"],
        "optional": ["middle initial", "age", "gender", "contact", "specialization", "academic_rank", "department", "max units", "employment type", "Avatar"],
        "notes": ["Faculty IDs must use the FA-### format.", "Existing faculty are updated by faculty_id; new faculty are created.", "Import faculty before availability or qualification data."],
    },
    "semesters": {
        "label": "Semesters",
        "filename": "CCISched-Semester.csv",
        "required": ["semester id", "academic_year", "semester_term", "start_date", "end_date"],
        "optional": ["max_units_per_faculty", "is_active"],
        "notes": ["Dates must be valid YYYY-MM-DD values.", "is_active is recalculated from today's date range.", "Import semesters before sections or availability."],
    },
    "courses": {
        "label": "Courses",
        "filename": "CCISched-Courses.csv",
        "required": ["course_code", "course_title", "credited_units"],
        "optional": ["lec_units", "lab_unit", "year level", "department", "college", "course_category", "is active", "program", "Department"],
        "notes": ["course_code must be unique.", "department is the owning track (IT/CS) and college is the college (e.g. CCIS). The older program/Department headers are still accepted.", "Course codes referenced by curriculum, sections, qualifications, or assignments must already exist."],
    },
    "rooms": {
        "label": "Rooms",
        "filename": "CCISched-Rooms.csv",
        "required": ["room_code", "capacity"],
        "optional": ["building", "floor number", "room type", "is active"],
        "notes": ["room_code must be unique.", "Room type should normally be Lecture or Laboratory."],
    },
    "curriculum": {
        "label": "Program Curriculum",
        "filename": "CCISched-Program-Curriculum.csv",
        "required": ["program_code", "course_code", "year_level", "semester_offered"],
        "optional": ["curriculum_id"],
        "notes": ["course_code must already exist in Courses.", "semester_offered must be 1 or 2."],
    },
    "sections": {
        "label": "Sections / Cohorts",
        "filename": "CCISched-Sections.csv",
        "required": ["section_id", "section_name", "program_code", "semester_id", "status"],
        "optional": [],
        "notes": ["This file contains cohort definitions; actual course sections are derived from the imported curriculum.", "semester_id must already exist.", "Import Courses, Curriculum, and Semesters before Sections."],
    },
    "qualifications": {
        "label": "Faculty Course Qualifications",
        "filename": "CCISched-Faculty-Course-Qualifications.csv",
        "required": ["faculty_id", "course_code"],
        "optional": ["qualification_id", "preference_rank"],
        "notes": ["Faculty IDs and course codes must already exist.", "preference_rank is optional; when omitted it is taken from the row order per faculty (1 = first listed)."],
    },
    "availability": {
        "label": "Faculty Availability",
        "filename": "CCISched-Faculty-Availability-Matrix.csv",
        "required": ["faculty_id", "day_of_week", "start_time", "end_time"],
        "optional": ["shift_block", "semester_id"],
        "ignored": ["availability_id"],
        "notes": ["Faculty must already exist and IDs must use FA-###.", "Day names must be full and capitalized: Monday, Tuesday, etc.", "Times must be zero-padded 24-hour values such as 08:00:00.", "Only rows for the currently active semester are imported (matched by the optional semester_id column); if no semester is active, nothing is imported.", "Back-to-back shifts on the same day (e.g. Morning + Afternoon) are merged into one continuous slot.", "For an existing faculty/semester submission, the CSV replaces its availability slots."],
    },
    "historical": {
        "label": "Historical Assignments",
        "filename": "CCISched-Historical-Data.csv",
        "required": ["assignment_id", "faculty_id", "course_code", "section_id", "semester_id", "room_id", "component_type", "day _of_week", "start_time", "end_time", "status"],
        "optional": [],
        "notes": ["This dataset is retained as CSV training data for the RF model; it is not a live database table.", "Importing replaces the current historical CSV used by the scheduler."],
    },
}

SEEDER_MAP = {
    "faculty": ("CCISched-Faculty.csv", "seed_users"),
    "semesters": ("CCISched-Semester.csv", "seed_semesters"),
    "courses": ("CCISched-Courses.csv", "seed_courses"),
    "rooms": ("CCISched-Rooms.csv", "seed_rooms"),
    "curriculum": ("CCISched-Program-Curriculum.csv", "seed_program_curriculum"),
    "sections": ("CCISched-Sections.csv", "seed_sections_from_cohorts"),
    "qualifications": ("CCISched-Faculty-Course-Qualifications.csv", "seed_faculty_qualifications"),
    "availability": ("CCISched-Faculty-Availability-Matrix.csv", "seed_faculty_availability"),
}


def _normalized_columns(df: pd.DataFrame) -> dict[str, str]:
    return {str(c).strip(): str(c) for c in df.columns}


def _validate_csv(raw: bytes, dataset: str):
    meta = DATASETS[dataset]
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str, keep_default_na=False)
    except Exception as exc:
        raise ValueError(f"The selected file could not be read as CSV: {exc}")

    cols = _normalized_columns(df)
    missing = [c for c in meta["required"] if c not in cols]
    if missing:
        raise ValueError("Missing required columns: " + ", ".join(missing))
    return df


@imports_bp.get("/datasets")
@login_required
@role_required("chairperson")
def list_datasets():
    result = []
    for key, meta in DATASETS.items():
        result.append({"key": key, **meta})
    return jsonify(result), 200


@imports_bp.post("/<dataset>")
@login_required
@role_required("chairperson")
def import_dataset(dataset: str):
    if dataset not in DATASETS:
        return jsonify({"error": "Unsupported import dataset."}), 404
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Please select a CSV file."}), 400
    if not uploaded.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported."}), 400

    raw = uploaded.read()
    try:
        df = _validate_csv(raw, dataset)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    target_name = DATASETS[dataset]["filename"]
    target = DATA_DIR / target_name
    backup = target.with_suffix(target.suffix + ".bak_import")
    had_old = target.exists()

    try:
        if had_old:
            shutil.copy2(target, backup)
        target.write_bytes(raw)

        if dataset == "historical":
            # Validate the complete file first; the scheduler reads this file directly.
            return jsonify({
                "message": f"Imported {len(df)} historical assignment rows.",
                "dataset": dataset,
                "rows": len(df),
                "storage": target_name,
            }), 200

        from init_db import (
            seed_users, seed_semesters, seed_courses, seed_rooms,
            seed_program_curriculum, seed_sections_from_cohorts,
            seed_faculty_qualifications, seed_faculty_availability,
        )
        seeders = {
            "faculty": seed_users,
            "semesters": seed_semesters,
            "courses": seed_courses,
            "rooms": seed_rooms,
            "curriculum": seed_program_curriculum,
            "sections": seed_sections_from_cohorts,
            "qualifications": seed_faculty_qualifications,
            "availability": seed_faculty_availability,
        }
        seeders[dataset](current_app)
        db.session.commit()

        return jsonify({
            "message": f"Imported {len(df)} rows into {DATASETS[dataset]['label']}.",
            "dataset": dataset,
            "rows": len(df),
        }), 200
    except Exception as exc:
        db.session.rollback()
        if had_old:
            shutil.copy2(backup, target)
        else:
            target.unlink(missing_ok=True)
        return jsonify({"error": f"Import failed and was rolled back: {exc}"}), 500
    finally:
        backup.unlink(missing_ok=True)
