"""
routes/profile.py
-----------------
GET   /api/profile          — get own profile
PATCH /api/profile          — update own profile fields
PATCH /api/profile/password — change password
"""

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from database import db
from models import User
from routes.auth import login_required, current_user

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

# Fields the user is allowed to update
UPDATABLE_FIELDS = [
    "first_name",
    "last_name",
    "email",
    "specialization",
    "academic_rank",
    "highest_educ_attainment",
    "exp_years",
    "preferred_courses",
    "preferred_days",
    "avatar",
]


@profile_bp.get("")
@login_required
def get_profile():
    return jsonify({"user": current_user().to_dict()}), 200


@profile_bp.patch("")
@login_required
def update_profile():
    """
    Accepts a JSON body with any subset of UPDATABLE_FIELDS.
    Example: { "first_name": "Maria", "avatar": "female" }
    """
    user = current_user()
    body = request.get_json(silent=True) or {}

    for field in UPDATABLE_FIELDS:
        if field in body:
            value = body[field]

            # Basic validations
            if field == "email":
                value = value.strip().lower()
                conflict = User.query.filter(
                    User.email == value,
                    User.id    != user.id
                ).first()
                if conflict:
                    return jsonify({"error": "Email already in use."}), 409

            if field == "exp_years":
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    return jsonify({"error": "exp_years must be an integer."}), 400

            if field == "avatar" and value not in ("male", "female"):
                return jsonify({"error": "avatar must be 'male' or 'female'."}), 400

            setattr(user, field, value)

    db.session.commit()
    return jsonify({"message": "Profile updated.", "user": user.to_dict()}), 200


@profile_bp.patch("/password")
@login_required
def change_password():
    """
    Body: { "current_password": "...", "new_password": "..." }
    """
    user = current_user()
    body = request.get_json(silent=True) or {}

    current_pw = body.get("current_password") or ""
    new_pw     = body.get("new_password")     or ""

    if not current_pw or not new_pw:
        return jsonify({"error": "Both current_password and new_password are required."}), 400

    if not check_password_hash(user.password_hash, current_pw):
        return jsonify({"error": "Current password is incorrect."}), 401

    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400

    user.password_hash = generate_password_hash(new_pw)
    db.session.commit()

    return jsonify({"message": "Password changed successfully."}), 200
