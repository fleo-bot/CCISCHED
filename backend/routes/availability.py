"""
routes/availability.py
----------------------
Faculty-facing availability endpoints.

GET    /api/availability                     — get own submission for active semester
POST   /api/availability                     — create / replace own submission (saves slots)
POST   /api/availability/finalize            — finalize (submit) the draft
DELETE /api/availability/slots/<slot_id>     — remove a single slot from a draft

Chairperson-facing (read):
GET    /api/availability/all                 — all submissions for active semester
GET    /api/availability/<submission_id>     — single submission detail
"""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from database import db
from models import (
    AvailabilitySlot,
    AvailabilitySubmission,
    Notification,
    Semester,
    User,
)
from routes.auth import current_user, login_required, role_required

availability_bp = Blueprint("availability", __name__, url_prefix="/api/availability")


# ── helpers ──────────────────────────────────
def _active_semester() -> Semester | None:
    return Semester.query.filter_by(is_active=True).first()


def _notify(user_id: int, notif_type: str, title: str, message: str,
            related_submission_id: int | None = None):
    notif = Notification(
        user_id               = user_id,
        notif_type            = notif_type,
        title                 = title,
        message               = message,
        related_submission_id = related_submission_id,
    )
    db.session.add(notif)


# ── Faculty: get own submission ───────────────
@availability_bp.get("")
@login_required
def get_my_submission():
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"submission": None, "message": "No active semester."}), 200

    sub = AvailabilitySubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    return jsonify({
        "submission": sub.to_dict() if sub else None,
        "semester":   sem.to_dict(),
    }), 200


# ── Faculty: save / update slots ─────────────
@availability_bp.post("")
@login_required
@role_required("faculty")
def save_submission():
    """
    Creates or replaces the draft submission for the active semester.

    Body:
    {
      "slots": [
        { "slot_number": 1, "day_indices": [0,2,4], "time_start": "07:00",
          "time_end": "17:00", "time_label": "7:00 AM – 5:00 PM" },
        ...
      ]
    }

    A submission can only be edited while status is 'pending' or 'returned'.
    """
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400

    body  = request.get_json(silent=True) or {}
    slots = body.get("slots") or []

    if not slots:
        return jsonify({"error": "At least one slot is required."}), 400

    # Get or create submission
    sub = AvailabilitySubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    if sub and sub.status not in ("pending", "returned"):
        return jsonify({
            "error": f"Submission cannot be edited — current status is '{sub.status}'."
        }), 409

    if not sub:
        sub = AvailabilitySubmission(
            faculty_id  = user.id,
            semester_id = sem.id,
            status      = "pending",
        )
        db.session.add(sub)
        db.session.flush()   # get sub.id before adding slots

    # Replace existing slots
    AvailabilitySlot.query.filter_by(submission_id=sub.id).delete()

    for slot_data in slots:
        day_indices = slot_data.get("day_indices") or []
        slot = AvailabilitySlot(
            submission_id = sub.id,
            slot_number   = int(slot_data.get("slot_number", 1)),
            day_indices   = ",".join(str(d) for d in day_indices),
            time_start    = slot_data.get("time_start", "08:00"),
            time_end      = slot_data.get("time_end",   "17:00"),
            time_label    = slot_data.get("time_label", ""),
        )
        db.session.add(slot)

    db.session.commit()
    return jsonify({"message": "Availability saved.", "submission": sub.to_dict()}), 200


# ── Faculty: finalize (submit) ────────────────
@availability_bp.post("/finalize")
@login_required
@role_required("faculty")
def finalize_submission():
    """
    Locks the submission and notifies the chairperson.
    Status: pending → submitted
    """
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400

    sub = AvailabilitySubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    if not sub:
        return jsonify({"error": "No draft submission found. Please save slots first."}), 404

    if sub.status not in ("pending", "returned"):
        return jsonify({
            "error": f"Submission is already '{sub.status}' and cannot be finalized."
        }), 409

    if not sub.slots:
        return jsonify({"error": "Cannot finalize — no slots added."}), 400

    sub.status       = "submitted"
    sub.submitted_at = datetime.now(timezone.utc)

    # Notify all chairpersons
    chairs = User.query.filter_by(role="chairperson").all()
    for chair in chairs:
        _notify(
            user_id               = chair.id,
            notif_type            = "submission_received",
            title                 = "New Availability Submission",
            message               = (
                f"{user.first_name} {user.last_name} submitted their availability "
                f"for {sem.semester_term} Semester AY {sem.academic_year}."
            ),
            related_submission_id = sub.id,
        )

    db.session.commit()
    return jsonify({"message": "Submission finalized.", "submission": sub.to_dict()}), 200


# ── Faculty: delete a single slot ────────────
@availability_bp.delete("/slots/<int:slot_id>")
@login_required
@role_required("faculty")
def delete_slot(slot_id: int):
    user = current_user()
    slot = db.session.get(AvailabilitySlot, slot_id)

    if not slot:
        return jsonify({"error": "Slot not found."}), 404

    # Ensure the slot belongs to this faculty
    if slot.submission.faculty_id != user.id:
        return jsonify({"error": "Forbidden."}), 403

    if slot.submission.status not in ("pending", "returned"):
        return jsonify({"error": "Cannot delete slot — submission is already finalized."}), 409

    db.session.delete(slot)
    db.session.commit()
    return jsonify({"message": "Slot deleted."}), 200


# ── Chairperson: list all submissions ────────
@availability_bp.get("/all")
@login_required
@role_required("chairperson")
def get_all_submissions():
    """Return all submissions for the active semester with their status."""
    sem = _active_semester()
    if not sem:
        return jsonify({"submissions": [], "message": "No active semester."}), 200

    subs = AvailabilitySubmission.query.filter_by(semester_id=sem.id).all()
    return jsonify({
        "semester":    sem.to_dict(),
        "submissions": [s.to_dict(include_slots=False) for s in subs],
        "counts": {
            "total":     len(subs),
            "submitted": sum(1 for s in subs if s.status == "submitted"),
            "approved":  sum(1 for s in subs if s.status == "approved"),
            "rejected":  sum(1 for s in subs if s.status == "rejected"),
            "returned":  sum(1 for s in subs if s.status == "returned"),
            "pending":   sum(1 for s in subs if s.status == "pending"),
        },
    }), 200


# ── Chairperson: single submission detail ────
@availability_bp.get("/<int:submission_id>")
@login_required
@role_required("chairperson")
def get_submission(submission_id: int):
    sub = db.session.get(AvailabilitySubmission, submission_id)
    if not sub:
        return jsonify({"error": "Submission not found."}), 404
    return jsonify({"submission": sub.to_dict()}), 200
