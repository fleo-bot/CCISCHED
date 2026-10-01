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
DELETE /api/availability/<submission_id>     — delete a submission entirely
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import csv
import io
import re

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


# ── CSV import constants ─────────────────────
DAY_NAME_TO_INDEX = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}
REQUIRED_IMPORT_COLUMNS = {"faculty_id", "day_of_week", "start_time", "end_time"}
OPTIONAL_IMPORT_COLUMNS = {"shift_block", "availability_id"}
FACULTY_ID_RE = re.compile(r"^FA-\d{3}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$")


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


# ── Chairperson: CSV availability import ─────
@availability_bp.post("/import-csv")
@login_required
@role_required("chairperson")
def import_availability_csv():
    """
    Import faculty availability from a CSV file into the same
    availability_submissions / availability_slots tables used by the UI.

    Required columns: faculty_id, day_of_week, start_time, end_time.
    Optional columns: shift_block, availability_id (ignored).

    Faculty IDs must match an existing users.employee_number in FA-### format.
    Invalid/unmatched rows are intentionally skipped without per-row errors.
    The semester is selected strictly by today's date falling within its
    start_date/end_date range.
    """
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"error": "Please select a CSV file to import."}), 400

    if not upload.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted."}), 400

    # Match the import to the semester whose date range contains today.
    today = date.today()
    semester = (Semester.query
                .filter(Semester.start_date.isnot(None), Semester.end_date.isnot(None))
                .filter(Semester.start_date <= today, Semester.end_date >= today)
                .order_by(Semester.start_date.desc())
                .first())
    if not semester:
        return jsonify({
            "error": "No semester date range contains today's date. The availability CSV was not imported.",
            "imported": 0,
            "skipped": 0,
        }), 409

    raw = upload.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify({"error": "The CSV file must be UTF-8 encoded."}), 400

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return jsonify({"error": "The CSV file has no header row."}), 400

    headers = {str(h).strip() for h in reader.fieldnames if h is not None}
    missing = REQUIRED_IMPORT_COLUMNS - headers
    if missing:
        return jsonify({
            "error": "The CSV is missing required columns: " + ", ".join(sorted(missing)) + "."
        }), 400

    # Import only rows that pass the documented matching rules.
    grouped: dict[int, list[dict]] = {}
    skipped = 0
    for row in reader:
        faculty_code = str(row.get("faculty_id", "")).strip()
        day_name = str(row.get("day_of_week", "")).strip()
        start = str(row.get("start_time", "")).strip()
        end = str(row.get("end_time", "")).strip()
        shift = str(row.get("shift_block", "") or "").strip()

        # Required fields and exact formats are deliberately strict.
        if not FACULTY_ID_RE.fullmatch(faculty_code):
            skipped += 1
            continue
        if day_name not in DAY_NAME_TO_INDEX:
            skipped += 1
            continue
        if not TIME_RE.fullmatch(start) or not TIME_RE.fullmatch(end):
            skipped += 1
            continue
        if start >= end:
            skipped += 1
            continue

        user = User.query.filter_by(employee_number=faculty_code, role="faculty").first()
        if not user:
            skipped += 1
            continue

        grouped.setdefault(user.id, []).append({
            "day_index": DAY_NAME_TO_INDEX[day_name],
            "start": start[:5],
            "end": end[:5],
            "shift": shift,
        })

    imported_faculty = 0
    imported_slots = 0

    for faculty_id, rows in grouped.items():
        submission = AvailabilitySubmission.query.filter_by(
            faculty_id=faculty_id, semester_id=semester.id
        ).first()

        if submission is None:
            submission = AvailabilitySubmission(
                faculty_id=faculty_id,
                semester_id=semester.id,
                status="submitted",
                submitted_at=datetime.now(timezone.utc),
            )
            db.session.add(submission)
            db.session.flush()
        else:
            # The CSV represents the complete availability set for the
            # matched faculty, so replace their existing imported slots.
            AvailabilitySlot.query.filter_by(submission_id=submission.id).delete()
            submission.status = "submitted"
            submission.submitted_at = submission.submitted_at or datetime.now(timezone.utc)

        for slot_number, row in enumerate(rows, start=1):
            db.session.add(AvailabilitySlot(
                submission_id=submission.id,
                slot_number=slot_number,
                day_indices=str(row["day_index"]),
                time_start=row["start"],
                time_end=row["end"],
                time_label=f'{row["start"]} – {row["end"]}',
            ))
            imported_slots += 1

        imported_faculty += 1

    db.session.commit()
    return jsonify({
        "message": "Availability CSV imported successfully.",
        "semester": semester.to_dict(),
        "imported_faculty": imported_faculty,
        "imported_slots": imported_slots,
        "skipped_rows": skipped,
    }), 200


# ── Chairperson: list all submissions ────────
@availability_bp.get("/all")
@login_required
@role_required("chairperson")
def get_all_submissions():
    """Return all submissions for the active semester with their status and slots."""
    sem = _active_semester()
    if not sem:
        return jsonify({"submissions": [], "message": "No active semester."}), 200

    subs = AvailabilitySubmission.query.filter_by(semester_id=sem.id).all()
    return jsonify({
        "semester":    sem.to_dict(),
        "submissions": [s.to_dict(include_slots=True) for s in subs],
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


@availability_bp.delete("/<int:submission_id>")
@login_required
@role_required("chairperson")
def delete_submission(submission_id: int):
    sub = db.session.get(AvailabilitySubmission, submission_id)
    if not sub:
        return jsonify({"error": "Submission not found."}), 404

    db.session.delete(sub)   # cascades to slots via relationship
    db.session.commit()
    return jsonify({"message": "Submission deleted."}), 200
