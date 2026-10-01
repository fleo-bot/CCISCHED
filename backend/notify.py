"""
notify.py
---------
Notifications sent when the chairperson distributes work to faculty.

  * notify_assignments_distributed() — teaching assignments were approved
  * notify_timetables_distributed()  — timetables were published

Both add rows to the session only; the caller commits, so the notifications
are saved atomically with the change that triggered them.
"""

from __future__ import annotations

from collections import defaultdict

from database import db
from models import Notification, Semester, User


def _sem_label(sem: Semester | None) -> str:
    if not sem:
        return "the current semester"
    return f"{sem.semester_term} Semester AY {sem.academic_year}"


def _notify(user_id: int, notif_type: str, title: str, message: str):
    db.session.add(Notification(
        user_id=user_id, notif_type=notif_type, title=title, message=message,
    ))


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def _confirm_to_chairpersons(notif_type: str, title: str, message: str):
    for chair in User.query.filter_by(role="chairperson").all():
        _notify(chair.id, notif_type, title, message)


def notify_assignments_distributed(sem: Semester | None, sections_by_faculty: dict):
    """sections_by_faculty: {faculty_id: [course_code, ...]}"""
    label = _sem_label(sem)
    for faculty_id, codes in sections_by_faculty.items():
        unique = sorted({c for c in codes if c})
        listing = f" ({', '.join(unique[:4])}{'…' if len(unique) > 4 else ''})" if unique else ""
        _notify(
            faculty_id, "assignment_distributed", "New Teaching Assignment",
            f"Your teaching assignment for the {label} has been distributed: "
            f"{_plural(len(codes), 'section')}{listing}. "
            f"Check Teaching Assignments for details.",
        )
    if sections_by_faculty:
        _confirm_to_chairpersons(
            "assignment_distributed", "Assignments Distributed",
            f"Teaching assignments for the {label} were distributed to "
            f"{_plural(len(sections_by_faculty), 'faculty member')}.",
        )


def notify_timetables_distributed(sem: Semester | None, entries_by_faculty: dict):
    """entries_by_faculty: {faculty_id: number_of_class_sections}"""
    label = _sem_label(sem)
    for faculty_id, count in entries_by_faculty.items():
        _notify(
            faculty_id, "timetable_distributed", "Your Timetable is Ready",
            f"Your timetable for the {label} has been distributed "
            f"({_plural(count, 'class')}). You can now view and print it "
            f"under Schedule.",
        )
    if entries_by_faculty:
        _confirm_to_chairpersons(
            "timetable_distributed", "Timetables Distributed",
            f"Timetables for the {label} were distributed to "
            f"{_plural(len(entries_by_faculty), 'faculty member')}.",
        )
