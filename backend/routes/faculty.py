"""
routes/faculty.py
------------------
Faculty account management — chairperson-only writes, both roles can read.

GET    /api/manage/faculty       — list all faculty
POST   /api/manage/faculty       — add a faculty account         (chairperson)
PUT    /api/manage/faculty/<id>  — edit a faculty account         (chairperson)
DELETE /api/manage/faculty/<id>  — remove a faculty account       (chairperson)

New accounts get a default password derived from their employee number,
normalized to lowercase with dashes removed (EMP-2024-051 -> emp2024051) —
the same convention used when seeding faculty from faculty.csv.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from database import db
from models import User
from routes.auth import login_required, role_required
from faculty_status import sync_faculty_status

faculty_bp = Blueprint("faculty_manage", __name__, url_prefix="/api/manage")


def normalize_password(employee_number: str) -> str:
    """EMP-2024-051 -> emp2024051 — matches the seeding convention in init_db.py."""
    return employee_number.strip().lower().replace("-", "")


@faculty_bp.get("/faculty")
@login_required
def list_faculty():
    sync_faculty_status()   # live check — flags + notifies on first detection per AY
    faculty = User.query.filter_by(role="faculty").order_by(User.last_name).all()
    return jsonify([f.to_dict() for f in faculty]), 200


@faculty_bp.post("/faculty")
@login_required
@role_required("chairperson")
def add_faculty():
    body = request.get_json(silent=True) or {}

    employee_number = (body.get("employee_number") or "").strip()
    first_name      = (body.get("first_name") or "").strip()
    last_name       = (body.get("last_name") or "").strip()
    email           = (body.get("email") or "").strip()

    if not employee_number or not first_name or not last_name or not email:
        return jsonify({"error": "Employee number, first name, last name, and email are required."}), 400

    if User.query.filter_by(employee_number=employee_number).first():
        return jsonify({"error": f"Employee number '{employee_number}' already exists."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": f"Email '{email}' already exists."}), 409

    default_password = normalize_password(employee_number)

    faculty = User(
        employee_number         = employee_number,
        first_name              = first_name,
        last_name               = last_name,
        email                   = email,
        password_hash           = generate_password_hash(default_password),
        role                    = "faculty",
        specialization          = body.get("specialization", ""),
        academic_rank           = body.get("academic_rank", ""),
        highest_educ_attainment = body.get("highest_educ_attainment", ""),
        exp_years               = body.get("exp_years") or 0,
        employment_type         = body.get("employment_type", "Full Time"),
        max_units               = body.get("max_units") or 21,
        preferred_courses       = body.get("preferred_courses", ""),
        preferred_days          = body.get("preferred_days", ""),
        avatar                  = "female",
    )
    db.session.add(faculty)
    db.session.commit()

    return jsonify({
        "message":  "Faculty added.",
        "faculty":  faculty.to_dict(),
        "password": default_password,   # so the chairperson can relay it once, on creation
    }), 201


@faculty_bp.put("/faculty/<int:faculty_id>")
@login_required
@role_required("chairperson")
def edit_faculty(faculty_id: int):
    faculty = db.session.get(User, faculty_id)
    if not faculty or faculty.role != "faculty":
        return jsonify({"error": "Faculty not found."}), 404

    body = request.get_json(silent=True) or {}

    first_name = (body.get("first_name") or "").strip()
    last_name  = (body.get("last_name") or "").strip()
    email      = (body.get("email") or "").strip()

    if not first_name or not last_name or not email:
        return jsonify({"error": "First name, last name, and email are required."}), 400

    dupe = User.query.filter(User.email == email, User.id != faculty_id).first()
    if dupe:
        return jsonify({"error": f"Email '{email}' already exists."}), 409

    faculty.first_name              = first_name
    faculty.last_name               = last_name
    faculty.email                   = email
    faculty.specialization          = body.get("specialization", faculty.specialization)
    faculty.academic_rank           = body.get("academic_rank", faculty.academic_rank)
    faculty.highest_educ_attainment = body.get("highest_educ_attainment", faculty.highest_educ_attainment)
    faculty.exp_years               = body.get("exp_years", faculty.exp_years)
    faculty.employment_type         = body.get("employment_type", faculty.employment_type)
    faculty.max_units               = body.get("max_units", faculty.max_units)
    faculty.preferred_courses       = body.get("preferred_courses", faculty.preferred_courses)
    faculty.preferred_days          = body.get("preferred_days", faculty.preferred_days)
    # Note: employee_number and password are intentionally NOT editable here —
    # changing employee_number wouldn't reset the password, which could
    # otherwise clobber a password the faculty member has since changed
    # themselves via their profile page.

    db.session.commit()
    return jsonify({"message": "Faculty updated.", "faculty": faculty.to_dict()}), 200


@faculty_bp.delete("/faculty/<int:faculty_id>")
@login_required
@role_required("chairperson")
def delete_faculty(faculty_id: int):
    faculty = db.session.get(User, faculty_id)
    if not faculty or faculty.role != "faculty":
        return jsonify({"error": "Faculty not found."}), 404

    db.session.delete(faculty)
    db.session.commit()
    return jsonify({"message": "Faculty removed."}), 200


@faculty_bp.post("/chairpersons")
@login_required
@role_required("chairperson")
def add_chairperson():
    """Create a chairperson account from the Chairperson Management UI."""
    body = request.get_json(silent=True) or {}
    chairperson_id = (body.get("chairperson_id") or "").strip().upper()
    first_name = (body.get("first_name") or "").strip()
    middle_name = (body.get("middle_name") or "").strip()
    last_name = (body.get("last_name") or "").strip()
    email = (body.get("email") or "").strip().lower()

    if not chairperson_id or not first_name or not last_name or not email:
        return jsonify({"error": "Chairperson ID, first name, last name, and email are required."}), 400
    if not chairperson_id.upper().startswith("CP-") or len(chairperson_id) < 4:
        return jsonify({"error": "Chairperson ID must use the CP-001 format."}), 400
    if User.query.filter_by(employee_number=chairperson_id).first():
        return jsonify({"error": f"Chairperson ID '{chairperson_id}' already exists."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": f"Email '{email}' already exists."}), 409

    age_raw = body.get("age")
    try:
        age = int(age_raw) if age_raw not in (None, "") else None
    except (TypeError, ValueError):
        return jsonify({"error": "Age must be a valid number."}), 400
    if age is not None and not 18 <= age <= 100:
        return jsonify({"error": "Age must be between 18 and 100."}), 400

    gender = (body.get("gender") or "").strip().lower()
    if gender not in ("", "male", "female"):
        return jsonify({"error": "Gender must be Male or Female."}), 400

    default_password = normalize_password(chairperson_id)
    chairperson = User(
        employee_number=chairperson_id,
        first_name=first_name,
        middle_name=middle_name or None,
        last_name=last_name,
        email=email,
        password_hash=generate_password_hash(default_password),
        role="chairperson",
        age=age,
        gender=gender or None,
        contact_number=(body.get("contact_number") or "").strip() or None,
        department=(body.get("department") or "Department of Information Technology").strip(),
        specialization="",
        academic_rank="",
        highest_educ_attainment="",
        exp_years=0,
        employment_type="Full Time",
        max_units=0,
        avatar=gender or "female",
    )
    db.session.add(chairperson)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not create the chairperson account. Please check the details and try again."}), 500

    return jsonify({
        "message": "Chairperson account created.",
        "chairperson": chairperson.to_dict(),
        "password": default_password,
    }), 201
