# CCISched Database Setup Guide

This guide walks you through setting up the database backend for CCISched.

---

## What You Need

1. **Python 3.10+** — already installed
2. **PostgreSQL** (recommended) or **SQLite** (easier for dev/testing)

---

## Quick Start (SQLite — no installation needed)

If you want to test everything locally without installing PostgreSQL:

```powershell
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy environment template
copy .env.example .env

# Create tables + seed data
python init_db.py

# Run the server
python app.py
```

The backend will be at **http://localhost:5000**

Default accounts:
- **Chairperson**: `chair@pup.edu.ph` / `chair1234`
- **Faculty**: login with their email from `faculty.csv`, password = their employee number (e.g. `EMP-2024-001`)

---

## Production Setup (PostgreSQL)

### 1. Install PostgreSQL

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create the Database

```bash
# Switch to postgres user (Linux/Mac) or open psql as admin (Windows)
psql -U postgres

# Inside psql:
CREATE DATABASE ccisched;
CREATE USER ccisched_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE ccisched TO ccisched_user;
\q
```

### 3. Configure Environment

Edit `backend/.env`:

```env
SECRET_KEY=change-this-to-a-random-string
DATABASE_URL=postgresql://ccisched_user:your_password_here@localhost:5432/ccisched
PORT=5000
```

### 4. Initialize Database

```powershell
cd backend
pip install -r requirements.txt
python init_db.py
python app.py
```

---

## Database Schema

### Tables

**users**  
Stores faculty and chairperson accounts.  
- Columns: id, employee_number, first_name, last_name, email, password_hash, role, specialization, academic_rank, avatar, etc.

**semesters**  
Academic year/semester metadata.  
- Columns: id, academic_year, semester_term, start_date, end_date, is_active

**availability_submissions**  
Faculty availability forms.  
- Columns: id, faculty_id, semester_id, status (pending/submitted/approved/rejected/returned), remarks, submitted_at, reviewed_at

**availability_slots**  
Time slots within a submission.  
- Columns: id, submission_id, slot_number, day_indices, time_start, time_end, time_label

**schedules**  
Generated timetable entries.  
- Columns: id, faculty_id, semester_id, course_code, course_title, section_name, class_type, day, time_start, time_end, room, units

**notifications**  
In-app notifications for both roles.  
- Columns: id, user_id, notif_type, title, message, is_read, related_submission_id, created_at

---

## API Endpoints

### Auth
- `POST /api/auth/login` — email + password → session
- `POST /api/auth/logout` — clear session
- `GET  /api/auth/me` — current user

### Profile
- `GET   /api/profile` — get own profile
- `PATCH /api/profile` — update profile fields
- `PATCH /api/profile/password` — change password

### Availability (Faculty)
- `GET    /api/availability` — get own submission
- `POST   /api/availability` — save/update slots
- `POST   /api/availability/finalize` — submit for review
- `DELETE /api/availability/slots/<id>` — remove a slot

### Availability (Chairperson)
- `GET /api/availability/all` — all submissions
- `GET /api/availability/<id>` — single submission detail

### Review (Chairperson)
- `POST /api/review/<id>/approve` — approve submission
- `POST /api/review/<id>/reject` — reject (with remarks)
- `POST /api/review/<id>/return` — return for revision

### Notifications
- `GET   /api/notifications` — list all
- `GET   /api/notifications/unread` — unread count
- `PATCH /api/notifications/<id>/read` — mark as read
- `PATCH /api/notifications/read-all` — mark all as read

### Schedule
- `GET  /api/schedule` — faculty's own schedule
- `GET  /api/schedule/<faculty_id>` — chairperson: any faculty's schedule
- `POST /api/schedule/publish` — chairperson: persist generated schedule

### Legacy Scheduler (CSV-based)
- `GET  /api/health` — server status
- `POST /api/generate` — run CP-SAT solver
- `GET  /api/faculty` — faculty list
- `GET  /api/courses` — active courses
- `GET  /api/sections` — sections with room labels
- `GET  /api/semesters` — all semesters

---

## Troubleshooting

**"No module named 'database'"**  
Make sure you're in the `backend/` directory when running scripts.

**"could not connect to server"**  
PostgreSQL isn't running. Start it:
- Windows: Services → PostgreSQL
- Mac: `brew services start postgresql@15`
- Linux: `sudo systemctl start postgresql`

**"relation does not exist"**  
Tables weren't created. Run: `python init_db.py`

**"Unauthorized" on every API call**  
You need to log in first via `POST /api/auth/login` and the frontend must send cookies with every request.

---

## Next Steps

1. **Frontend integration** — update `login.js` to call `/api/auth/login` instead of localStorage
2. **Availability form** — wire `availability-form.js` to POST to `/api/availability`
3. **Dashboard** — fetch notifications from `/api/notifications` instead of localStorage
4. **Schedule display** — GET `/api/schedule` instead of hardcoded data

---

Need help? Check the route files in `routes/` for detailed endpoint docs.
