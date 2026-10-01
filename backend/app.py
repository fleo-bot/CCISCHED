"""
app.py
------
Flask REST API for CCISched.

Endpoints
─────────
  Scheduling (two independent CP-SAT stages, RF only in the first):
    GET  /api/health                     Server status + solver info
    POST /api/generate/assignment        STAGE 1: RF + CP-SAT decide who
                                          teaches what; saved as a DRAFT
                                          FacultyAssignment (no day/time yet)
    POST /api/generate/assignment/approve  Promote the current draft to
                                          "approved" (replaces the prior
                                          approved assignment, if any)
    POST /api/generate/assignment/discard  Delete the current draft
    GET  /api/generate/assignment/status   Approved/draft counts for a
                                          semester (gates "Generate Timetable")
    POST /api/generate/timetable         STAGE 2: reads the semester's
                                          currently APPROVED FacultyAssignment
                                          rows from the DB (does not re-run
                                          Stage 1/RF) and places each into a
                                          real day/time slot
    GET  /api/faculty         Faculty list
    GET  /api/courses         Active course list
    GET  /api/semesters       All semesters (active one flagged)

  Database API (auth, profile, availability, notifications):
    Registered via blueprints — see routes/
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from database import configure_db, db
from models import (
    User, Course, Room, Section, Semester,
    AvailabilitySubmission, AvailabilitySlot, FacultyCourseQualification,
    FacultyAssignment, Schedule,
)
from rf_model import compute_scores
from cpsat_solver import (
    solve_faculty_assignment, solve_timetable,
    ORTOOLS_AVAILABLE, build_faculty_slot_availability, DAY_BLOCKS,
)
from routes.auth import login_required, role_required, current_user
from notify import notify_assignments_distributed
from id_utils import fa_to_id


# ──────────────────────────────────────────────
#  App factory
# ──────────────────────────────────────────────
def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # Frontend (Live Server, typically 127.0.0.1:5500) and backend (localhost:5000)
    # are different "sites" as far as cookies are concerned, even on the same
    # machine. Flask's default SameSite=Lax silently drops the session cookie
    # on this kind of cross-site fetch — SameSite=None + Secure=True lets it
    # through. Browsers treat loopback addresses (localhost/127.0.0.1) as a
    # trustworthy context, so Secure cookies still work here over plain HTTP.
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"]   = True

    # Database (SQLAlchemy + sessions)
    configure_db(app)

    # Auto-initialize database BEFORE any routes are registered
    from auto_init_db import auto_init_database
    auto_init_database(app)

    # CORS — allow frontend on localhost:5500
    CORS(app, supports_credentials=True, origins=[
        "http://127.0.0.1:5500", "http://localhost:5500",
        "http://127.0.0.1:5501", "http://localhost:5501",
        "https://ccisched-backend.vercel.app",  # Production frontend
    ])

    # Register database API blueprints
    from routes.auth          import auth_bp
    from routes.profile       import profile_bp
    from routes.availability  import availability_bp
    from routes.review        import review_bp
    from routes.notifications import notifications_bp
    from routes.schedule      import schedule_bp
    from routes.courses       import courses_bp
    from routes.faculty       import faculty_bp
    from routes.imports       import imports_bp
    from routes.audit         import audit_bp

    @app.after_request
    def _no_cache(resp):
        resp.headers["Cache-Control"] = "no-store"
        return resp

    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(availability_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(schedule_bp)
    app.register_blueprint(courses_bp)
    app.register_blueprint(faculty_bp)
    app.register_blueprint(imports_bp)
    app.register_blueprint(audit_bp)

    # Audit log: records every state-changing action by chairperson/faculty
    from audit import register_audit
    register_audit(app)

    # Register legacy CSV-based scheduler routes (kept for backward compat)
    register_scheduler_routes(app)

    return app


# ──────────────────────────────────────────────
#  Legacy scheduler routes (CSV-based)
# ──────────────────────────────────────────────
def register_scheduler_routes(app: Flask):
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR / "data"

    # Historical assignments remain CSV-based bootstrap training data for the
    # RF model — there's no live "confirmed past assignment" table yet, and
    # unlike faculty/courses/sections this doesn't represent current-state
    # institutional data that needs to stay in sync with chairperson edits.
    hist_df = pd.read_csv(DATA_DIR / "CCISched-Historical-Data.csv")
    hist_df.columns = [c.strip() for c in hist_df.columns]
    hist_df["faculty_id"] = hist_df["faculty_id"].apply(fa_to_id)

    # ── Live DataFrame builders — query the DB fresh on every call, so
    #    anything a chairperson adds/edits via /api/manage/* is immediately
    #    reflected the next time a schedule is generated. ──
    def _faculty_df() -> pd.DataFrame:
        cols = ["faculty_id", "employee_number", "first_name", "last_name", "email",
                "specialization", "academic_rank", "highest_educ_attainment", "exp_years",
                "employment_type", "max_units", "preferred_courses", "preferred_days",
                "time_preference_mon", "time_preference_tue", "time_preference_wed",
                "time_preference_thu", "time_preference_fri", "time_preference_sat",
                "department"]
        rows = User.query.filter_by(role="faculty").all()
        data = [{
            "faculty_id":              u.id,
            "employee_number":         u.employee_number,
            "first_name":              u.first_name,
            "last_name":               u.last_name,
            "email":                   u.email,
            "specialization":          u.specialization or "",
            "academic_rank":           u.academic_rank or "",
            "highest_educ_attainment": u.highest_educ_attainment or "",
            "exp_years":               u.exp_years or 0,
            "employment_type":         u.employment_type or "Full Time",
            "max_units":               u.max_units or 21,
            "preferred_courses":       u.preferred_courses or "",
            "preferred_days":          u.preferred_days or "",
            "time_preference_mon":     u.time_preference_mon or "Not available",
            "time_preference_tue":     u.time_preference_tue or "Not available",
            "time_preference_wed":     u.time_preference_wed or "Not available",
            "time_preference_thu":     u.time_preference_thu or "Not available",
            "time_preference_fri":     u.time_preference_fri or "Not available",
            "time_preference_sat":     u.time_preference_sat or "Not available",
            "department":              u.department or "",
        } for u in rows]
        return pd.DataFrame(data, columns=cols)

    def _courses_df(active_only: bool = True) -> pd.DataFrame:
        cols = ["course_id", "course_code", "course_title", "units", "is_active"]
        query = Course.query.filter_by(is_active=True) if active_only else Course.query
        rows = query.all()
        data = [{
            "course_id":    c.id,
            "course_code":  c.course_code,
            "course_title": c.course_title,
            "units":        c.units or 3,
            "is_active":    int(bool(c.is_active)),
        } for c in rows]
        return pd.DataFrame(data, columns=cols)

    def _rooms_df() -> pd.DataFrame:
        cols = ["room_id", "room_code", "building", "capacity", "room_type", "is_active"]
        rows = Room.query.filter_by(is_active=True).all()
        data = [{
            "room_id":   r.id,
            "room_code": r.room_code,
            "building":  r.building or "",
            "capacity":  r.capacity or 40,
            "room_type": r.room_type or "Lecture",
            "is_active": int(bool(r.is_active)),
        } for r in rows]
        return pd.DataFrame(data, columns=cols)

    def _sections_df(semester_id: int | None = None) -> pd.DataFrame:
        cols = ["section_id", "course_id", "section_name", "program_code",
                "preferred_days", "preferred_time_start", "preferred_time_end",
                "room_id", "semester_id", "status"]
        query = Section.query.filter_by(semester_id=semester_id) if semester_id else Section.query
        rows = query.all()
        data = [{
            "section_id":           s.id,
            "course_id":            s.course_id,
            "section_name":         s.section_name,
            "program_code":         s.program_code or "",
            "preferred_days":       s.preferred_days or "MWF",
            "preferred_time_start": s.preferred_time_start.strftime("%H:%M:%S") if s.preferred_time_start else "07:30:00",
            "preferred_time_end":   s.preferred_time_end.strftime("%H:%M:%S") if s.preferred_time_end else "09:00:00",
            "room_id":              s.room_id or 0,
            "semester_id":          s.semester_id,
            "status":               s.status,
        } for s in rows]
        return pd.DataFrame(data, columns=cols)

    def _build_faculty_slots(semester_id: int) -> dict[int, set[int]]:
        """
        Convert real, chairperson-APPROVED AvailabilitySubmission/
        AvailabilitySlot data for this semester into
        {faculty_id: {slot_idx, ...}} using the shared global slot grid.
        Faculty with no approved submission simply get an empty set (no
        candidacy) rather than crashing — matches accounts with no real
        availability data (e.g. demo accounts).

        Only "approved" submissions are used — a pending, returned or
        rejected submission isn't yet the faculty's confirmed availability
        and shouldn't be scheduled against.

        Each real (day_indices, time_start, time_end) slot is passed through
        untouched to build_faculty_slot_availability(), which maps it onto
        the grid by time overlap — not by matching a "08:xx"/"13:xx" shift
        label, which would silently drop anything outside the original seed
        data's two boundaries (e.g. a faculty's real 9:00 AM-1:30 PM slot,
        or any evening availability).
        """
        raw: dict[int, list[dict]] = {}
        subs = AvailabilitySubmission.query.filter_by(
            semester_id=semester_id, status="approved"
        ).all()
        faculty_ids = {u.id for u in User.query.filter_by(role="faculty").all()}
        for sub in subs:
            if sub.faculty_id not in faculty_ids:
                continue   # availability attached to a non-faculty account
            slots = AvailabilitySlot.query.filter_by(submission_id=sub.id).all()
            for slot in slots:
                day_indices = [int(d) for d in (slot.day_indices or "").split(",") if d.strip().isdigit()]
                if not day_indices:
                    continue
                raw.setdefault(sub.faculty_id, []).append({
                    "day_indices": day_indices,
                    "time_start":  slot.time_start,
                    "time_end":    slot.time_end,
                })
        return build_faculty_slot_availability(raw)

    def _build_qualified_by_course() -> dict[int, set[int]]:
        """{course_id: {faculty_id, ...}} from FacultyCourseQualification —
        used only to prune which (faculty, section) candidates the solver
        considers, keeping the model tractable."""
        result: dict[int, set[int]] = {}
        for q in FacultyCourseQualification.query.all():
            result.setdefault(q.course_id, set()).add(q.faculty_id)
        return result

    def _resolve_semester(academic_year: str, semester_term: str) -> Semester | None:
        """Match the requested (academic_year, semester) to a real Semester
        row; fall back to whichever semester is flagged active if there's no
        exact match, so generation still works with a slightly mismatched
        request rather than silently returning nothing."""
        exact = Semester.query.filter_by(
            academic_year=academic_year, semester_term=semester_term
        ).first()
        if exact:
            return exact
        return Semester.query.filter_by(is_active=True).first()

    def _room_label(room_id: int, rooms_df: pd.DataFrame) -> str:
        if not room_id:
            return "TBA"
        match = rooms_df[rooms_df["room_id"] == room_id]
        if match.empty:
            return "TBA"
        r = match.iloc[0]
        return f"{r['room_code']} ({r['building']})"

    def _group_by_faculty(assignments: list[dict], rooms_df: pd.DataFrame,
                           include_schedule: bool = True) -> list[dict]:
        """
        include_schedule=False is used by the faculty-ASSIGNMENT-only result
        (before Stage 2 has decided any day/time) — course rows are shown
        without a day/time, instead of reading fields that don't exist yet.
        """
        grouped: dict[int, dict] = {}
        for row in assignments:
            fid = row["faculty_id"]
            if fid not in grouped:
                grouped[fid] = {
                    "id":              fid,
                    "name":            row["faculty_name"],
                    "employment_type": row["employment_type"],
                    "load":            0,
                    "max_units":       row["max_units"],
                    "rf_score":        row["rf_score"],
                    "courses":         [],
                    "course_details":  [],
                }
            entry = grouped[fid]
            entry["load"] += row["units"]
            has_schedule = include_schedule and row.get("day") and row.get("time_start")
            if has_schedule:
                time_label = f"{row['time_start'][:5]}–{row['time_end'][:5]}"
                entry["courses"].append(
                    f"{row['course_code']} \u2013 {row['course_title']}"
                    f"  [{row['day']} {time_label}]"
                )
                days_val, time_val = row["day"], time_label
            else:
                entry["courses"].append(f"{row['course_code']} \u2013 {row['course_title']}")
                days_val, time_val = "", ""
            entry["course_details"].append({
                "code":          row["course_code"],
                "title":         row["course_title"],
                "section":       row["section_name"],
                "program_code":  row.get("program_code", ""),
                "days":          days_val,
                "time":          time_val,
                "room":          "TBA",   # room assignment deferred
                "units":         row["units"],
                "type":          "Lecture",
                "justification": row["justification"],
            })
        return list(grouped.values())

    def _group_by_department(assignments: list[dict]) -> list[dict]:
        bscs_fac, bsit_fac = set(), set()
        for row in assignments:
            if row.get("program_code") == "BSCS":
                bscs_fac.add(row["faculty_id"])
            elif row.get("program_code") == "BSIT":
                bsit_fac.add(row["faculty_id"])
        return [
            {"department": "Bachelor of Science in Computer Science",
             "totalFaculty": len(bscs_fac), "status": "Completed"},
            {"department": "Bachelor of Science in Information Technology",
             "totalFaculty": len(bsit_fac), "status": "Completed"},
        ]

    def _dept_detail(faculty_view: list[dict]) -> dict:
        bscs_faculty, bsit_faculty = [], []
        for f in faculty_view:
            cs_det = [d for d in f["course_details"] if d.get("program_code") == "BSCS"]
            it_det = [d for d in f["course_details"] if d.get("program_code") == "BSIT"]
            justif = f["course_details"][0]["justification"] if f["course_details"] else ""
            if cs_det:
                bscs_faculty.append({
                    "name":         f["name"],
                    "type":         f["employment_type"],
                    "load":         f["load"],
                    "max":          f["max_units"],
                    "score":        f["rf_score"],
                    "department":   "Computer Science",
                    "justification": justif,
                    "courses": [
                        {"code": d["code"], "desc": d["title"].upper(),
                         "type": d["type"].upper(), "units": d["units"]}
                        for d in cs_det
                    ],
                })
            if it_det:
                bsit_faculty.append({
                    "name":         f["name"],
                    "type":         f["employment_type"],
                    "load":         f["load"],
                    "max":          f["max_units"],
                    "score":        f["rf_score"],
                    "department":   "Information Technology",
                    "justification": justif,
                    "courses": [
                        {"code": d["code"], "desc": d["title"].upper(),
                         "type": d["type"].upper(), "units": d["units"]}
                        for d in it_det
                    ],
                })
        return {
            "0": {"label": "BSCS", "title": "GENERATED PREVIEW: BSCS DEPARTMENT",
                  "faculty": bscs_faculty},
            "1": {"label": "BSIT", "title": "GENERATED PREVIEW: BSIT DEPARTMENT",
                  "faculty": bsit_faculty},
        }

    def _timetable_by_faculty(assignments: list[dict]) -> dict[int, list[dict]]:
        # Same 9 columns as the solver's own SLOT_GRID / the availability
        # form's TIME_BLOCKS (was missing the 7:30-9:00 PM evening column,
        # which silently misplaced any evening class into column 0).
        TIME_SLOTS = [s for s, _ in DAY_BLOCKS]
        result: dict[int, list[dict]] = {}
        for row in assignments:
            fid   = row["faculty_id"]
            start = int(row["time_start"].split(":")[0]) * 60 + int(row["time_start"].split(":")[1])
            col = TIME_SLOTS.index(start) if start in TIME_SLOTS else 0
            result.setdefault(fid, [])
            result[fid].append({
                "day":     row["day"],
                "col":     col,
                "code":    row["course_code"],
                "name":    row["course_title"],
                "section": row["section_name"],
            })
        return result

    # ── Routes ──
    @app.get("/")
    def index():
        return {"status": "CCISched backend running", "database": "connected"}, 200

    @app.get("/api/health")
    def health():
        active_sem = Semester.query.filter_by(is_active=True).first()
        return jsonify({
            "status":            "ok",
            "ortools_available": ORTOOLS_AVAILABLE,
            "solver_mode":       "CP-SAT" if ORTOOLS_AVAILABLE else "Greedy fallback",
            "faculty_count":     User.query.filter_by(role="faculty").count(),
            "course_count":      Course.query.filter_by(is_active=True).count(),
            "section_count":     Section.query.count(),
            "room_count":        Room.query.filter_by(is_active=True).count(),
            "history_rows":      len(hist_df),
            "active_semester":   active_sem.to_dict() if active_sem else {},
        })

    @app.post("/api/generate/assignment")
    @login_required
    @role_required("chairperson")
    def generate_assignment():
        """
        STAGE 1 only. Runs the RF + the faculty-assignment CP-SAT model,
        persists the result as DRAFT FacultyAssignment rows (replacing any
        previous draft for this semester — a regenerate replaces the draft,
        it does not touch whatever is currently APPROVED), and returns a
        review-page shape with no day/time in it (Stage 2 hasn't run).
        """
        body          = request.get_json(silent=True) or {}
        academic_year = body.get("academic_year", "2025-2026")
        semester      = body.get("semester", "1st")

        target_sem = _resolve_semester(academic_year, semester)
        if not target_sem:
            return jsonify({"error": "No matching or active semester found. "
                                      "Add one in the database first."}), 400

        faculty_df  = _faculty_df()
        courses_df  = _courses_df(active_only=True)
        sections_df = _sections_df(semester_id=target_sem.id)

        if faculty_df.empty:
            return jsonify({"error": "No faculty accounts found. Add faculty before generating."}), 400
        if sections_df.empty:
            return jsonify({"error": f"No sections found for {target_sem.academic_year} "
                                      f"{target_sem.semester_term} semester. Add sections first."}), 400

        # ── Layer 1: Random Forest — predicts faculty↔section suitability
        #    scores from historical assignment patterns + rule-based features.
        #    This is the only stage that ever touches the RF. ──
        scores = compute_scores(faculty_df, sections_df, courses_df, hist_df)

        faculty_slots       = _build_faculty_slots(target_sem.id)
        qualified_by_course = _build_qualified_by_course()

        if not any(faculty_slots.values()):
            return jsonify({"error": f"No approved faculty availability found for "
                                      f"{target_sem.academic_year} {target_sem.semester_term}. "
                                      f"Faculty need to submit availability, and a chairperson "
                                      f"needs to approve it, before generating."}), 400

        # ── Faculty Assignment — CP-SAT decides which faculty teaches which
        #    section, maximising RF score + preference bonus, subject to load
        #    limits. Does not touch time at all. ──
        faculty_assignment, assignment_mode = solve_faculty_assignment(
            faculty_df, sections_df, courses_df, scores, qualified_by_course, faculty_slots)

        if not faculty_assignment:
            return jsonify({"error": "No feasible faculty assignment found — check faculty "
                                      "load limits, qualifications, and availability."}), 400

        # ── Persist as DRAFT, replacing the previous draft for this semester.
        #    Whatever is currently APPROVED (if anything) is left alone until
        #    the chairperson explicitly approves this new draft or discards it. ──
        FacultyAssignment.query.filter_by(semester_id=target_sem.id, status="draft").delete()
        for row in faculty_assignment:
            db.session.add(FacultyAssignment(
                semester_id=target_sem.id,
                faculty_id=row["faculty_id"],
                section_id=row["section_id"],
                rf_score=row["rf_score"],
                justification=row["justification"],
                status="draft",
            ))
        db.session.commit()

        faculty_view = _group_by_faculty(faculty_assignment, _rooms_df(), include_schedule=False)
        dept_summary = _group_by_department(faculty_assignment)
        dept_det     = _dept_detail(faculty_view)

        return jsonify({
            "academic_year":      target_sem.academic_year,
            "semester":           target_sem.semester_term,
            "solver_mode":        assignment_mode,
            "faculty_data":       faculty_view,
            "dept_summary":       dept_summary,
            "dept_detail":        dept_det,
            "faculty_assignment": faculty_assignment,
        })

    @app.post("/api/generate/assignment/approve")
    @login_required
    @role_required("chairperson")
    def approve_assignment():
        """Promote the current DRAFT to APPROVED — replacing whatever was
        previously approved, so there's only ever one current, official
        faculty assignment per semester for Stage 2 to read."""
        body          = request.get_json(silent=True) or {}
        academic_year = body.get("academic_year", "2025-2026")
        semester      = body.get("semester", "1st")

        target_sem = _resolve_semester(academic_year, semester)
        if not target_sem:
            return jsonify({"error": "No matching or active semester found."}), 400

        drafts = FacultyAssignment.query.filter_by(
            semester_id=target_sem.id, status="draft").all()
        if not drafts:
            return jsonify({"error": "No generated faculty assignment to approve. "
                                      "Generate one first."}), 400

        # Replace approved rows only for the sections this draft covers, so
        # manual assignments made on the Assign Courses page for sections the
        # solver left uncovered are not wiped out by approving a draft.
        draft_section_ids = [d.section_id for d in drafts]
        FacultyAssignment.query.filter(
            FacultyAssignment.semester_id == target_sem.id,
            FacultyAssignment.status == "approved",
            FacultyAssignment.section_id.in_(draft_section_ids),
        ).delete(synchronize_session=False)

        user = current_user()
        now  = datetime.now(timezone.utc)
        for row in drafts:
            row.status      = "approved"
            row.approved_at = now
            row.approved_by = user.id if user else None

        # Notify every faculty member who just received an assignment.
        by_faculty: dict[int, list[str]] = {}
        for row in drafts:
            code = row.section.course.course_code if row.section and row.section.course else ""
            by_faculty.setdefault(row.faculty_id, []).append(code)
        notify_assignments_distributed(target_sem, by_faculty)

        db.session.commit()

        return jsonify({"message": f"{len(drafts)} faculty assignment(s) approved.",
                         "count": len(drafts)})

    @app.post("/api/generate/assignment/discard")
    @login_required
    @role_required("chairperson")
    def discard_assignment():
        """Delete the current DRAFT without touching whatever is APPROVED."""
        body          = request.get_json(silent=True) or {}
        academic_year = body.get("academic_year", "2025-2026")
        semester      = body.get("semester", "1st")

        target_sem = _resolve_semester(academic_year, semester)
        if not target_sem:
            return jsonify({"error": "No matching or active semester found."}), 400

        deleted = FacultyAssignment.query.filter_by(
            semester_id=target_sem.id, status="draft").delete()
        db.session.commit()

        return jsonify({"message": "Draft faculty assignment discarded.", "count": deleted})

    @app.get("/api/generate/assignment/status")
    @login_required
    @role_required("chairperson")
    def assignment_status():
        """Whether an APPROVED faculty assignment currently exists for the
        given semester — used to gate 'Generate Timetable' on the Schedule
        page instead of a hardcoded 'complete'."""
        academic_year = request.args.get("academic_year", "2025-2026")
        semester      = request.args.get("semester", "1st")

        target_sem = _resolve_semester(academic_year, semester)
        if not target_sem:
            return jsonify({"approved_count": 0, "draft_count": 0}), 200

        approved_count = FacultyAssignment.query.filter_by(
            semester_id=target_sem.id, status="approved").count()
        draft_count = FacultyAssignment.query.filter_by(
            semester_id=target_sem.id, status="draft").count()

        return jsonify({"approved_count": approved_count, "draft_count": draft_count})

    @app.get("/api/generate/course-offering/status")
    @login_required
    @role_required("chairperson")
    def course_offering_status():
        """Whether the semester has a course offering (sections) defined.

        This is a PRE-timetabling requirement, so it must not depend on the
        output of timetable generation. (It used to require a published
        Schedule row with day/time/room for every assigned section, which can
        only exist AFTER a timetable is generated -- so the Generate button
        could never unlock.)

        status:
          "missing"  -- no sections exist for the semester
          "complete" -- sections exist (the offering is defined)

        The counts are informational: how many sections have an approved
        assignment, and how many already have a published schedule.
        """
        academic_year = request.args.get("academic_year", "2025-2026")
        semester = request.args.get("semester", "1st")
        target_sem = _resolve_semester(academic_year, semester)
        empty = {
            "status": "missing", "total_sections": 0,
            "assigned_sections": 0, "unassigned_sections": 0,
            "scheduled_sections": 0, "unscheduled_sections": 0,
        }
        if not target_sem:
            return jsonify(empty), 200

        section_ids = {
            sid for (sid,) in db.session.query(Section.id)
            .filter(Section.semester_id == target_sem.id).all()
        }
        if not section_ids:
            return jsonify(empty), 200

        assigned_ids = {
            sid for (sid,) in db.session.query(FacultyAssignment.section_id)
            .filter(FacultyAssignment.semester_id == target_sem.id,
                    FacultyAssignment.status == "approved").all()
        } & section_ids

        # Published schedule rows are matched by (faculty, section name).
        scheduled_keys = set()
        for row in Schedule.query.filter_by(semester_id=target_sem.id).all():
            if (row.faculty_id and row.section_name and row.day and
                    row.time_start and row.time_end and row.room and
                    row.room.strip() and row.room.strip().upper() != "TBA"):
                scheduled_keys.add((row.faculty_id, row.section_name.strip()))
        required_keys = set()
        for a in FacultyAssignment.query.filter_by(
                semester_id=target_sem.id, status="approved").all():
            if a.section and a.section.section_name:
                required_keys.add((a.faculty_id, a.section.section_name.strip()))
        scheduled_count = len(required_keys & scheduled_keys)

        return jsonify({
            "status": "complete",
            "total_sections": len(section_ids),
            "assigned_sections": len(assigned_ids),
            "unassigned_sections": len(section_ids) - len(assigned_ids),
            "scheduled_sections": scheduled_count,
            "unscheduled_sections": max(0, len(required_keys) - scheduled_count),
        }), 200

    @app.post("/api/generate/timetable")
    @login_required
    @role_required("chairperson")
    def generate_timetable():
        """
        STAGE 2 only. Reads the semester's currently APPROVED
        FacultyAssignment rows from the database — it does NOT run Stage 1
        or the RF again — and places each into a real day/time slot.
        """
        body          = request.get_json(silent=True) or {}
        academic_year = body.get("academic_year", "2025-2026")
        semester      = body.get("semester", "1st")

        target_sem = _resolve_semester(academic_year, semester)
        if not target_sem:
            return jsonify({"error": "No matching or active semester found. "
                                      "Add one in the database first."}), 400

        approved = FacultyAssignment.query.filter_by(
            semester_id=target_sem.id, status="approved").all()
        if not approved:
            return jsonify({"error": f"No approved faculty assignment found for "
                                      f"{target_sem.academic_year} {target_sem.semester_term}. "
                                      f"Generate a faculty assignment and approve it first."}), 400

        faculty_df  = _faculty_df()
        courses_df  = _courses_df(active_only=True)
        rooms_df    = _rooms_df()
        sections_df = _sections_df(semester_id=target_sem.id)

        sec_by_id  = {int(r["section_id"]): r for _, r in sections_df.iterrows()}
        course_idx = courses_df.set_index("course_id")
        fac_idx    = faculty_df.set_index("faculty_id")

        # Rebuild the "assignment row" shape solve_timetable() expects, from
        # the persisted DB rows — this is the pipeline reading Stage 1's
        # saved output back in, not re-deriving it. rf_score is carried
        # through unchanged (0-100 scale, as stored); "scores" below is a
        # separate 0-1-scale lookup built from those same stored values, used
        # only to format the justification text's percentage.
        assignment_rows, scores = [], {}
        for a in approved:
            sid = a.section_id
            if sid not in sec_by_id or a.faculty_id not in fac_idx.index:
                continue   # section/faculty changed since approval — skip defensively
            srow  = sec_by_id[sid]
            cid   = int(srow["course_id"])
            crow  = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
                "course_code": "UNKN", "course_title": "Unknown Course"
            })
            frow  = fac_idx.loc[a.faculty_id]
            units = int(course_idx.loc[cid]["units"]) if cid in course_idx.index else 3

            assignment_rows.append({
                "faculty_id":      a.faculty_id,
                "faculty_name":    f"{frow['first_name']} {frow['last_name']}",
                "section_id":      sid,
                "section_name":    srow["section_name"],
                "course_id":       cid,
                "course_code":     crow["course_code"],
                "course_title":    crow["course_title"],
                "program_code":    srow.get("program_code", ""),
                "units":           units,
                "employment_type": frow.get("employment_type", "Full Time"),
                "max_units":       int(frow.get("max_units", 21) or 21),
                "rf_score":        a.rf_score or 0.0,
                "justification":   a.justification or "",
            })
            scores.setdefault(a.faculty_id, {})[sid] = (a.rf_score or 0.0) / 100.0

        if not assignment_rows:
            return jsonify({"error": "The approved faculty assignment no longer matches "
                                      "current sections or faculty accounts — regenerate "
                                      "and re-approve the faculty assignment."}), 400

        faculty_slots = _build_faculty_slots(target_sem.id)

        # ── Timetable Generation — a second, separate CP-SAT model places
        #    each already-fixed (faculty, section) pair into a real day/time
        #    slot, enforcing real availability, faculty double-booking, and
        #    cohort double-booking. It never re-decides who teaches what. ──
        assignments, unscheduled, timetable_mode = solve_timetable(
            assignment_rows, sections_df, courses_df, faculty_df, scores, faculty_slots)

        faculty_view = _group_by_faculty(assignments, rooms_df)
        dept_summary = _group_by_department(assignments)
        dept_det     = _dept_detail(faculty_view)
        timetable    = _timetable_by_faculty(assignments)

        return jsonify({
            "academic_year":  target_sem.academic_year,
            "semester":       target_sem.semester_term,
            "solver_mode":    f"Timetable: {timetable_mode}",
            "timetable_mode": timetable_mode,
            "faculty_data":   faculty_view,
            "dept_summary":   dept_summary,
            "dept_detail":    dept_det,
            "timetable":      timetable,
            "assignments":    assignments,
            # Stage-1 pairs that stage 2 couldn't place into a slot (e.g.
            # every slot the faculty is available for was already taken by
            # their other offerings) — tracked instead of silently dropped.
            "unscheduled":    unscheduled,
        })

    @app.get("/api/faculty")
    def get_faculty():
        cols = ["faculty_id","employee_number","first_name","last_name","email",
                "specialization","academic_rank","employment_type",
                "max_units","exp_years","preferred_courses","preferred_days"]
        return jsonify(_faculty_df()[cols].to_dict(orient="records"))

    @app.get("/api/courses")
    def get_courses():
        return jsonify(_courses_df(active_only=True).to_dict(orient="records"))

    @app.get("/api/sections")
    def get_sections():
        sections_df = _sections_df()
        courses_df  = _courses_df(active_only=False)
        rooms_df    = _rooms_df()
        merged = sections_df.merge(
            courses_df[["course_id","course_code","course_title"]],
            on="course_id", how="left"
        )
        merged["room_label"] = merged["room_id"].apply(lambda rid: _room_label(rid, rooms_df))
        return jsonify(merged.to_dict(orient="records"))

    @app.get("/api/semesters")
    def get_semesters():
        semesters = Semester.query.order_by(Semester.id.desc()).all()
        return jsonify([s.to_dict() for s in semesters])

    @app.get("/api/rooms")
    def get_rooms():
        return jsonify(_rooms_df().to_dict(orient="records"))


# ──────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  CCISched backend  →  http://localhost:{port}")
    print(f"  Solver: {'CP-SAT (OR-Tools)' if ORTOOLS_AVAILABLE else 'Greedy fallback (install ortools)'}\n")
    app.run(host="0.0.0.0", port=port, debug=True)
