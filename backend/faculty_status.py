"""
faculty_status.py
------------------
Keeps faculty status notifications synchronized with the real availability
and schedule records for the active academic year.

A faculty member is considered to have submitted availability when they have
at least one availability submission in the target academic year whose status
is ``submitted`` or ``approved``. Draft/pending, rejected, or returned forms
do not count as a completed submission.

Notifications are treated as live alerts rather than permanent snapshots:
when a faculty member later submits availability or receives a teaching load,
any unread stale alert of the corresponding type is removed.
"""

from __future__ import annotations


from database import db
from models import (AvailabilitySubmission, FacultyAssignment, Notification,
                    Schedule, Semester, User)


def _notify_chairpersons(notif_type: str, title: str, message: str):
    chairs = User.query.filter_by(role="chairperson").all()
    for chair in chairs:
        db.session.add(Notification(
            user_id    = chair.id,
            notif_type = notif_type,
            title      = title,
            message    = message,
        ))


def _remove_stale_alerts(faculty: User, notif_type: str, academic_year: str):
    """Remove unread live-status alerts that are no longer true."""
    full_name = f"{faculty.first_name} {faculty.last_name}"
    notifications = (
        Notification.query
        .filter_by(notif_type=notif_type, is_read=False)
        .all()
    )
    for notif in notifications:
        if notif.message.startswith(full_name) and academic_year in notif.message:
            db.session.delete(notif)


def _target_academic_year() -> str | None:
    """The academic year belonging to the currently active semester."""
    active = Semester.query.filter_by(is_active=True).first()
    if active:
        return active.academic_year
    latest = Semester.query.order_by(Semester.start_date.desc()).first()
    return latest.academic_year if latest else None


def sync_faculty_status(academic_year: str | None = None, commit: bool = True) -> int:
    """
    Recompute faculty availability/load status and synchronize chairperson
    notifications. Returns the number of newly generated alerts.
    """
    academic_year = academic_year or _target_academic_year()
    if not academic_year:
        return 0

    semester_ids = [
        s.id for s in Semester.query.filter_by(academic_year=academic_year).all()
    ]
    if not semester_ids:
        return 0

    faculty = User.query.filter_by(role="faculty").all()
    newly_flagged = 0

    for fac in faculty:
        # A completed availability submission is one that has actually been
        # submitted for review or approved. A mere draft/pending row is not
        # enough to claim that the faculty member submitted availability.
        has_submission = (
            AvailabilitySubmission.query
            .filter(
                AvailabilitySubmission.faculty_id == fac.id,
                AvailabilitySubmission.semester_id.in_(semester_ids),
                AvailabilitySubmission.status.in_(("submitted", "approved")),
            )
            .first()
            is not None
        )

        # A teaching load exists once the faculty has an APPROVED assignment
        # (Stage 1) or a published schedule row (Stage 2).
        has_schedule = (
            FacultyAssignment.query
            .filter(
                FacultyAssignment.faculty_id == fac.id,
                FacultyAssignment.semester_id.in_(semester_ids),
                FacultyAssignment.status == "approved",
            )
            .first()
            is not None
        ) or (
            Schedule.query
            .filter(
                Schedule.faculty_id == fac.id,
                Schedule.semester_id.in_(semester_ids),
            )
            .first()
            is not None
        )

        # ── Availability status / alert ──
        if has_submission:
            fac.status = "active"
            # The old alert is now false. Remove unread copies so the
            # chairperson does not continue seeing an incorrect warning.
            _remove_stale_alerts(fac, "faculty_inactive", academic_year)
            fac.status_flagged_ay = None
        else:
            fac.status = "inactive"
            if fac.status_flagged_ay != academic_year:
                fac.status_flagged_ay = academic_year
                _notify_chairpersons(
                    "faculty_inactive",
                    "Faculty Inactive",
                    f"{fac.first_name} {fac.last_name} has not submitted any "
                    f"availability for AY {academic_year}.",
                )
                newly_flagged += 1

        # ── Teaching-load status / alert ──
        if has_schedule:
            fac.is_unassigned = False
            _remove_stale_alerts(fac, "faculty_unassigned", academic_year)
            fac.unassigned_flagged_ay = None
        else:
            fac.is_unassigned = True
            if fac.unassigned_flagged_ay != academic_year:
                fac.unassigned_flagged_ay = academic_year
                _notify_chairpersons(
                    "faculty_unassigned",
                    "No Teaching Load Assigned",
                    f"{fac.first_name} {fac.last_name} has no schedule "
                    f"assigned for AY {academic_year}.",
                )
                newly_flagged += 1

    if commit:
        db.session.commit()

    return newly_flagged
