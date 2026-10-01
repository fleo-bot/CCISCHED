"""
audit.py
--------
Audit logging for CCISched.

Two ways things get logged:

1. AUTOMATIC — register_audit(app) installs before/after-request hooks that
   record every state-changing request (POST / PUT / PATCH / DELETE) made by a
   logged-in chairperson or faculty member, whether it succeeded or failed
   (a 403 from a faculty member poking a chairperson endpoint is logged too).
   New endpoints are covered automatically; unknown ones fall back to a
   generic "POST /api/whatever" entry until you add a friendly rule below.

2. EXPLICIT — log_action(...) for things the hooks can't see, i.e. login,
   failed login and logout (called from routes/auth.py).

Read-only GET requests are NOT logged (that would drown the useful entries).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from flask import g, request, session

from database import db
from models import (
    AuditLog, AvailabilitySlot, AvailabilitySubmission, Course, Section, User,
)

# ── Never store these request-body fields ────────────────────
_SENSITIVE = ("password", "token", "secret")
_MAX_DETAILS_CHARS = 4000

# Requests that are handled explicitly (or are pure noise) — skip in the hook.
_SKIP_RULES = {
    "/api/auth/login", "/api/auth/logout",
}

# ── Friendly rules: (METHOD, url_rule) -> (category, action, entity_type) ──
_RULES: dict[tuple[str, str], tuple[str, str, str | None]] = {
    # Availability (faculty)
    ("POST",   "/api/availability"):                         ("availability", "Saved availability",              "availability"),
    ("POST",   "/api/availability/finalize"):                ("availability", "Submitted availability",          "availability"),
    ("DELETE", "/api/availability/slots/<int:slot_id>"):     ("availability", "Removed availability slot",       "availability_slot"),
    ("POST",   "/api/availability/import-csv"):              ("availability", "Imported availability CSV",       "availability"),
    ("DELETE", "/api/availability/<int:submission_id>"):     ("availability", "Deleted availability submission", "availability"),
    # Review (chairperson)
    ("POST",   "/api/review/<int:submission_id>/approve"):   ("review", "Approved availability submission",      "availability"),
    ("POST",   "/api/review/<int:submission_id>/reject"):    ("review", "Rejected availability submission",      "availability"),
    ("POST",   "/api/review/<int:submission_id>/return"):    ("review", "Returned availability submission",      "availability"),
    # Profile
    ("PATCH",  "/api/profile"):                              ("profile", "Updated profile",                      "profile"),
    ("PATCH",  "/api/profile/password"):                     ("profile", "Changed password",                     "profile"),
    # Notifications
    ("PATCH",  "/api/notifications/<int:notif_id>/read"):    ("notifications", "Marked notification as read",    "notification"),
    ("PATCH",  "/api/notifications/read-all"):               ("notifications", "Marked all notifications as read", "notification"),
    ("DELETE", "/api/notifications/<int:notif_id>"):         ("notifications", "Dismissed notification",         "notification"),
    ("DELETE", "/api/notifications"):                        ("notifications", "Cleared all notifications",      "notification"),
    # Schedule
    ("POST",   "/api/schedule/publish"):                     ("schedule", "Published schedule",                  "schedule"),
    ("POST",   "/api/schedule/assign-rooms"):                ("schedule", "Assigned rooms",                      "schedule"),
    # Solver / generation
    ("POST",   "/api/generate/assignment"):                  ("generation", "Generated faculty assignment (draft)", "assignment"),
    ("POST",   "/api/generate/assignment/approve"):          ("generation", "Approved faculty assignment",       "assignment"),
    ("POST",   "/api/generate/assignment/discard"):          ("generation", "Discarded draft faculty assignment", "assignment"),
    ("POST",   "/api/generate/timetable"):                   ("generation", "Generated timetable",               "timetable"),
    # Courses / sections / assignments
    ("POST",   "/api/manage/courses"):                       ("courses", "Added course",                         "course"),
    ("PUT",    "/api/manage/courses/<int:course_id>"):       ("courses", "Edited course",                        "course"),
    ("DELETE", "/api/manage/courses/<int:course_id>"):       ("courses", "Deleted course",                       "course"),
    ("POST",   "/api/manage/course-assignments"):            ("courses", "Assigned course to faculty",           "assignment"),
    ("POST",   "/api/manage/semesters/<int:semester_id>/activate"): ("courses", "Switched active semester", "semester"),
    ("POST",   "/api/manage/sections"):                      ("courses", "Added section",                        "section"),
    ("PUT",    "/api/manage/sections/<int:section_id>"):     ("courses", "Edited section",                       "section"),
    ("DELETE", "/api/manage/sections/<int:section_id>"):     ("courses", "Deleted section",                      "section"),
    # Faculty management
    ("POST",   "/api/manage/faculty"):                       ("faculty", "Added faculty member",                 "faculty"),
    ("PUT",    "/api/manage/faculty/<int:faculty_id>"):      ("faculty", "Edited faculty member",                "faculty"),
    ("DELETE", "/api/manage/faculty/<int:faculty_id>"):      ("faculty", "Deleted faculty member",               "faculty"),
    # CSV import
    ("POST",   "/api/manage/import/<dataset>"):              ("import", "Imported CSV data",                     "import"),
}

_ENTITY_ARG = {
    "course_id": "course", "section_id": "section", "faculty_id": "faculty",
    "submission_id": "availability", "slot_id": "availability_slot",
    "notif_id": "notification", "dataset": "import", "semester_id": "semester",
}


# ─────────────────────────────────────────────────────────────
#  helpers
# ─────────────────────────────────────────────────────────────
def _full_name(u: User) -> str:
    return " ".join(p for p in (u.first_name, u.last_name) if p).strip() or u.email


def _redact(value):
    """Recursively drop sensitive keys from a JSON-ish structure."""
    if isinstance(value, dict):
        return {
            k: "[hidden]" if any(s in str(k).lower() for s in _SENSITIVE) else _redact(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact(v) for v in value[:50]]
    if isinstance(value, str) and len(value) > 300:
        return value[:300] + "…"
    return value


def _client_ip() -> str | None:
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or None


def _target_label(view_args: dict) -> str | None:
    """
    Human-readable name of the record a request is about. Resolved in
    before_request, i.e. BEFORE a delete runs, so deleted things keep a name.
    """
    try:
        if "course_id" in view_args:
            c = db.session.get(Course, view_args["course_id"])
            return f"{c.course_code} – {c.course_title}" if c else f"course #{view_args['course_id']}"
        if "section_id" in view_args:
            s = db.session.get(Section, view_args["section_id"])
            if s:
                code = s.course.course_code if s.course else "?"
                return f"{code} section {s.section_name}"
            return f"section #{view_args['section_id']}"
        if "faculty_id" in view_args:
            u = db.session.get(User, view_args["faculty_id"])
            return _full_name(u) if u else f"faculty #{view_args['faculty_id']}"
        if "submission_id" in view_args:
            sub = db.session.get(AvailabilitySubmission, view_args["submission_id"])
            if sub and sub.faculty:
                return f"{_full_name(sub.faculty)}'s availability submission"
            return f"submission #{view_args['submission_id']}"
        if "slot_id" in view_args:
            slot = db.session.get(AvailabilitySlot, view_args["slot_id"])
            if slot and slot.submission and slot.submission.faculty:
                return f"slot {slot.slot_number} of {_full_name(slot.submission.faculty)}"
            return f"slot #{view_args['slot_id']}"
        if "dataset" in view_args:
            return f"{view_args['dataset']} dataset"
    except Exception:
        db.session.rollback()
    return None


def _write(**fields) -> None:
    """Insert one row. Auditing must never break the request itself."""
    try:
        db.session.add(AuditLog(created_at=datetime.now(timezone.utc), **fields))
        db.session.commit()
    except Exception as exc:                       # pragma: no cover
        db.session.rollback()
        print(f"[audit] failed to write log entry: {exc}")


# ─────────────────────────────────────────────────────────────
#  explicit logging (login / logout)
# ─────────────────────────────────────────────────────────────
def log_action(user: User | None, action: str, *, category: str,
               description: str = "", success: bool = True,
               status_code: int | None = None, user_name: str | None = None,
               details: dict | None = None) -> None:
    _write(
        user_id     = user.id if user else None,
        user_name   = _full_name(user) if user else user_name,
        user_role   = user.role if user else None,
        category    = category,
        action      = action,
        description = description,
        method      = request.method,
        path        = request.path,
        status_code = status_code,
        success     = success,
        details     = json.dumps(_redact(details)) if details else None,
        ip_address  = _client_ip(),
    )


# ─────────────────────────────────────────────────────────────
#  automatic logging
# ─────────────────────────────────────────────────────────────
def register_audit(app) -> None:
    """Install the request hooks and make sure the table exists."""
    from models import AuditLog as _AL

    # Existing databases won't have the table yet, and create_all() is only
    # run by init_db.py — so create just this table on startup if missing.
    with app.app_context():
        try:
            _AL.__table__.create(db.engine, checkfirst=True)
        except Exception as exc:
            print(f"[audit] could not ensure audit_logs table: {exc}")

    @app.before_request
    def _audit_before():
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return
        if not request.path.startswith("/api/"):
            return
        # Resolve names now — after a DELETE the record is gone.
        g._audit_target = _target_label(request.view_args or {})
        g._audit_body = None
        if request.is_json:
            g._audit_body = _redact(request.get_json(silent=True))

    @app.after_request
    def _audit_after(response):
        try:
            if request.method in ("GET", "HEAD", "OPTIONS") or not request.path.startswith("/api/"):
                return response
            rule = request.url_rule.rule if request.url_rule else request.path
            if rule in _SKIP_RULES:
                return response

            uid = session.get("user_id")
            user = db.session.get(User, uid) if uid else None
            if not user:
                return response          # anonymous / expired — nothing to attribute

            category, action, entity_type = _RULES.get(
                (request.method, rule),
                ("other", f"{request.method} {rule}", None),
            )
            view_args = request.view_args or {}
            entity_id = next((str(v) for k, v in view_args.items() if k.endswith("_id")), None)
            if not entity_type:
                entity_type = next((t for k, t in _ENTITY_ARG.items() if k in view_args), None)

            ok     = response.status_code < 400
            target = getattr(g, "_audit_target", None)
            body   = getattr(g, "_audit_body", None)

            details: dict = {}
            if body:
                details["request"] = body
            if request.files:
                details["files"] = [f.filename for f in request.files.values()]
            if not ok and response.is_json and not response.direct_passthrough:
                err = (response.get_json(silent=True) or {}).get("error")
                if err:
                    details["error"] = err

            who  = _full_name(user)
            desc = f"{who} ({user.role}) — {action.lower()}"
            if target:
                desc += f": {target}"
            if not ok:
                desc += f" [FAILED {response.status_code}]"

            _write(
                user_id     = user.id,
                user_name   = who,
                user_role   = user.role,
                category    = category,
                action      = action,
                description = desc,
                entity_type = entity_type,
                entity_id   = entity_id,
                method      = request.method,
                path        = request.path,
                status_code = response.status_code,
                success     = ok,
                details     = json.dumps(details)[:_MAX_DETAILS_CHARS] if details else None,
                ip_address  = _client_ip(),
            )
        except Exception as exc:         # never let auditing break a response
            print(f"[audit] hook error: {exc}")
        return response
