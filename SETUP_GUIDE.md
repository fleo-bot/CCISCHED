# CCISched - Team Setup Guide

This guide will help your teammates get the project running in VS Code from scratch.

---

Prerequisites

Before starting, make sure you have:
- **Git** installed ([download here](https://git-scm.com/downloads))
- **Python 3.8+** installed ([download here](https://www.python.org/downloads/))
- **VS Code** installed ([download here](https://code.visualstudio.com/))
- **PostgreSQL** installed (for the database)

---

Step 1: Clone the Repository

Option A: Using Command Line
```bash
git clone https://github.com/fleo-bot/ccisched.git
cd ccisched
code .
```

Option B: Using VS Code
1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Git: Clone" and select it
4. Paste: `https://github.com/fleo-bot/ccisched.git`
5. Choose a folder location
6. Click "Open" when prompted

---

Step 2: Backend Setup (Python/Flask)

2.1 Create Virtual Environment

Open the integrated terminal in VS Code (`Ctrl+``) and run:

```powershell
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv .venv

# Activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# If you get an error about execution policy, run this first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

For Mac/Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

2.2 Install Dependencies

With the virtual environment activated:
```powershell
pip install -r requirements.txt
```

This installs:
- Flask (web framework)
- Flask-CORS (for API access)
- Flask-SQLAlchemy (database)
- psycopg2-binary (PostgreSQL driver)
- pandas, numpy (data processing)
- scikit-learn (Random Forest ML)
- ortools (CP-SAT constraint solver)

2.3 Database Setup

1. Create PostgreSQL Database
   ```sql
   -- In PostgreSQL (psql or pgAdmin)
   CREATE DATABASE ccisched;
   CREATE USER ccisched_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE ccisched TO ccisched_user;
   ```

2. Create `.env` file in the `backend` folder:
   ```bash
   # Copy the example
   cp .env.example .env
   ```

3. Edit `.env` with your database credentials:
   ```
   DATABASE_URL=postgresql://ccisched_user:your_password@localhost:5432/ccisched
   SECRET_KEY=your-secret-key-here
   FLASK_ENV=development
   ```

4. Initialize the Database
   ```powershell
   python init_db.py
   ```

2.4 Run the Backend Server

```powershell
# Make sure virtual environment is active
.\.venv\Scripts\Activate.ps1

# Run the server
python app.py
```

You should see:
```
 * Running on http://localhost:5000
 * CCISched backend running
 * Solver: CP-SAT (OR-Tools)
```

Test it works:
```powershell
# In a new terminal
Invoke-RestMethod http://localhost:5000/api/health
```

---

Step 3: Frontend Setup

The frontend is plain HTML/CSS/JavaScript - no build step needed!

Option A: Using VS Code Live Server Extension (Recommended)

1. Install Live Server Extension
   - Open VS Code Extensions (`Ctrl+Shift+X`)
   - Search for "Live Server" by Ritwick Dey
   - Click Install

2. Run the Frontend
   - Open `src/index.html` in VS Code
   - Right-click in the editor → "Open with Live Server"
   - Browser opens at `http://localhost:5500` (or similar)

Option B: Using Python's Built-in Server

```powershell
# From the project root
cd src
python -m http.server 8000
```
Then open: `http://localhost:8000`

---

Step 4: Verify Everything Works

Backend Health Check
```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "solver": "CP-SAT",
  "message": "CCISched backend is running"
}
```

Frontend Access
1. Open `http://localhost:5500` (or your Live Server URL)
2. You should see the CCISched landing page
3. Try logging in (credentials depend on your database seed data)

Test Schedule Generation
```powershell
Invoke-RestMethod -Method POST `
  -Uri http://localhost:5000/api/generate `
  -ContentType "application/json" `
  -Body '{"academic_year":"2025-2026","semester":"1st"}'
```

---

Common Issues & Solutions

Issue: "Execution policy" error on Windows
Solution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Issue: `pip install` fails for psycopg2
Solution:
```powershell
# Use the binary version (already in requirements.txt)
pip install psycopg2-binary
```

Issue: Can't connect to database
Solutions:
- Check PostgreSQL is running
- Verify `.env` file has correct credentials
- Test connection: `psql -U ccisched_user -d ccisched`

Issue: CORS errors in browser console
Solution:
- Make sure backend is running on `http://localhost:5000`
- Check `flask-cors` is installed
- Verify `api.js` has correct API base URL

Issue: Virtual environment not activating
Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

Windows CMD:
```cmd
.venv\Scripts\activate.bat
```

Mac/Linux:
```bash
source .venv/bin/activate
```

---

Project Structure

```
ccisched/
├── backend/              # Flask API
│   ├── .venv/           # Python virtual environment (create this)
│   ├── .env             # Environment variables (create this)
│   ├── app.py           # Main Flask app
│   ├── cpsat_solver.py  # CP-SAT constraint solver
│   ├── rf_model.py      # Random Forest ML model
│   ├── models.py        # Database models
│   ├── database.py      # Database connection
│   ├── init_db.py       # Database initialization
│   ├── routes/          # API endpoints
│   │   ├── auth.py
│   │   ├── schedule.py
│   │   └── ...
│   ├── data/            # CSV data files
│   └── requirements.txt
│
├── src/                 # Frontend (HTML/CSS/JS)
│   ├── index.html       # Landing page
│   ├── login.html       # Login page
│   ├── scripts/         # JavaScript files
│   ├── styles/          # CSS files
│   ├── chairperson/     # Chairperson views
│   └── faculty/         # Faculty views
│
└── SETUP_GUIDE.md       # This file
```

---

Development Workflow

Daily Development

1. Start Backend:
   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   python app.py
   ```

2. Start Frontend:
   - Open `src/index.html` in VS Code
   - Right-click → "Open with Live Server"

3. Make changes and test

4. Commit and push:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push
   ```

Pulling Latest Changes

```bash
git pull origin master
```

If backend dependencies changed:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

Recommended VS Code Extensions

- **Live Server** - Local development server
- **Python** - Python language support
- **Pylance** - Python IntelliSense
- **PostgreSQL** - Database management
- **GitLens** - Enhanced Git features
- **Error Lens** - Inline error highlighting

---

Need Help?

- Check `backend/README.md` for backend details
- Check `backend/DATABASE_SETUP.md` for database schema
- Check `USER_STORIES.md` for feature requirements
- Ask the team on [your communication channel]

---

Quick Reference Commands

```powershell
# Clone repo
git clone https://github.com/fleo-bot/ccisched.git

# Setup backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python init_db.py
python app.py

# Pull updates
git pull

# Commit changes
git add .
git commit -m "message"
git push
```

---

Happy coding! 🚀
