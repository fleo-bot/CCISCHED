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

All in `data/`:

| File                        | Rows | Used by                        |
|-----------------------------|------|--------------------------------|
| faculty.csv                 | 50   | RF features + CP-SAT H2/H3    |
| courses.csv                 | 20   | RF features + section lookup   |
| Sections.csv                | 20   | CP-SAT — assignment unit       |
| Rooms.csv                   | 20   | CP-SAT H5 room conflict check  |
| Sememster.csv               | 20   | Active semester scoping        |
| historical_assignments.csv  | 15   | RF training data               |

> Note: `historical_assignments.course_id` holds **section_id** values (401-420)
> that map directly to `Sections.csv section_id`. This is intentional — the
> RF trains on section-level history, not raw course-level history.

## CP-SAT hard constraints

| ID | Constraint |
|----|------------|
| H1 | Every section gets exactly one faculty assigned |
| H2 | Faculty total units ≤ `max_units` (from faculty.csv) |
| H3 | Faculty assigned only when their availability overlaps section days |
| H4 | No faculty time-conflict: two sections on same day can't overlap in time |
| H5 | No room double-booking: validated from `Sections.csv room_id` |
