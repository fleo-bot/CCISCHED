"""
routes/review.py
----------------
Chairperson-only actions on availability submissions.

POST /api/review/<submission_id>/approve  — approve
POST /api/review/<submission_id>/reject   — reject (with remarks)
POST /api/review/<submission_id>/return   — return for revision (with remarks)
"""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from database import db
from models import AvailabilitySubmission, Notification, Semester, User
from routes.auth import current_user, login_required, role_required

review_bp = Blueprint("review", __name__, url_prefix="/api/review")


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


def _active_semester() -> Semester | None:
    return Semester.query.filter_by(is_active=True).first()


def _get_reviewable(submission_id: int):
    """
    Fetch the submission and validate it exists and is in 'submitted' state.
    Returns (submission, error_response) — one of them will be None.
    """
    sub = db.session.get(AvailabilitySubmission, submission_id)
    if not sub:
        return None, (jsonify({"error": "Submission not found."}), 404)
    if sub.status != "submitted":
        return None, (
            jsonify({"error": f"Submission status is '{sub.status}' — only 'submitted' can be reviewed."}),
            409,
        )
    return sub, None


# ── Approve ───────────────────────────────────
@review_bp.post("/<int:submission_id>/approve")
@login_required
@role_required("chairperson")
def approve(submission_id: int):
    chair = current_user()
    sub, err = _get_reviewable(submission_id)
    if err:
        return err

    sub.status      = "approved"
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = chair.id
    sub.remarks     = None

    sem = db.session.get(Semester, sub.semester_id)
    sem_label = f"{sem.semester_term} Semester AY {sem.academic_year}" if sem else "current semester"

    _notify(
        user_id               = sub.faculty_id,
        notif_type            = "submission_approved",
        title                 = "Availability Approved",
        message               = (
            f"Your availability submission for the {sem_label} has been approved "
            f"by the Chairperson."
        ),
        related_submission_id = sub.id,
    )

    db.session.commit()

    # Check if ALL submitted submissions are now approved → notify faculty of schedule
    _check_all_approved(sem)

    return jsonify({"message": "Submission approved.", "submission": sub.to_dict()}), 200


# ── Reject ────────────────────────────────────
@review_bp.post("/<int:submission_id>/reject")
@login_required
@role_required("chairperson")
def reject(submission_id: int):
    chair = current_user()
    sub, err = _get_reviewable(submission_id)
    if err:
        return err

    body    = request.get_json(silent=True) or {}
    remarks = (body.get("remarks") or "").strip()

    sub.status      = "rejected"
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = chair.id
    sub.remarks     = remarks or None

    sem = db.session.get(Semester, sub.semester_id)
    sem_label = f"{sem.semester_term} Semester AY {sem.academic_year}" if sem else "current semester"

    _notify(
        user_id               = sub.faculty_id,
        notif_type            = "submission_rejected",
        title                 = "Availability Rejected",
        message               = (
            f"Your availability submission for the {sem_label} was rejected."
            + (f" Remarks: {remarks}" if remarks else "")
        ),
        related_submission_id = sub.id,
    )

    db.session.commit()
    return jsonify({"message": "Submission rejected.", "submission": sub.to_dict()}), 200


# ── Return for revision ───────────────────────
@review_bp.post("/<int:submission_id>/return")
@login_required
@role_required("chairperson")
def return_for_revision(submission_id: int):
    chair = current_user()
    sub, err = _get_reviewable(submission_id)
    if err:
        return err

    body    = request.get_json(silent=True) or {}
    remarks = (body.get("remarks") or "").strip()

    if not remarks:
        return jsonify({"error": "Remarks are required when returning a submission."}), 400

    sub.status      = "returned"
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = chair.id
    sub.remarks     = remarks

    sem = db.session.get(Semester, sub.semester_id)
    sem_label = f"{sem.semester_term} Semester AY {sem.academic_year}" if sem else "current semester"

    _notify(
        user_id               = sub.faculty_id,
        notif_type            = "submission_returned",
        title                 = "Availability Returned for Revision",
        message               = (
            f"Your availability submission for the {sem_label} was returned for revision. "
            f"Remarks: {remarks}"
        ),
        related_submission_id = sub.id,
    )

    db.session.commit()
    return jsonify({"message": "Submission returned for revision.", "submission": sub.to_dict()}), 200


# ── Internal: notify all faculty once every submission is approved ──
def _check_all_approved(sem: Semester | None):
    """
    If every 'submitted' availability for the active semester is now approved,
    notify all faculty that their schedule has been published.
    """
    if not sem:
        return

    pending = AvailabilitySubmission.query.filter(
        AvailabilitySubmission.semester_id == sem.id,
        AvailabilitySubmission.status.in_(["submitted", "pending"])
    ).count()

    if pending > 0:
        return   # Still waiting on others

    # All done — notify every faculty who has an approved submission
    approved_subs = AvailabilitySubmission.query.filter_by(
        semester_id = sem.id,
        status      = "approved"
    ).all()

    sem_label = f"{sem.semester_term} Semester AY {sem.academic_year}"

    for sub in approved_subs:
        _notify(
            user_id               = sub.faculty_id,
            notif_type            = "schedule_published",
            title                 = "Your Schedule is Ready",
            message               = (
                f"All availability submissions for the {sem_label} have been approved. "
                f"Your teaching schedule has been generated. You can now view and print it."
            ),
            related_submission_id = sub.id,
        )

    db.session.commit()
