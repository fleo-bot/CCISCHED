# CCISched Database Setup Guide

This guide walks you through setting up the database backend for CCISched.

---

## What You Need

1. **Python 3.10+** — already installed
2. **MySQL** (recommended) or **SQLite** (easier for dev/testing)

---

## Quick Start (SQLite — no installation needed)

If you want to test everything locally without installing MySQL:

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

## Production Setup (MySQL)

### 1. Install MySQL

**Windows:**
Download from [mysql.com](https://dev.mysql.com/downloads/installer/)

**macOS (Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

### 2. Create the Database

```bash
# Open the MySQL shell as admin
mysql -u root -p

# Inside the mysql shell:
CREATE DATABASE ccisched CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ccisched_user'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON ccisched.* TO 'ccisched_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Configure Environment

Edit `backend/.env`:

```env
SECRET_KEY=change-this-to-a-random-string
DATABASE_URL=mysql+pymysql://ccisched_user:your_password_here@localhost:3306/ccisched
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

## Re-seeding with a new data export

`init_db.py` only adds and updates rows -- it never deletes. If you are replacing an
older export (courses, qualifications, sections, etc. that no longer exist in the new
files), start from an empty database so nothing stale is left behind:

```sql
DROP DATABASE ccisched_sept30;
CREATE DATABASE ccisched_sept30 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```powershell
cd backend
python init_db.py
```

If you would rather keep your current database, widen the one column that is too small
for the new data instead of dropping everything:

```sql
ALTER TABLE users MODIFY preferred_courses TEXT;
```

(Use your own database name from `DATABASE_URL`. This also removes accounts, audit log
entries and anything else created since the last seed.)

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

**"Can't connect to MySQL server"**  
MySQL isn't running. Start it:
- Windows: Services → MySQL
- Mac: `brew services start mysql`
- Linux: `sudo systemctl start mysql`

**"Table 'ccisched.xxx' doesn't exist"**  
Tables weren't created. Run: `python init_db.py`

**"Access denied for user"**  
Double-check the username/password in `DATABASE_URL` match what you created with `CREATE USER` above, and that you ran `FLUSH PRIVILEGES;`.

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
