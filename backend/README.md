# CCISched Backend

Flask + Random Forest + CP-SAT scheduling engine.

## Setup (one-time)

```powershell
# From the backend folder
cd c:\PROJECT\CCISCHED\backend

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install all dependencies
pip install -r requirements.txt
```

## Run the server

```powershell
# Make sure the venv is active first
.\.venv\Scripts\Activate.ps1

python app.py
# → CCISched backend running on http://localhost:5000
# → Solver: CP-SAT (OR-Tools)
```

## Test it's working

```powershell
# Health check
Invoke-RestMethod http://localhost:5000/api/health

# Trigger a generation (1st Semester, AY 2025-2026)
Invoke-RestMethod -Method POST `
  -Uri http://localhost:5000/api/generate `
  -ContentType "application/json" `
  -Body '{"academic_year":"2025-2026","semester":"1st"}'
```

## API Endpoints

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | /api/health       | Server status + solver info        |
| POST   | /api/generate     | Run RF → CP-SAT, return assignments|
| GET    | /api/faculty      | List all faculty                   |
| GET    | /api/courses      | List active courses                |

### POST /api/generate — request body

```json
{
  "academic_year": "2025-2026",
  "semester": "1st"
}
```

### POST /api/generate — response shape

```json
{
  "academic_year": "2025-2026",
  "semester": "1st",
  "solver_mode": "CP-SAT",
  "faculty_data":  [...],   // → generated-timetables.js
  "dept_summary":  [...],   // → generated-assignment.js
  "dept_detail":   {...},   // → assignment-detail.js
  "assignments":   [...]    // flat list for debugging
}
```

## How the pipeline works

```
faculty.csv  ─┐
courses.csv  ─┤─► rf_model.py     ─► scores[faculty_id][course_id]
hist.csv     ─┘   (Random Forest      │
                   + rule features)   │
                                      ▼
                               cpsat_solver.py
                               (CP-SAT hard constraints:
                                H1 every course gets one faculty
                                H2 load ≤ max_units
                                H3 part-time cap
                                H4 day availability)
                                      │
                                      ▼
                               /api/generate JSON
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                   ▼
          generated-timetables  generated-assignment  assignment-detail
```

## Data files

All in `data/` (read directly by `init_db.py`; also re-importable from the chairperson CSV import page):

| File                                         | Rows  | Used by                                              |
|----------------------------------------------|-------|------------------------------------------------------|
| CCISched-Semester.csv                        | 12    | Semesters; the active one is picked from today's date |
| CCISched-Courses.csv                         | 57    | Courses (`department` = IT/CS track, `college` = CCIS) |
| CCISched-Rooms.csv                           | 24    | Rooms                                                |
| CCISched-Program-Curriculum.csv              | 83    | Which courses each program/year/term needs           |
| CCISched-Sections.csv                        | 52    | Cohorts; course sections are derived from curriculum |
| CCISched-Faculty.csv                         | 55    | Faculty accounts, RF features, CP-SAT load limits    |
| CCISched-Chairpersons.csv                    | 1     | Chairperson accounts (CP-### ids)                    |
| CCISched-Faculty-Course-Qualifications.csv   | 1,283 | Faculty-course qualifications                        |
| CCISched-Faculty-Availability-Matrix.csv     | 3,297 | Availability; only the active semester is seeded     |
| CCISched-Historical-Data.csv                 | 1,664 | RF training data (read directly by `app.py`)         |

> Faculty `specialization` values are course titles (e.g. "Software Engineering 2"). The RF
> matches them to courses by title/numbered family (see `rf_model.py`); the older broad areas
> ("Machine Learning", "Network Administration", ...) still use the keyword map.

## CP-SAT hard constraints

| ID | Constraint |
|----|------------|
| H1 | Every section gets exactly one faculty assigned |
| H2 | Faculty total units ≤ `max_units` (from faculty.csv) |
| H3 | Faculty assigned only when their availability overlaps section days |
| H4 | No faculty time-conflict: two sections on same day can't overlap in time |
| H5 | No room double-booking: validated from `Sections.csv room_id` |

### Updating seed CSV data

Place the latest CSV exports in `backend/data/` using these exact filenames: `CCISched-Semester.csv`, `CCISched-Courses.csv`, `CCISched-Rooms.csv`, `CCISched-Program-Curriculum.csv`, `CCISched-Sections.csv`, `CCISched-Faculty.csv`, `CCISched-Faculty-Course-Qualifications.csv`, `CCISched-Faculty-Availability-Matrix.csv`, and `CCISched-Historical-Data.csv`. The seeder reads these filenames directly. Availability is imported only for the semester whose date range contains the day you run `python init_db.py`; AM/PM times are normalized to 24-hour format. The chairperson seed file (`CCISched-Chairpersons.csv`) is kept separately and was preserved because it was not included in the latest data archive. Back up your database before reseeding.
