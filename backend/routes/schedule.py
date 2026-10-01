"""
routes/schedule.py
------------------
GET  /api/schedule                   — faculty's own schedule (active semester)
GET  /api/schedule/<faculty_id>      — chairperson: any faculty's schedule
POST /api/schedule/publish           — chairperson: persist generated schedule to DB
"""

from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from database import db
from models import Course, FacultyAssignment, Room, Schedule, Section, Semester, User
from routes.auth import current_user, login_required, role_required
from notify import notify_timetables_distributed
from room_allocator import (
    RoomAllocator, room_label, to_minutes, wanted_room_type,
)

schedule_bp = Blueprint("schedule", __name__, url_prefix="/api/schedule")

# Longest-match-first so "Th" isn't misread as "T" + "h", and "Sat" isn't
# misread as "S" + "at".
_DAY_TOKEN_RE = re.compile(r"Th|Sat|M|T|W|F|S")
_DAY_NAMES = {
    "M": "Monday", "T": "Tuesday", "W": "Wednesday",
    "Th": "Thursday", "F": "Friday", "Sat": "Saturday", "S": "Saturday",
}


def _expand_days(preferred_days: str) -> list[str]:
    """'MWF' -> ['Monday','Wednesday','Friday'], 'TTh' -> ['Tuesday','Thursday']."""
    tokens = _DAY_TOKEN_RE.findall(preferred_days or "")
    days = [_DAY_NAMES[t] for t in tokens if t in _DAY_NAMES]
    return days or ["Monday"]   # never silently drop a section entirely


def _active_semester() -> Semester | None:
    return Semester.query.filter_by(is_active=True).first()


# ── Chairperson: real teaching load per faculty ──
@schedule_bp.get("/loads")
@login_required
@role_required("chairperson")
def get_faculty_loads():
    """
    {faculty_id: total_assigned_units} for the active semester.

    Source of truth is the APPROVED FacultyAssignment rows (Stage 1), so the
    Faculty page updates as soon as an assignment is approved -- it no longer
    has to wait for a timetable to be generated and published.

    Each approved assignment contributes its course's units. For any faculty
    with no approved assignment, we fall back to summing published Schedule
    rows (covers older data where a timetable exists without an assignment).
    """
    sem = _active_semester()
    if not sem:
        return jsonify({}), 200

    loads: dict[int, int] = {}

    approved = (
        db.session.query(FacultyAssignment.faculty_id, Course.units)
        .join(Section, Section.id == FacultyAssignment.section_id)
        .join(Course, Course.id == Section.course_id)
        .filter(
            FacultyAssignment.semester_id == sem.id,
            FacultyAssignment.status == "approved",
        )
        .all()
    )
    for faculty_id, units in approved:
        loads[faculty_id] = loads.get(faculty_id, 0) + (units or 0)

    # Fallback: published schedule rows for faculty without approved assignments.
    entries = Schedule.query.filter_by(semester_id=sem.id).all()
    schedule_loads: dict[int, int] = {}
    for e in entries:
        schedule_loads[e.faculty_id] = schedule_loads.get(e.faculty_id, 0) + (e.units or 0)
    for faculty_id, units in schedule_loads.items():
        loads.setdefault(faculty_id, units)

    return jsonify(loads), 200


# ── Faculty: own schedule ─────────────────────
@schedule_bp.get("")
@login_required
def get_my_schedule():
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"schedule": [], "message": "No active semester."}), 200

    entries = (
        Schedule.query
        .filter_by(faculty_id=user.id, semester_id=sem.id)
        .order_by(Schedule.day, Schedule.time_start)
        .all()
    )

    return jsonify({
        "faculty":  user.to_dict(),
        "semester": sem.to_dict(),
        "schedule": [e.to_dict() for e in entries],
    }), 200


# ── Chairperson: any faculty's schedule ──────
@schedule_bp.get("/<int:faculty_id>")
@login_required
@role_required("chairperson")
def get_faculty_schedule(faculty_id: int):
    faculty = db.session.get(User, faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found."}), 404

    sem = _active_semester()
    if not sem:
        return jsonify({"schedule": [], "message": "No active semester."}), 200

    entries = (
        Schedule.query
        .filter_by(faculty_id=faculty_id, semester_id=sem.id)
        .order_by(Schedule.day, Schedule.time_start)
        .all()
    )

    return jsonify({
        "faculty":  faculty.to_dict(),
        "semester": sem.to_dict(),
        "schedule": [e.to_dict() for e in entries],
    }), 200


# ── Chairperson: persist a generated schedule ─
@schedule_bp.post("/publish")
@login_required
@role_required("chairperson")
def publish_schedule():
    """
    Called after the CP-SAT solver runs. Accepts the raw `assignments` array
    exactly as returned by POST /api/generate — pass it straight through,
    no reshaping needed on the frontend.

    Clears previous schedule for the active semester and inserts the new
    one. Each assignment covers a whole section's meeting pattern (e.g.
    preferred_days="MWF"), which gets expanded into one Schedule row per
    individual day. Room label and class_type (Lecture/Laboratory) are
    resolved server-side from room_id via the real Room table.

    Body:
    {
      "assignments": [
        {
          "faculty_id":       101,
          "course_code":      "COMP 016",
          "course_title":     "Web Development",
          "section_name":     "BSIT 3-3",
          "preferred_days":   "MWF",
          "time_start":       "07:30:00",
          "time_end":         "09:00:00",
          "room_id":          301,
          "units":            3
        },
        ...
      ]
    }
    """
    sem = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400

    body        = request.get_json(silent=True) or {}
    assignments = body.get("assignments") or []

    if not assignments:
        return jsonify({"error": "No assignments provided."}), 400

    # Pre-fetch rooms once so we're not hitting the DB per-assignment
    all_rooms   = Room.query.filter_by(is_active=True).all()
    rooms_by_id = {r.id: r for r in Room.query.all()}
    courses_by_code = {c.course_code: c for c in Course.query.all()}
    allocator   = RoomAllocator(all_rooms)

    # Wipe existing schedule for this semester
    Schedule.query.filter_by(semester_id=sem.id).delete()

    # ── Pass 1: normalise every assignment into (assignment, days) and lock in
    #    any room that was already chosen so it can't be double-booked.
    planned = []
    for a in assignments:
        if not a.get("faculty_id"):
            continue
        # Phase 2 assignments carry a single real assigned "day" already —
        # only fall back to expanding a multi-day pattern (e.g. "MWF") for
        # older-shaped assignment payloads that still use preferred_days.
        days = [a["day"]] if a.get("day") else _expand_days(a.get("preferred_days", ""))
        start = to_minutes(a.get("time_start", "07:30:00"))
        end   = to_minutes(a.get("time_end", "09:00:00"))
        preset = rooms_by_id.get(a.get("room_id"))
        if preset and start is not None and end is not None:
            allocator.reserve(preset.id, days, start, end)
        planned.append((a, days, start, end, preset))

    # ── Pass 2: save rows.  The solver defers rooms (room_id = 0), so pick a
    #    free room here; otherwise every row is stored as "TBA" and Room
    #    Availability can never show anything as occupied.
    inserted = 0
    unplaced = 0
    for a, days, start, end, room in planned:
        if room is None and start is not None and end is not None:
            course = courses_by_code.get(a.get("course_code", ""))
            room = allocator.pick(
                days, start, end,
                want_type=wanted_room_type(
                    getattr(course, "lec_units", 0), getattr(course, "lab_units", 0)
                ),
            )
            if room:
                allocator.reserve(room.id, days, start, end)

        if room:
            label, class_type = room_label(room), room.room_type
        else:
            label, class_type = "TBA", "Lecture"
            unplaced += 1

        for day in days:
            db.session.add(Schedule(
                faculty_id   = a["faculty_id"],
                semester_id  = sem.id,
                course_code  = a.get("course_code",  ""),
                course_title = a.get("course_title", ""),
                section_name = a.get("section_name", ""),
                class_type   = class_type,
                day          = day,
                time_start   = a.get("time_start", "07:30:00"),
                time_end     = a.get("time_end",   "09:00:00"),
                room         = label,
                units        = int(a.get("units", 3)),
            ))
            inserted += 1

    # Tell each faculty member their timetable is ready.
    classes_by_faculty: dict[int, set] = {}
    for a, _days, _start, _end, _room in planned:
        classes_by_faculty.setdefault(a["faculty_id"], set()).add(
            (a.get("course_code", ""), a.get("section_name", ""))
        )
    notify_timetables_distributed(
        sem, {fid: len(classes) for fid, classes in classes_by_faculty.items()}
    )

    db.session.commit()
    return jsonify({
        "message":  f"Schedule published — {inserted} entries saved."
                    + (f" {unplaced} section(s) could not be given a free room." if unplaced else ""),
        "semester": sem.to_dict(),
    }), 201


# ── Backfill rooms for rows that were published without one ──
def assign_missing_rooms(semester_id: int) -> int:
    """Give a conflict-free room to every published Schedule row that is still
    "TBA" (or blank).  Idempotent: rows that already have a room are left alone
    and their slots are treated as booked.  Returns the number of rows updated.

    A section's meeting days are kept together in one room, so all rows that
    share (faculty, course, section, start, end) are placed as a single group.
    """
    entries = Schedule.query.filter_by(semester_id=semester_id).all()
    missing = [e for e in entries if not (e.room or "").strip()
               or (e.room or "").strip().upper() == "TBA"]
    if not missing:
        return 0

    rooms = Room.query.filter_by(is_active=True).all()
    by_code = {r.room_code.strip().upper(): r for r in rooms}
    allocator = RoomAllocator(rooms)

    # Existing bookings first.
    for e in entries:
        label = (e.room or "").strip()
        if not label or label.upper() == "TBA":
            continue
        room = by_code.get(label.split(" ", 1)[0].strip().upper())
        s, en = to_minutes(e.time_start), to_minutes(e.time_end)
        if room and s is not None and en is not None:
            allocator.reserve(room.id, [e.day], s, en)

    courses_by_code = {c.course_code: c for c in Course.query.all()}
    groups: dict[tuple, list] = {}
    for e in missing:
        key = (e.faculty_id, e.course_code, e.section_name, e.time_start, e.time_end)
        groups.setdefault(key, []).append(e)

    updated = 0
    for (_, code, _, ts, te), rows in groups.items():
        s, en = to_minutes(ts), to_minutes(te)
        if s is None or en is None:
            continue
        days = [r.day for r in rows]
        course = courses_by_code.get(code)
        room = allocator.pick(
            days, s, en,
            want_type=wanted_room_type(
                getattr(course, "lec_units", 0), getattr(course, "lab_units", 0)
            ),
        )
        if not room:
            continue
        allocator.reserve(room.id, days, s, en)
        for r in rows:
            r.room = room_label(room)
            r.class_type = room.room_type
            updated += 1

    db.session.commit()
    return updated


@schedule_bp.post("/assign-rooms")
@login_required
@role_required("chairperson")
def assign_rooms():
    """Manually (re)run room assignment for rows still marked TBA."""
    sem = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400
    updated = assign_missing_rooms(sem.id)
    return jsonify({"message": f"Assigned rooms to {updated} schedule entries.",
                    "updated": updated}), 200
