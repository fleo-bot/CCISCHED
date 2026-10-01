"""
routes/courses.py
------------------
Course/Room/Section/Semester management — chairperson-only writes, both
roles can read.

GET    /api/manage/courses          — list all courses
POST   /api/manage/courses          — add a course                (chairperson)
PUT    /api/manage/courses/<id>     — edit a course                (chairperson)
DELETE /api/manage/courses/<id>     — delete a course              (chairperson)

GET    /api/manage/rooms            — list all rooms

GET    /api/manage/sections?course_id=<id>  — list sections (optionally filtered by course)
POST   /api/manage/sections         — add a section                (chairperson)
PUT    /api/manage/sections/<id>    — edit a section                (chairperson)
DELETE /api/manage/sections/<id>    — delete a section              (chairperson)

GET    /api/manage/semesters        — list semesters (for dropdowns)
"""

from __future__ import annotations

import re
from datetime import datetime, time
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request

from database import db
from models import (Course, Room, Section, Semester, FacultyAssignment, User,
                    ProgramCurriculum)
from routes.auth import login_required, role_required
from notify import notify_assignments_distributed

courses_bp = Blueprint("courses", __name__, url_prefix="/api/manage")


def _parse_time(val):
    """Accept 'HH:MM' or 'HH:MM:SS' from the frontend; return a time object."""
    if not val:
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(str(val).strip(), fmt).time()
        except ValueError:
            continue
    return None


# ── Courses ────────────────────────────────────────────────
@courses_bp.get("/courses")
@login_required
def list_courses():
    courses = Course.query.order_by(Course.course_code).all()
    return jsonify([c.to_dict() for c in courses]), 200


@courses_bp.post("/courses")
@login_required
@role_required("chairperson")
def add_course():
    body = request.get_json(silent=True) or {}
    code  = (body.get("code")  or "").strip()
    title = (body.get("title") or "").strip()

    if not code or not title:
        return jsonify({"error": "Course code and title are required."}), 400

    if Course.query.filter_by(course_code=code).first():
        return jsonify({"error": f"Course code '{code}' already exists."}), 409

    course = Course(
        course_code    = code,
        course_title   = title,
        units          = body.get("units") or 3,
        year_level     = body.get("yearLevel"),
        classification = body.get("classification"),
        description    = body.get("description"),
    )
    db.session.add(course)
    db.session.commit()
    return jsonify({"message": "Course added.", "course": course.to_dict()}), 201


@courses_bp.put("/courses/<int:course_id>")
@login_required
@role_required("chairperson")
def edit_course(course_id: int):
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({"error": "Course not found."}), 404

    body = request.get_json(silent=True) or {}
    code  = (body.get("code")  or "").strip()
    title = (body.get("title") or "").strip()

    if not code or not title:
        return jsonify({"error": "Course code and title are required."}), 400

    dupe = Course.query.filter(Course.course_code == code, Course.id != course_id).first()
    if dupe:
        return jsonify({"error": f"Course code '{code}' already exists."}), 409

    course.course_code    = code
    course.course_title   = title
    course.units          = body.get("units") or course.units
    course.year_level     = body.get("yearLevel", course.year_level)
    course.classification = body.get("classification", course.classification)
    course.description    = body.get("description", course.description)

    db.session.commit()
    return jsonify({"message": "Course updated.", "course": course.to_dict()}), 200


@courses_bp.delete("/courses/<int:course_id>")
@login_required
@role_required("chairperson")
def delete_course(course_id: int):
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({"error": "Course not found."}), 404

    db.session.delete(course)
    db.session.commit()
    return jsonify({"message": "Course removed."}), 200


# ── Manual course → faculty assignment ───────────────────────
# The Assign Courses page is course-level UI, while the scheduling model stores
# assignments per section.  These endpoints bridge the two: assigning a course
# assigns every section of that course in the active semester to the selected
# faculty member.
@courses_bp.get("/course-assignments")
@login_required
def list_course_assignments():
    """Return live course assignment state for the active semester."""
    semester = Semester.query.filter_by(is_active=True).first()
    if not semester:
        return jsonify({
            "semester": None,
            "courses": [],
            "faculty": [],
            "totals": {"total_courses": 0, "assigned_courses": 0, "unassigned_courses": 0},
        }), 200

    faculty = User.query.filter_by(role="faculty").order_by(User.last_name, User.first_name).all()

    # Read both approved and generated draft assignments. Approved wins when a
    # section has both, so the page reflects the most current persisted state.
    assignments = FacultyAssignment.query.filter(
        FacultyAssignment.semester_id == semester.id,
        FacultyAssignment.status.in_(["approved", "draft"]),
    ).order_by(FacultyAssignment.status.asc()).all()

    assignment_by_section = {}
    for assignment in assignments:
        current = assignment_by_section.get(assignment.section_id)
        if current is None or assignment.status == "approved":
            assignment_by_section[assignment.section_id] = assignment

    # Current teaching load = distinct courses with an approved assignment.
    faculty_course_ids = {f.id: set() for f in faculty}
    for a in assignments:
        section = a.section
        if section and section.course_id in {c.id for c in Course.query.filter_by(is_active=True).all()}:
            faculty_course_ids.setdefault(a.faculty_id, set()).add(section.course_id)

    course_rows = []
    active_courses = Course.query.filter_by(is_active=True).order_by(Course.course_code).all()

    for course in active_courses:
        sections = Section.query.filter_by(
            course_id=course.id, semester_id=semester.id
        ).all()
        # A course cannot be scheduled/assigned without an offering section.
        if not sections:
            continue

        assigned_faculty_ids = {
            assignment_by_section[s.id].faculty_id
            for s in sections
            if s.id in assignment_by_section
        }
        assigned_count = sum(1 for s in sections if s.id in assignment_by_section)

        # The chairperson only needs two states here:
        #   assigned   = every section of the course has a faculty assignment
        #   unassigned = at least one section is still without an assignment
        # Do not expose a separate "partial" state in this screen.  A fully
        # covered course remains selectable/editable so the chairperson can
        # reassign it at any time.
        if assigned_count == len(sections):
            assigned_to = next(iter(assigned_faculty_ids)) if len(assigned_faculty_ids) == 1 else None
            status = "assigned"
        else:
            assigned_to = None
            status = "unassigned"

        assigned_faculty = next(
            (f for f in faculty if f.id == assigned_to), None
        ) if assigned_to else None

        program = course.program or (
            "BSIT" if course.course_code.upper().startswith("IT") else
            "BSCS" if course.course_code.upper().startswith("CS") else None
        )
        course_type = (
            "Laboratory" if course.lab_units and not course.lec_units else "Lecture"
        )

        course_rows.append({
            "id": course.id,
            "code": course.course_code,
            "name": course.course_title,
            "dept": program or course.department or "CCIS",
            "units": course.units or 0,
            "type": course_type,
            "assignedTo": assigned_to,
            "assignedFaculty": {
                "id": assigned_faculty.id,
                "name": assigned_faculty.to_dict()["full_name"],
            } if assigned_faculty else None,
            "status": status,
            "sectionCount": len(sections),
            "assignedSectionCount": assigned_count,
        })

    assigned_courses = sum(1 for c in course_rows if c["status"] == "assigned")

    faculty_rows = []
    for f in faculty:
        faculty_rows.append({
            "id": f.id,
            "name": f"{f.first_name} {f.last_name}",
            "gender": f.gender or f.avatar or "female",
            "dept": "BSIT" if (f.department or "").lower().find("information") >= 0 else "BSCS",
            "department": f.department,
            "currentLoad": len(faculty_course_ids.get(f.id, set())),
            "maxUnits": f.max_units or semester.max_units_per_faculty or 21,
            "status": f.status,
        })

    return jsonify({
        "semester": semester.to_dict(),
        "courses": course_rows,
        "faculty": faculty_rows,
        "totals": {
            "total_courses": len(course_rows),
            "assigned_courses": assigned_courses,
            "unassigned_courses": len(course_rows) - assigned_courses,
        },
    }), 200


@courses_bp.get("/faculty-course-assignments")
@login_required
def list_faculty_course_assignments():
    """Return every faculty member and their effective course assignments for the active semester.

    This is intentionally faculty-first (rather than course-first) so the
    Schedule Completion page can show every faculty member, including those
    with zero assignments, and open a details view for the courses currently
    assigned to each person.
    """
    semester = Semester.query.filter_by(is_active=True).first()
    faculty = User.query.filter_by(role="faculty").order_by(User.last_name, User.first_name).all()

    if not semester:
        return jsonify({
            "semester": None,
            "faculty": [{
                "id": f.id,
                "employee_number": f.employee_number,
                "name": f"{f.first_name} {f.last_name}",
                "department": f.department,
                "program": None,
                "assignedCourseCount": 0,
                "courses": [],
            } for f in faculty],
            "totals": {"total_faculty": len(faculty), "total_courses": 0, "assigned_courses": 0},
        }), 200

    active_courses = Course.query.filter_by(is_active=True).all()
    offered_course_ids = {
        c.id for c in active_courses
        if Section.query.filter_by(course_id=c.id, semester_id=semester.id).first()
    }

    # Effective assignment per section: approved wins over draft if both exist.
    assignments = FacultyAssignment.query.filter(
        FacultyAssignment.semester_id == semester.id,
        FacultyAssignment.status.in_(["approved", "draft"]),
    ).all()
    assignment_by_section = {}
    for a in assignments:
        current = assignment_by_section.get(a.section_id)
        if current is None or (a.status == "approved" and current.status != "approved"):
            assignment_by_section[a.section_id] = a

    def normalize_program(value):
        raw = (value or "").strip().upper()
        if raw in {"IT", "BSIT"}:
            return "BSIT"
        if raw in {"CS", "BSCS"}:
            return "BSCS"
        return None

    def program_for_course(course):
        # Course.program is the owning track (IT/CS), but a common course can
        # be offered to either program. Use it only as a fallback.
        program = normalize_program(course.program)
        if program:
            return program
        code = (course.course_code or "").upper()
        if code.startswith("IT"):
            return "BSIT"
        if code.startswith("CS"):
            return "BSCS"
        return None

    def program_for_section(section):
        # Section.program_code is the authoritative program for an offering.
        # This is important for common courses such as COMP 001.
        return normalize_program(section.program_code) or program_for_course(section.course)

    def program_for_faculty(faculty_obj):
        dept = (faculty_obj.department or "").strip().lower()
        # Seeded data uses short department values "IT" and "CS", while some
        # deployments use the full department names.
        if dept in {"it", "bsit"} or "information technology" in dept:
            return "BSIT"
        if dept in {"cs", "bscs"} or "computer science" in dept:
            return "BSCS"

        # Fall back to the program of a section they currently teach.
        for a in assignments:
            if a.faculty_id != faculty_obj.id or not a.section:
                continue
            program = program_for_section(a.section)
            if program:
                return program
        return None

    faculty_course_map = {f.id: {} for f in faculty}
    for section_id, assignment in assignment_by_section.items():
        section = assignment.section
        course = section.course if section else None
        if not course or course.id not in offered_course_ids:
            continue

        course_map = faculty_course_map.setdefault(assignment.faculty_id, {})
        row = course_map.setdefault(course.id, {
            "id": course.id,
            "code": course.course_code,
            "name": course.course_title,
            "units": course.units or 0,
            "program": program_for_section(section),
            "programs": [],
            "sections": [],
            "sectionCount": 0,
            "status": assignment.status,
        })
        section_program = program_for_section(section)
        if section_program and section_program not in row["programs"]:
            row["programs"].append(section_program)
        if section.section_name not in row["sections"]:
            row["sections"].append(section.section_name)
        row["sectionCount"] = len(row["sections"])
        if assignment.status == "approved":
            row["status"] = "approved"

    faculty_rows = []
    for f in faculty:
        courses = list(faculty_course_map.get(f.id, {}).values())
        courses.sort(key=lambda c: c["code"])
        faculty_rows.append({
            "id": f.id,
            "employee_number": f.employee_number,
            "name": f"{f.first_name} {f.last_name}",
            "department": f.department,
            "program": program_for_faculty(f),
            "assignedCourseCount": len(courses),
            "courses": courses,
        })

    # Count offered/assigned courses by the PROGRAM OF EACH SECTION. A common
    # course (e.g. COMP 001) may be offered to both BSIT and BSCS, so using
    # Course.program alone would put it in the wrong tab.
    by_program = {
        "BSIT": {"total_courses": 0, "assigned_courses": 0},
        "BSCS": {"total_courses": 0, "assigned_courses": 0},
    }
    for course_id in offered_course_ids:
        sections = Section.query.filter_by(
            course_id=course_id, semester_id=semester.id
        ).all()

        for program in ("BSIT", "BSCS"):
            program_sections = [
                s for s in sections if program_for_section(s) == program
            ]
            if not program_sections:
                continue

            by_program[program]["total_courses"] += 1
            if all(s.id in assignment_by_section for s in program_sections):
                by_program[program]["assigned_courses"] += 1

    total_courses = sum(v["total_courses"] for v in by_program.values())
    assigned_courses = sum(v["assigned_courses"] for v in by_program.values())

    return jsonify({
        "semester": semester.to_dict(),
        "faculty": faculty_rows,
        "totals": {
            "total_faculty": len(faculty_rows),
            "total_courses": total_courses,
            "assigned_courses": assigned_courses,
            "by_program": by_program,
        },
    }), 200


@courses_bp.post("/course-assignments")
@login_required
@role_required("chairperson")
def assign_course_to_faculty():
    """Persist a course-level manual assignment for the active semester."""
    body = request.get_json(silent=True) or {}
    course_id = body.get("course_id")
    faculty_id = body.get("faculty_id")

    if not course_id or not faculty_id:
        return jsonify({"error": "course_id and faculty_id are required."}), 400

    semester = Semester.query.filter_by(is_active=True).first()
    if not semester:
        return jsonify({"error": "No active semester is configured."}), 400

    course = db.session.get(Course, course_id)
    if not course or not course.is_active:
        return jsonify({"error": "Course not found."}), 404

    faculty = db.session.get(User, faculty_id)
    if not faculty or faculty.role != "faculty":
        return jsonify({"error": "Faculty member not found."}), 404

    sections = Section.query.filter_by(
        course_id=course.id, semester_id=semester.id
    ).all()
    if not sections:
        return jsonify({
            "error": f"{course.course_code} has no section offering in the active semester."
        }), 409

    # Replace any existing draft/approved assignment for this course so the
    # page behaves as a true re-assignment control rather than creating dupes.
    section_ids = [s.id for s in sections]
    FacultyAssignment.query.filter(
        FacultyAssignment.semester_id == semester.id,
        FacultyAssignment.section_id.in_(section_ids),
    ).delete(synchronize_session=False)

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for section in sections:
        db.session.add(FacultyAssignment(
            semester_id=semester.id,
            faculty_id=faculty.id,
            section_id=section.id,
            rf_score=0.0,
            justification="Manual chairperson assignment.",
            status="approved",
            generated_at=now,
            approved_at=now,
        ))
        section.status = "assigned"

    notify_assignments_distributed(
        semester, {faculty.id: [course.course_code] * len(sections)}
    )
    db.session.commit()

    return jsonify({
        "message": f"{course.course_code} assigned to {faculty.first_name} {faculty.last_name}.",
        "course_id": course.id,
        "faculty_id": faculty.id,
        "semester_id": semester.id,
        "section_count": len(sections),
    }), 200


# ── Rooms (read-only for now) ────────────────────────────────
@courses_bp.get("/rooms")
@login_required
def list_rooms():
    rooms = Room.query.order_by(Room.room_code).all()
    return jsonify([r.to_dict() for r in rooms]), 200


@courses_bp.get("/room-availability")
@login_required
def room_availability():
    """Return live room availability from the active semester's published schedules.

    A room is occupied only when a published Schedule row for that room matches
    today's weekday and the current local time. Room records themselves do not
    contain a manual occupancy flag, so the schedule is the source of truth.
    """
    from models import Schedule

    semester = Semester.query.filter_by(is_active=True).first()
    rooms = Room.query.order_by(Room.room_code).all()

    # CCISched is operated in the Philippines; do not depend on the host
    # machine's timezone (which may be UTC).
    now = datetime.now(ZoneInfo("Asia/Manila"))
    day_name = now.strftime("%A")
    current_time = now.time().replace(tzinfo=None)

    schedules = []
    if semester:
        # Older published timetables were saved with room "TBA" because the
        # solver defers room choice. Give those rows a real room once so the
        # page has something to match against. Idempotent; a no-op when every
        # row already has a room.
        try:
            from routes.schedule import assign_missing_rooms
            assign_missing_rooms(semester.id)
        except Exception:  # never let a backfill problem break the page
            db.session.rollback()
        schedules = Schedule.query.filter_by(semester_id=semester.id).all()
        schedules = [
            e for e in schedules
            if (e.day or "").strip().lower() == day_name.lower()
        ]

    def parse_time(value):
        if not value:
            return None
        raw = str(value).strip()
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(raw, fmt).time()
            except ValueError:
                pass
        return None

    # Schedule.room is stored as "ROOMCODE (Building)" by publish_schedule.
    # Matching by the leading room code keeps this compatible with older rows.
    occupied_by_code = {}
    for entry in schedules:
        start = parse_time(entry.time_start)
        end = parse_time(entry.time_end)
        if not start or not end or not (start <= current_time < end):
            continue
        label = (entry.room or "").strip()
        if not label or label == "TBA":
            continue
        room_code = label.split(" ", 1)[0].strip().upper()
        occupied_by_code.setdefault(room_code, []).append({
            "course_code": entry.course_code,
            "course_title": entry.course_title,
            "section_name": entry.section_name,
            "time_start": entry.time_start,
            "time_end": entry.time_end,
            "faculty_id": entry.faculty_id,
        })

    result = []
    for room in rooms:
        current = occupied_by_code.get((room.room_code or "").strip().upper(), [])
        item = room.to_dict()
        item.update({
            "status": "occupied" if current else "available",
            "assigned_to": current,
            "checked_at": now.isoformat(),
            "semester_id": semester.id if semester else None,
            "day": day_name,
        })
        result.append(item)

    return jsonify({
        "rooms": result,
        "semester": semester.to_dict() if semester else None,
        "checked_at": now.isoformat(),
        "day": day_name,
        "current_time": now.strftime("%H:%M:%S"),
        "source": "published schedules",
    }), 200


# ── Sections ──────────────────────────────────────────────
@courses_bp.get("/sections")
@login_required
def list_sections():
    course_id = request.args.get("course_id", type=int)
    query = Section.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    sections = query.order_by(Section.section_name).all()
    return jsonify([s.to_dict() for s in sections]), 200


@courses_bp.post("/sections")
@login_required
@role_required("chairperson")
def add_section():
    body = request.get_json(silent=True) or {}
    course_id   = body.get("course_id")
    section_name = (body.get("section_name") or "").strip()
    semester_id = body.get("semester_id")

    if not course_id or not section_name or not semester_id:
        return jsonify({"error": "course_id, section_name, and semester_id are required."}), 400

    if not db.session.get(Course, course_id):
        return jsonify({"error": "Course not found."}), 404
    if not db.session.get(Semester, semester_id):
        return jsonify({"error": "Semester not found."}), 404

    room_id = body.get("room_id") or None
    if room_id and not db.session.get(Room, room_id):
        return jsonify({"error": "Room not found."}), 404

    section = Section(
        course_id            = course_id,
        section_name         = section_name,
        preferred_days       = body.get("preferred_days", ""),
        preferred_time_start = _parse_time(body.get("preferred_time_start")),
        preferred_time_end   = _parse_time(body.get("preferred_time_end")),
        room_id              = room_id,
        semester_id          = semester_id,
        status               = body.get("status", "open"),
    )
    db.session.add(section)
    db.session.commit()
    return jsonify({"message": "Section added.", "section": section.to_dict()}), 201


@courses_bp.put("/sections/<int:section_id>")
@login_required
@role_required("chairperson")
def edit_section(section_id: int):
    section = db.session.get(Section, section_id)
    if not section:
        return jsonify({"error": "Section not found."}), 404

    body = request.get_json(silent=True) or {}
    section_name = (body.get("section_name") or "").strip()
    if not section_name:
        return jsonify({"error": "section_name is required."}), 400

    room_id = body.get("room_id") or None
    if room_id and not db.session.get(Room, room_id):
        return jsonify({"error": "Room not found."}), 404

    semester_id = body.get("semester_id")
    if semester_id and not db.session.get(Semester, semester_id):
        return jsonify({"error": "Semester not found."}), 404

    section.section_name         = section_name
    section.preferred_days       = body.get("preferred_days", section.preferred_days)
    section.preferred_time_start = _parse_time(body.get("preferred_time_start")) or section.preferred_time_start
    section.preferred_time_end   = _parse_time(body.get("preferred_time_end")) or section.preferred_time_end
    section.room_id              = room_id
    section.semester_id          = semester_id or section.semester_id
    section.status               = body.get("status", section.status)

    db.session.commit()
    return jsonify({"message": "Section updated.", "section": section.to_dict()}), 200


@courses_bp.delete("/sections/<int:section_id>")
@login_required
@role_required("chairperson")
def delete_section(section_id: int):
    section = db.session.get(Section, section_id)
    if not section:
        return jsonify({"error": "Section not found."}), 404

    db.session.delete(section)
    db.session.commit()
    return jsonify({"message": "Section removed."}), 200


# ── Section assignment coverage (real data) ──
#    A section counts as covered as soon as ANY of these exists for it,
#    checked in this priority order:
#      1. published  — a row in the Schedule table (final timetable)
#      2. approved   — an approved FacultyAssignment
#      3. draft      — a freshly generated FacultyAssignment awaiting review
#    so generating (or approving) a faculty assignment updates coverage
#    immediately. Discarding a draft removes it again.
@courses_bp.get("/coverage")
@login_required
def section_coverage():
    from models import Schedule, FacultyAssignment

    semester_id = request.args.get("semester_id", type=int)
    semester = db.session.get(Semester, semester_id) if semester_id else \
               Semester.query.filter_by(is_active=True).first()

    if not semester:
        return jsonify({"courses": [], "totals": {
            "total_courses": 0, "total_sections": 0, "sections_covered": 0
        }}), 200

    def _name(user):
        return f"{user.first_name} {user.last_name}" if user else None

    # (course_code, section_name) -> name, from published Schedule rows.
    # Schedule doesn't reference Section by ID, so this string-key match is
    # how the two connect.
    published_lookup = {}
    for sch in Schedule.query.filter_by(semester_id=semester.id).all():
        key = (sch.course_code, sch.section_name)
        if key not in published_lookup:
            published_lookup[key] = _name(sch.faculty)

    # section_id -> name, from generated faculty assignments. Lower-priority
    # drafts are loaded first so approved rows overwrite them.
    generated_lookup = {}
    for status in ("draft", "approved"):
        for fa in FacultyAssignment.query.filter_by(
                semester_id=semester.id, status=status).all():
            name = _name(fa.faculty)
            if name:
                generated_lookup[fa.section_id] = (name, status)

    courses = Course.query.filter_by(is_active=True).order_by(Course.course_code).all()
    result = []
    total_sections = 0
    total_covered  = 0

    for course in courses:
        sections = Section.query.filter_by(course_id=course.id, semester_id=semester.id).all()
        sec_list = []
        covered = 0
        for sec in sections:
            assigned_to = published_lookup.get((course.course_code, sec.section_name))
            state = "published" if assigned_to else None
            if not assigned_to and sec.id in generated_lookup:
                assigned_to, state = generated_lookup[sec.id]
            if assigned_to:
                covered += 1
            sec_list.append({"label": sec.section_name, "assignedTo": assigned_to,
                             "state": state})

        total_sections += len(sections)
        total_covered  += covered

        result.append({
            "code":            course.course_code,
            "name":            course.course_title,
            "totalSections":   len(sections),
            "coveredSections": covered,
            "sections":        sec_list,
        })

    return jsonify({
        "courses": result,
        "totals": {
            "total_courses":    len(courses),
            "total_sections":   total_sections,
            "sections_covered": total_covered,
        },
    }), 200


# ── Semesters (read-only, real DB — for dropdowns) ───────────
@courses_bp.get("/semesters")
@login_required
def list_semesters():
    semesters = Semester.query.order_by(Semester.id.desc()).all()
    return jsonify([s.to_dict() for s in semesters]), 200


_YEAR_LEVELS = {1: "First Year", 2: "Second Year", 3: "Third Year", 4: "Fourth Year"}


def _term_number(semester: Semester) -> int | None:
    """'1st Term' / '1st' -> 1, '2nd Term' -> 2. The curriculum only defines 1 and 2."""
    m = re.match(r"\s*(\d)", semester.semester_term or "")
    n = int(m.group(1)) if m else None
    return n if n in (1, 2) else None


def _auto_offer_courses(target: Semester) -> dict:
    """Create the course offering (Section rows) for `target` from the program
    curriculum, so courses that weren't offered last semester become offered.

    Only runs when the target semester has NO sections yet, so it never
    overrides an offering the chairperson already set up by hand.

    Cohorts (e.g. "BSIT 2-1") are taken from the most recent other semester
    that has sections (preferring the same academic year). Within the same
    academic year the cohorts carry over unchanged (1st -> 2nd term). Across
    academic years each cohort moves up one year level and 4th-years drop
    off — new first-year cohorts can't be known and must be added by hand.
    """
    result = {"created": 0, "source": None, "promoted": False, "skipped": None}

    if Section.query.filter_by(semester_id=target.id).first():
        result["skipped"] = "already_has_sections"
        return result

    term = _term_number(target)
    if term is None:
        result["skipped"] = "unsupported_term"
        return result

    others = [s for s in Semester.query.filter(Semester.id != target.id)
              .order_by(Semester.id.desc()).all()
              if Section.query.filter_by(semester_id=s.id).first()]
    if not others:
        result["skipped"] = "no_source_cohorts"
        return result
    same_ay = [s for s in others if s.academic_year == target.academic_year]
    source = (same_ay or others)[0]
    promoted = source.academic_year != target.academic_year
    result["source"] = f"{source.academic_year} {source.semester_term}"
    result["promoted"] = promoted

    cohorts = {(sec.section_name, (sec.program_code or "").strip())
               for sec in Section.query.filter_by(semester_id=source.id).all()}

    created = 0
    for name, program in sorted(cohorts):
        rest = name.replace(program, "", 1).strip() if program else name
        if not rest or not rest[0].isdigit():
            continue
        year = int(rest[0])
        new_name = name
        if promoted:
            year += 1
            if year > 4:
                continue
            new_name = f"{program} {year}{rest[1:]}" if program else name
        level = _YEAR_LEVELS.get(year)
        if not level:
            continue

        for curr in ProgramCurriculum.query.filter_by(
                program_code=program, year_level=level, semester_offered=term).all():
            db.session.add(Section(
                course_id=curr.course_id, section_name=new_name,
                program_code=program, semester_id=target.id, status="open",
            ))
            created += 1

    db.session.flush()
    result["created"] = created
    return result


@courses_bp.post("/semesters/<int:semester_id>/activate")
@login_required
@role_required("chairperson")
def activate_semester(semester_id: int):
    """Make one semester THE active semester (exactly one is active at a time).

    Everything that reads "the active semester" — coverage, course offerings,
    faculty-assignment generation, availability, the dashboards — follows
    this switch, so the chairperson can move between terms without touching
    the database.
    """
    target = db.session.get(Semester, semester_id)
    if not target:
        return jsonify({"error": "Semester not found."}), 404

    Semester.query.filter(Semester.id != target.id, Semester.is_active.is_(True)) \
        .update({"is_active": False}, synchronize_session=False)
    target.is_active = True

    # Make the courses that belong to this term offered automatically.
    offering = _auto_offer_courses(target)
    db.session.commit()

    message = f"{target.academic_year} {target.semester_term} is now the active semester."
    if offering["created"]:
        message += (f" {offering['created']} section(s) were created from the "
                    f"curriculum, so this term's courses are now offered.")
        if offering["promoted"]:
            message += (" Cohorts were moved up one year level; add any new "
                        "first-year sections manually.")

    return jsonify({
        "message": message,
        "semester": target.to_dict(),
        "offering": offering,
    }), 200
