"""
app.py
------
Flask REST API for CCISched.

Endpoints
─────────
  Scheduling (CP-SAT solver):
    GET  /api/health          Server status + solver info
    POST /api/generate        Run RF → CP-SAT, return full assignment result
    GET  /api/faculty         Faculty list
    GET  /api/courses         Active course list
    GET  /api/semesters       All semesters (active one flagged)

  Database API (auth, profile, availability, notifications):
    Registered via blueprints — see routes/
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from database import configure_db, db
from rf_model import compute_scores
from cpsat_solver import solve, ORTOOLS_AVAILABLE


# ──────────────────────────────────────────────
#  App factory
# ──────────────────────────────────────────────
def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # Database (SQLAlchemy + sessions)
    configure_db(app)

    # CORS — allow frontend on localhost:5500
    CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

    # Register database API blueprints
    from routes.auth          import auth_bp
    from routes.profile       import profile_bp
    from routes.availability  import availability_bp
    from routes.review        import review_bp
    from routes.notifications import notifications_bp
    from routes.schedule      import schedule_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(availability_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(schedule_bp)

    # Register legacy CSV-based scheduler routes (kept for backward compat)
    register_scheduler_routes(app)

    return app


# ──────────────────────────────────────────────
#  Legacy scheduler routes (CSV-based)
# ──────────────────────────────────────────────
def register_scheduler_routes(app: Flask):
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR / "data"

    # ── Load all 5 CSVs once at startup ──
    faculty_df  = pd.read_csv(DATA_DIR / "faculty.csv")
    courses_df  = pd.read_csv(DATA_DIR / "courses.csv")
    hist_df     = pd.read_csv(DATA_DIR / "historical_assignments.csv")
    sections_df = pd.read_csv(DATA_DIR / "Sections.csv")
    rooms_df    = pd.read_csv(DATA_DIR / "Rooms.csv")
    semester_df = pd.read_csv(DATA_DIR / "Sememster.csv")

    # ── Normalise column types ──
    faculty_df["faculty_id"]  = faculty_df["faculty_id"].astype(int)
    faculty_df["max_units"]   = pd.to_numeric(faculty_df["max_units"],  errors="coerce").fillna(21).astype(int)
    faculty_df["exp_years"]   = pd.to_numeric(faculty_df["exp_years"],  errors="coerce").fillna(0).astype(int)
    courses_df["course_id"]   = courses_df["course_id"].astype(int)
    courses_df["is_active"]   = pd.to_numeric(courses_df["is_active"],  errors="coerce").fillna(1).astype(int)
    sections_df["section_id"] = sections_df["section_id"].astype(int)
    sections_df["course_id"]  = sections_df["course_id"].astype(int)
    sections_df["room_id"]    = pd.to_numeric(sections_df["room_id"],   errors="coerce").fillna(0).astype(int)
    rooms_df["room_id"]       = rooms_df["room_id"].astype(int)
    rooms_df["is_active"]     = pd.to_numeric(rooms_df["is_active"],    errors="coerce").fillna(1).astype(int)
    semester_df["semester_id"]= semester_df["semester_id"].astype(int)
    semester_df["is_active"]  = pd.to_numeric(semester_df["is_active"], errors="coerce").fillna(0).astype(int)

    active_courses_df  = courses_df[courses_df["is_active"] == 1].copy()
    rooms_idx = rooms_df.set_index("room_id")

    # Helper functions (kept internal to closure for now)
    def _room_label(room_id: int) -> str:
        if room_id and room_id in rooms_idx.index:
            r = rooms_idx.loc[room_id]
            return f"{r['room_code']} ({r['building']})"
        return "TBA"

    def _group_by_faculty(assignments: list[dict]) -> list[dict]:
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
            time_label = f"{row['time_start'][:5]}–{row['time_end'][:5]}"
            entry["courses"].append(
                f"{row['course_code']} \u2013 {row['course_title']}"
                f"  [{row['preferred_days']} {time_label}]"
            )
            entry["course_details"].append({
                "code":          row["course_code"],
                "title":         row["course_title"],
                "section":       row["section_name"],
                "days":          row["preferred_days"],
                "time":          time_label,
                "room":          _room_label(row["room_id"]),
                "units":         row["units"],
                "type":          "Lecture",
                "justification": row["justification"],
            })
        return list(grouped.values())

    def _group_by_department(assignments: list[dict]) -> list[dict]:
        cs_codes = {"CS101","CS102","CS103","CS201","CS202","CS301","CS401"}
        bscs_fac, bsit_fac = set(), set()
        for row in assignments:
            if row["course_code"] in cs_codes:
                bscs_fac.add(row["faculty_id"])
            else:
                bsit_fac.add(row["faculty_id"])
        return [
            {"department": "Bachelor of Science in Computer Science",
             "totalFaculty": len(bscs_fac), "status": "Completed"},
            {"department": "Bachelor of Science in Information Technology",
             "totalFaculty": len(bsit_fac), "status": "Completed"},
        ]

    def _dept_detail(faculty_view: list[dict]) -> dict:
        cs_codes = {"CS101","CS102","CS103","CS201","CS202","CS301","CS401"}
        bscs_faculty, bsit_faculty = [], []
        for f in faculty_view:
            cs_det = [d for d in f["course_details"] if d["code"] in cs_codes]
            it_det = [d for d in f["course_details"] if d["code"] not in cs_codes]
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
        TIME_SLOTS = [
            (7*60+30,  9*60),    (9*60,    10*60+30), (10*60+30,12*60),
            (12*60,   13*60+30), (13*60+30,15*60),    (15*60,   16*60+30),
            (16*60+30,18*60),    (18*60,   19*60+30),
        ]
        DAY_EXPAND = {
            "MWF": ["Monday","Wednesday","Friday"],
            "TTh": ["Tuesday","Thursday"],
            "Sat": ["Saturday"],
            "MTh": ["Monday","Thursday"],
            "MW":  ["Monday","Wednesday"],
            "TF":  ["Tuesday","Friday"],
        }
        result: dict[int, list[dict]] = {}
        for row in assignments:
            fid   = row["faculty_id"]
            start = int(row["time_start"].split(":")[0]) * 60 + int(row["time_start"].split(":")[1])
            col = 0
            for i, (s, e) in enumerate(TIME_SLOTS):
                if abs(start - s) <= 30:
                    col = i
                    break
            days = DAY_EXPAND.get(row["preferred_days"], ["Monday"])
            result.setdefault(fid, [])
            for day in days:
                result[fid].append({
                    "day":     day,
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
        active_sem = semester_df[semester_df["is_active"] == 1]
        sem_info   = active_sem.iloc[0].to_dict() if len(active_sem) else {}
        return jsonify({
            "status":            "ok",
            "ortools_available": ORTOOLS_AVAILABLE,
            "solver_mode":       "CP-SAT" if ORTOOLS_AVAILABLE else "Greedy fallback",
            "faculty_count":     len(faculty_df),
            "course_count":      int((courses_df["is_active"] == 1).sum()),
            "section_count":     len(sections_df),
            "room_count":        int((rooms_df["is_active"] == 1).sum()),
            "history_rows":      len(hist_df),
            "active_semester":   sem_info,
        })

    @app.post("/api/generate")
    def generate():
        body          = request.get_json(silent=True) or {}
        academic_year = body.get("academic_year", "2025-2026")
        semester      = body.get("semester", "1st")
        scores        = compute_scores(faculty_df, sections_df, active_courses_df, hist_df)
        assignments   = solve(faculty_df, sections_df, active_courses_df, rooms_df, scores)
        faculty_view  = _group_by_faculty(assignments)
        dept_summary  = _group_by_department(assignments)
        dept_det      = _dept_detail(faculty_view)
        timetable     = _timetable_by_faculty(assignments)
        return jsonify({
            "academic_year": academic_year,
            "semester":      semester,
            "solver_mode":   "CP-SAT" if ORTOOLS_AVAILABLE else "Greedy",
            "faculty_data":  faculty_view,
            "dept_summary":  dept_summary,
            "dept_detail":   dept_det,
            "timetable":     timetable,
            "assignments":   assignments,
        })

    @app.get("/api/faculty")
    def get_faculty():
        cols = ["faculty_id","employee_number","first_name","last_name","email",
                "specialization","academic_rank","employment_type",
                "max_units","exp_years","preferred_courses","preferred_days"]
        return jsonify(faculty_df[cols].to_dict(orient="records"))

    @app.get("/api/courses")
    def get_courses():
        return jsonify(active_courses_df.to_dict(orient="records"))

    @app.get("/api/sections")
    def get_sections():
        merged = sections_df.merge(
            courses_df[["course_id","course_code","course_title"]],
            on="course_id", how="left"
        )
        merged["room_label"] = merged["room_id"].apply(_room_label)
        return jsonify(merged.to_dict(orient="records"))

    @app.get("/api/semesters")
    def get_semesters():
        return jsonify(semester_df.to_dict(orient="records"))

    @app.get("/api/rooms")
    def get_rooms():
        return jsonify(rooms_df[rooms_df["is_active"] == 1].to_dict(orient="records"))


# ──────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  CCISched backend  →  http://localhost:{port}")
    print(f"  Solver: {'CP-SAT (OR-Tools)' if ORTOOLS_AVAILABLE else 'Greedy fallback (install ortools)'}\n")
    app.run(host="0.0.0.0", port=port, debug=True)
