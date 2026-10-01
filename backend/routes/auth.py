"""
routes/auth.py
--------------
POST /api/auth/login       — email + password → session
POST /api/auth/logout      — clear session
GET  /api/auth/me          — return current logged-in user
"""

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

from database import db
from models import User
from audit import log_action

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ── helpers ──────────────────────────────────
def current_user() -> User | None:
    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, uid)


def login_required(fn):
    """Decorator — returns 401 if no active session."""
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    """Decorator — returns 403 if user role not in allowed roles."""
    def decorator(fn):
        from functools import wraps
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user.role not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ── routes ───────────────────────────────────
@auth_bp.post("/login")
def login():
    """
    Body: { "email": "...", "password": "..." }
    Returns: user object + role
    """
    body     = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        # Log failed attempts too — attributed to the account if the email exists.
        log_action(user, "Failed login", category="auth", success=False, status_code=401,
                   user_name=email,
                   description=f"Failed login attempt for {email}")
        return jsonify({"error": "Invalid email or password."}), 401

    # Store minimal info in server-side session
    session["user_id"] = user.id
    session.permanent  = True

    log_action(user, "Logged in", category="auth", status_code=200,
               description=f"{user.first_name} {user.last_name} ({user.role}) logged in")

    return jsonify({
        "message": "Login successful.",
        "user":    user.to_dict(),
    }), 200


@auth_bp.post("/logout")
def logout():
    user = current_user()
    if user:
        log_action(user, "Logged out", category="auth", status_code=200,
                   description=f"{user.first_name} {user.last_name} ({user.role}) logged out")
    session.clear()
    return jsonify({"message": "Logged out."}), 200


@auth_bp.get("/me")
@login_required
def me():
    """Return the currently authenticated user."""
    user = current_user()
    return jsonify({"user": user.to_dict()}), 200
