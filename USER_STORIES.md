# CCISched User Stories

## Project Overview
**CCISched** is an intelligent faculty assignment and timetable optimization system for the Polytechnic University of the Philippines — College of Computer and Information Sciences (PUP-CCIS). The system combines Random Forest machine learning with CP-SAT constraint programming to automate academic scheduling while ensuring conflict-free, optimized timetables.

---

## User Personas

### Persona 1: Dr. Maria Santos — Department Chairperson
- **Role**: Academic Administrator
- **Technical Proficiency**: Intermediate
- **Goals**: 
  - Efficiently manage course offerings and faculty assignments
  - Ensure fair workload distribution
  - Minimize scheduling conflicts
  - Streamline the timetabling process
- **Pain Points**:
  - Manual scheduling takes weeks and is error-prone
  - Difficult to track all faculty availability
  - Hard to balance teaching loads fairly
  - Frequent conflicts in room and time slot assignments

### Persona 2: Prof. Juan Reyes — Full-Time Faculty
- **Role**: Senior Faculty Member
- **Technical Proficiency**: Intermediate
- **Goals**:
  - Submit availability preferences easily
  - View personal teaching schedule clearly
  - Get timely notifications about schedule changes
- **Pain Points**:
  - Availability submission process is unclear
  - No visibility into schedule until very late
  - Receives assignments that conflict with personal constraints

### Persona 3: Ms. Anna Cruz — Part-Time Faculty
- **Role**: Part-Time Instructor
- **Technical Proficiency**: Basic
- **Goals**:
  - Clearly indicate limited availability
  - Ensure workload doesn't exceed part-time limits
  - Access schedule from any device
- **Pain Points**:
  - Often assigned beyond part-time teaching load limits
  - Difficulty coordinating with other commitments
  - Limited communication about schedule status

---

## Epic 0: Authentication

### Story 0.1: Log In to the System
**As a** user (faculty or chairperson)  
**I want to** log in with my email and password  
**So that** I can access the features available to my role

**Acceptance Criteria:**
- Login form accepts email and password
- Invalid credentials show a clear error message
- Successful login redirects to the correct role dashboard (faculty or chairperson)
- Session persists across page refreshes
- Session expires after a period of inactivity
- "Remember me" option available

**Technical Notes:**
- POST `/api/auth/login` — email + password
- Server-side session via Flask `session["user_id"]`
- Role-based redirect: role = "faculty" → `/faculty/dashboard.html`, role = "chairperson" → `/chairperson/dashboard.html`
- `werkzeug.security.check_password_hash` for verification

---

### Story 0.2: Log Out of the System
**As a** user (faculty or chairperson)  
**I want to** log out of the system  
**So that** my account is secured when I am done

**Acceptance Criteria:**
- Logout clears the active session
- User is redirected to the login page
- Subsequent navigation to protected pages redirects to login
- Logout is accessible from all pages (nav or profile menu)

**Technical Notes:**
- POST `/api/auth/logout` — clears `session`
- Client-side redirect to `login.html`

---

### Story 0.3: Change Password
**As a** user (faculty or chairperson)  
**I want to** change my account password  
**So that** I can maintain account security

**Acceptance Criteria:**
- Must provide current password to authenticate the change
- New password must be at least 6 characters
- Incorrect current password shows a clear error
- Password is never shown in plain text
- Confirmation of successful change displayed

**Technical Notes:**
- PATCH `/api/profile/password`
- Body: `{ "current_password": "...", "new_password": "..." }`
- Hashed with `werkzeug.security.generate_password_hash`

---

## Epic 1: Faculty Availability Management

### Story 1.1: Save Availability Draft
**As a** faculty member  
**I want to** add and save my preferred teaching days and time slots as a draft  
**So that** I can review and adjust before officially submitting

**Acceptance Criteria:**
- Faculty can add multiple availability slots
- Each slot allows selecting day combinations (e.g., Mon/Wed/Fri, Tue/Thu, Sat) via day indices (0–5)
- Each slot allows specifying a time range (start and end time)
- Faculty can delete individual slots while in draft
- Draft is saved per-semester (one submission per faculty per semester)
- If a "returned" submission exists, faculty can re-edit it
- Cannot add slots once status is `submitted` or `approved`

**Technical Notes:**
- POST `/api/availability` — creates or replaces the draft
- DELETE `/api/availability/slots/<slot_id>` — removes one slot
- Uses `AvailabilitySubmission` (status: `pending` / `returned`) and `AvailabilitySlot` models
- Slot days stored as comma-separated indices: `"0,2,4"` = Mon/Wed/Fri

---

### Story 1.2: Finalize and Submit Availability
**As a** faculty member  
**I want to** officially submit my finalized availability  
**So that** the chairperson can review and approve it

**Acceptance Criteria:**
- Cannot finalize if no slots have been added
- Submission status changes from `pending` → `submitted`
- Chairperson receives a notification upon finalization
- Faculty can no longer edit after finalizing (unless returned)
- Submission timestamp is recorded

**Technical Notes:**
- POST `/api/availability/finalize`
- Triggers `submission_received` notification to all chairpersons
- `submitted_at` field recorded on the `AvailabilitySubmission` model

---

### Story 1.3: View Own Availability Submission
**As a** faculty member  
**I want to** view the current status of my availability submission  
**So that** I know whether it has been reviewed and any remarks provided

**Acceptance Criteria:**
- Shows current status: `pending`, `submitted`, `approved`, `rejected`, or `returned`
- Shows all saved slots with days and time ranges
- Shows chairperson remarks if rejected or returned
- Shows reviewed timestamp when available
- Clear call-to-action based on status (e.g., "Edit" for returned, "View" for approved)

**Technical Notes:**
- GET `/api/availability` — returns submission for active semester
- Used by `view-submission.html` (faculty) and `add-availability.html` / `edit-availability.html`

---

### Story 1.4: Review Availability Submissions (Chairperson)
**As a** chairperson  
**I want to** view all faculty availability submissions for the active semester  
**So that** I can track submission progress and review each one

**Acceptance Criteria:**
- List shows all faculty with their submission status
- Summary counts shown: total, submitted, approved, rejected, returned, pending
- Can click to view detailed slots for any faculty
- Can filter/sort by status or faculty name
- No active semester shows an appropriate message

**Technical Notes:**
- GET `/api/availability/all` — all submissions for active semester with counts
- GET `/api/availability/<submission_id>` — single submission detail with slots
- Used by `faculty-availability-submissions.html` and `submission-detail.html`

---

### Story 1.5: Approve, Reject, or Return a Submission (Chairperson)
**As a** chairperson  
**I want to** approve, reject, or return a faculty availability submission  
**So that** I can control the quality of availability data before schedule generation

**Acceptance Criteria:**
- Can only act on submissions with status `submitted`
- Approve: status → `approved`; faculty receives approval notification
- Reject: status → `rejected`; remarks optional; faculty notified with reason
- Return: status → `returned`; remarks **required**; faculty notified with revision guidance
- Reviewed timestamp and reviewer ID recorded on all actions
- Once all `submitted` submissions are approved, all approved faculty automatically receive a "schedule ready" notification

**Technical Notes:**
- POST `/api/review/<id>/approve`
- POST `/api/review/<id>/reject` — body: `{ "remarks": "..." }`
- POST `/api/review/<id>/return` — body: `{ "remarks": "..." }` (required)
- Auto-triggers `schedule_published` notification via `_check_all_approved()`

---

## Epic 2: Course & Section Management

### Story 2.1: Manage Course Offerings
**As a** chairperson  
**I want to** manage the list of courses and sections for a semester  
**So that** the system has accurate data for schedule generation

**Acceptance Criteria:**
- Can add new courses with code, title, units, year level
- Can create multiple sections per course
- Can specify room requirements (Lab, Classroom, Drawing Lab)
- Can set section capacity
- Can activate/deactivate courses per semester
- Can bulk import courses from CSV

**Technical Notes:**
- Uses manage-courses.html interface
- References courses.csv and sections.csv data
- POST/PUT/DELETE `/api/courses`

---

### Story 2.2: Assign Faculty to Courses Manually
**As a** chairperson  
**I want to** manually assign specific faculty to specific courses  
**So that** I can override AI suggestions when necessary

**Acceptance Criteria:**
- Can search and select faculty member
- Can search and select course section
- Can view faculty current workload (units)
- System warns if assignment exceeds max units
- System warns of time/room conflicts
- Can save partial assignments
- Can undo assignments

**Technical Notes:**
- Uses assign-courses.html interface
- Real-time conflict detection via CP-SAT constraints
- Updates Schedule model

---

### Story 2.3: View Section Coverage Status
**As a** chairperson  
**I want to** see which sections have assigned faculty and which don't  
**So that** I can ensure all courses are covered

**Acceptance Criteria:**
- Dashboard shows coverage percentage
- Can filter by program, year level, or semester
- Can see list of uncovered sections
- Can see over-covered sections (multiple faculty)
- Color-coded status indicators
- Can click to view section details

**Technical Notes:**
- Uses section-coverage-detail.html
- Real-time calculation of coverage metrics
- Links to assignment interface

---

## Epic 3: AI-Powered Schedule Generation

### Story 3.1: Generate Faculty Assignments Using AI
**As a** chairperson  
**I want to** generate faculty-to-course assignments using machine learning  
**So that** I can leverage historical patterns and faculty profiles

**Acceptance Criteria:**
- Can select semester and academic year
- System shows progress indicator during generation
- System displays confidence scores per assignment
- Can review assignments before accepting
- Can manually override individual assignments
- System explains reasoning for each assignment (specialization match, experience, historical data)
- Generation completes within 2 minutes

**Technical Notes:**
- POST `/api/generate` with academic_year and semester
- Random Forest classifier predicts assignments
- Uses faculty.csv, courses.csv, historical_assignments.csv
- Returns scored recommendations

---

### Story 3.2: Generate Optimized Timetable
**As a** chairperson  
**I want to** generate a conflict-free timetable with time slots and rooms  
**So that** I have a complete schedule ready for distribution

**Acceptance Criteria:**
- System enforces all hard constraints:
  - H1: Every section gets exactly one faculty
  - H2: Faculty units ≤ max_units
  - H3: Faculty availability matches section days
  - H4: No faculty time conflicts
  - H5: No room double-booking
- Timetable shows day, time, room, faculty for each section
- Generation fails with clear error if no solution exists
- Can regenerate with different parameters
- Can manually adjust time slots post-generation

**Technical Notes:**
- Uses CP-SAT solver (OR-Tools)
- References rooms.csv for room availability
- Validates against AvailabilitySubmission data
- Creates Schedule records in database

---

### Story 3.3: View Generated Timetables (Master List)
**As a** chairperson  
**I want to** view all generated faculty timetables in one place  
**So that** I can review the full schedule before publishing

**Acceptance Criteria:**
- Shows a list of all faculty with their assigned timetable
- Can click into an individual faculty's timetable
- Can filter by semester and academic year
- Can export all timetables as PDF
- Timetable data loaded from the CP-SAT solver result stored in `sessionStorage`

**Technical Notes:**
- Uses `generated-timetables.html` and `generated-timetables.js`
- API result (including `faculty_data` and `timetable`) stored in `sessionStorage` under key `ccisched_result`
- Client-side filtering and grouping

---

### Story 3.4: View Individual Faculty Timetable
**As a** chairperson  
**I want to** view a specific faculty member's weekly timetable in a grid layout  
**So that** I can review their schedule and export it as a PDF

**Acceptance Criteria:**
- Weekly grid shows days (Mon–Sat) on rows and time slots (7:30–19:30) on columns
- Each assigned block shows: course code, course name, section, and class type (Lecture / Laboratory)
- Lecture and Laboratory blocks are visually differentiated
- Displays faculty name and semester label in the toolbar
- Can print / export to PDF directly from the browser
- Back button returns to the master timetable list
- Falls back to an empty grid when no schedule data exists

**Technical Notes:**
- Uses `faculty-timetable.html` and `faculty-timetable.js`
- Receives `name`, `ay`, `sem`, and `from` via URL query parameters
- Reads timetable blocks from `sessionStorage` key `ccisched_result` (`timetable[faculty_id]`)
- PDF export via `window.print()` with a dedicated print stylesheet

---

### Story 3.5: View Room Availability
**As a** chairperson  
**I want to** see which rooms are available or occupied at any given time  
**So that** I can verify room assignments and identify capacity issues

**Acceptance Criteria:**
- Displays all rooms with their current status (Available / Occupied)
- Shows room ID, type (Lecture / Laboratory), and seating capacity
- Occupied rooms show the course currently assigned to them
- Summary stats: total rooms, available, occupied, lecture count, lab count
- Can filter by status (All / Available / Occupied)
- Can filter by room type (All / Lecture / Laboratory)
- Can search rooms by room ID
- Empty state shown when no rooms match the filters

**Technical Notes:**
- Uses `room-availability.html` and `room-availability.js`
- Room data currently client-side (static array); future integration with `rooms.csv` / database
- Filters applied client-side in real time

---

## Epic 4: Schedule Review & Distribution

### Story 4.1: Review Assignment Details
**As a** chairperson  
**I want to** review detailed assignment information  
**So that** I can validate correctness before finalizing

**Acceptance Criteria:**
- Can see summary statistics (total faculty, courses, sections)
- Can view workload distribution chart
- Can see specialization match rates
- Can drill down to individual faculty assignments
- Can see conflict warnings if any
- Can generate reports

**Technical Notes:**
- Uses assignment-detail.html
- Shows dept_detail and dept_summary from API
- Statistical analysis of assignments

---

### Story 4.2: Publish Schedule to Faculty
**As a** chairperson  
**I want to** persist and publish the generated schedule to all faculty dashboards  
**So that** everyone can immediately view their timetable assignments

**Acceptance Criteria:**
- Single action publishes the full generated schedule
- All previous schedule entries for the active semester are replaced atomically
- Each entry saved with: faculty, course code/title, section, class type, day, start/end time, room, units
- Faculty immediately see their schedule on their dashboards after publication
- System prevents publishing with no assignments provided
- Clear confirmation message with count of saved entries

**Technical Notes:**
- POST `/api/schedule/publish` — body contains `assignments` array
- Clears `Schedule` records for the active semester before inserting new ones (atomic wipe + re-insert)
- `_active_semester()` must return a valid semester, otherwise returns `400`
- Notifications are triggered separately via the availability review flow (`_check_all_approved`)

---

### Story 4.3: View Personal Timetable (Faculty)
**As a** faculty member  
**I want to** view my personal teaching schedule  
**So that** I know my class times, rooms, and sections

**Acceptance Criteria:**
- Dashboard shows current semester schedule
- Displays in weekly grid format
- Shows course code, section, room, time
- Shows total teaching units
- Can switch between semesters
- Can export personal schedule as PDF
- Mobile-responsive view

**Technical Notes:**
- Uses faculty/schedule.html
- GET `/api/schedule/my-schedule`
- Filters Schedule records by faculty_id

---

## Epic 5: Notifications & Communication

### Story 5.1: Receive Availability Submission Status Notifications
**As a** faculty member  
**I want to** receive in-app notifications about my availability submission  
**So that** I know when to act (e.g., revise and resubmit)

**Acceptance Criteria:**
- Notification on submission approval (`submission_approved`)
- Notification on submission rejection (`submission_rejected`) — includes chairperson remarks
- Notification on submission returned for revision (`submission_returned`) — includes revision remarks
- Notification badge in nav shows unread count
- Can mark individual notifications as read
- Can mark all notifications as read at once
- Notifications are ordered newest first

**Technical Notes:**
- Notifications created server-side in `review.py` during approve/reject/return actions
- GET `/api/notifications` — full list with `unread_count`
- GET `/api/notifications/unread` — count only (for badge polling)
- PATCH `/api/notifications/<id>/read` — mark one as read
- PATCH `/api/notifications/read-all` — mark all as read

---

### Story 5.2: Receive Chairperson Notification on New Submission
**As a** chairperson  
**I want to** be notified when a faculty member submits their availability  
**So that** I can review it promptly

**Acceptance Criteria:**
- Notification received immediately when faculty finalizes submission
- Notification includes faculty name, semester, and term
- Notification linked to the relevant submission
- Unread badge updated in real time (or on next poll)

**Technical Notes:**
- Triggered by POST `/api/availability/finalize`
- Type: `submission_received`
- `related_submission_id` links to the submission for direct navigation

---

### Story 5.3: Receive Schedule Ready Notification
**As a** faculty member  
**I want to** be notified when all availability submissions have been approved and the schedule is ready  
**So that** I can immediately check my teaching assignments

**Acceptance Criteria:**
- Notification sent automatically once the last `submitted` submission is approved
- Message confirms the semester and that the schedule can be viewed
- Notification links to the schedule view page
- Only faculty with approved submissions for that semester receive it

**Technical Notes:**
- Triggered automatically in `_check_all_approved()` inside `review.py`
- Type: `schedule_published`
- Fires when `pending` + `submitted` count for active semester drops to 0

---

### Story 5.4: View Notification Center
**As a** user (faculty or chairperson)  
**I want to** view all my notifications in one place  
**So that** I can review current and past system messages

**Acceptance Criteria:**
- All notifications shown, newest first
- Each entry shows: title, message, type, read/unread state, timestamp
- Unread notifications visually distinguished
- Can mark one or all as read
- Linking to related content (e.g., a submission) where applicable
- Empty state message when no notifications exist

**Technical Notes:**
- Uses `notifications.html` (both roles)
- GET `/api/notifications`
- No delete endpoint — notifications are retained permanently

---

## Epic 6: Profile & Preferences Management

### Story 6.1: View and Update Profile
**As a** user (faculty or chairperson)  
**I want to** view and edit my profile information  
**So that** the system has accurate personal and professional data for scheduling

**Acceptance Criteria:**
- Can view all profile fields on a dedicated page
- Can update: first name, last name, email, specialization, academic rank, highest educational attainment, years of experience, preferred courses, preferred days pattern, avatar (male/female)
- Cannot change employee number or role
- Email uniqueness validated — error if taken by another user
- `exp_years` must be a valid integer
- `avatar` must be `"male"` or `"female"`
- Changes are reflected immediately after save

**Technical Notes:**
- GET `/api/profile` — returns current user
- PATCH `/api/profile` — accepts any subset of `UPDATABLE_FIELDS`
- `preferred_courses` used as input feature by the Random Forest scorer
- Uses `profile.html` for both faculty and chairperson

---

### Story 6.2: Change Password
*(See Story 0.3 — part of the profile settings page)*

---

### Story 6.3: Manage Teaching Load Limits (Chairperson)
**As a** chairperson  
**I want to** set and update the maximum teaching units per faculty member  
**So that** the CP-SAT solver enforces workload limits during schedule generation

**Acceptance Criteria:**
- Can view each faculty member's current `max_units`
- Can update `max_units` for individual faculty
- Full-time default: 21 units; part-time: 9 units (configurable)
- Changes immediately apply to the next schedule generation run
- System displays current employment type alongside the limit

**Technical Notes:**
- Updates `User.max_units` field
- Enforced as CP-SAT hard constraint H2 during generation
- Accessible from the faculty management section of the chairperson portal

---

## Epic 7: Reporting & Analytics

### Story 7.1: View Dashboard Analytics (Chairperson)
**As a** chairperson  
**I want to** view scheduling analytics and metrics on my dashboard  
**So that** I can monitor overall department scheduling health at a glance

**Acceptance Criteria:**
- Shows total faculty, courses, and sections for the active semester
- Shows schedule completion percentage per department (BSIT, BSCS, etc.)
- Shows per-faculty assigned course count, with quick "View Details" link
- Shows faculty utilization rate (units assigned vs. max units)
- Shows room utilization rate
- Can switch between department tabs to see per-program completion
- Shows upcoming deadlines (e.g., availability submission due date)

**Technical Notes:**
- Uses `chairperson/dashboard.html` and `chairperson-dashboard.js`
- Schedule completion data driven by `schedule-completion.js` structure: `{ totalCourses, assignedCourses, faculty[] }`
- Department tabs toggle between BSIT and BSCS views
- Aggregates from `Schedule`, `AvailabilitySubmission`, and `User` models

---

### Story 7.2: View Teaching Assignment History
**As a** faculty member  
**I want to** view my teaching assignment history  
**So that** I can track my course load over time

**Acceptance Criteria:**
- Shows assignments by semester
- Shows courses taught, units, and sections
- Can filter by academic year
- Shows trends in workload
- Can export history as PDF

**Technical Notes:**
- Uses teaching-assignments.html
- Queries Schedule records filtered by faculty
- Historical data for Random Forest training

---

### Story 7.3: Generate Schedule Reports
**As a** chairperson  
**I want to** generate various schedule reports  
**So that** I can share scheduling information with stakeholders

**Acceptance Criteria:**
- Can generate master schedule report (all sections)
- Can generate faculty workload report
- Can generate room utilization report
- Can generate program-specific schedules
- Can select date range and filters
- Can export as PDF or Excel
- Reports show generation timestamp

**Technical Notes:**
- Server-side PDF generation
- Uses reportlab or similar library
- Scheduled exports option

---

## Epic 8: System Administration

### Story 8.1: Manage Semester Configuration
**As a** chairperson  
**I want to** create and configure academic semesters  
**So that** the system operates on the correct academic calendar

**Acceptance Criteria:**
- Can create new semester with academic year and term
- Can set start/end dates
- Can set max units per faculty for semester
- Can activate/deactivate semesters
- Only one active semester at a time
- Cannot delete semester with existing data

**Technical Notes:**
- Uses Semester model
- POST/PUT `/api/semesters`
- Cascades to submissions and schedules

---

### Story 8.2: Manage Faculty Accounts
**As a** chairperson  
**I want to** add and manage faculty user accounts  
**So that** all faculty can access the system

**Acceptance Criteria:**
- Can add new faculty with employee number, name, email
- Can set initial password or send reset link
- Can deactivate faculty accounts
- Can update faculty role and employment type
- Can bulk import from CSV
- Cannot delete accounts with history

**Technical Notes:**
- Uses User model with role="faculty"
- Password hashing with werkzeug
- Email verification optional

---

### Story 8.3: View Audit Logs
**As a** chairperson  
**I want to** view system audit logs  
**So that** I can track important actions and changes

**Acceptance Criteria:**
- Shows user actions (create, update, delete)
- Shows timestamp and user for each action
- Can filter by action type, user, or date range
- Shows before/after values for updates
- Cannot delete or modify logs
- Logs retained per policy

**Technical Notes:**
- Requires audit logging implementation
- Separate AuditLog model
- Middleware captures changes

---

## Non-Functional Requirements

### Performance
- Schedule generation completes within 2 minutes for 50 faculty, 20 courses
- Dashboard loads within 2 seconds
- Support 100 concurrent users
- API response time < 500ms for 95th percentile

### Security
- Password hashing using industry standards
- Role-based access control (faculty vs chairperson)
- Session timeout after 30 minutes of inactivity
- HTTPS for all communications
- SQL injection prevention
- XSS protection

### Usability
- Mobile-responsive design
- Accessible (WCAG 2.1 Level AA)
- Clear error messages
- Inline validation
- Consistent navigation
- Maximum 3 clicks to any feature

### Reliability
- 99% uptime during academic scheduling periods
- Automatic database backups daily
- Data validation prevents corrupt states
- Graceful error handling
- Transaction rollback on failures

### Compatibility
- Modern browsers (Chrome, Firefox, Edge, Safari - latest 2 versions)
- Works on desktop, tablet, and mobile devices
- Integrates with existing university authentication (future)

---

## Technical Architecture

### Frontend
- HTML5, CSS3, JavaScript (vanilla)
- Responsive design with mobile-first approach
- SVG icons and graphics
- Client-side form validation

### Backend
- Flask (Python web framework)
- SQLAlchemy ORM
- RESTful API design
- OR-Tools for CP-SAT solver
- scikit-learn for Random Forest

### Database
- MS SQL Server
- Normalized schema (3NF)
- Foreign key constraints
- Indexed queries for performance

### Machine Learning Pipeline
```
faculty.csv + courses.csv + historical_assignments.csv
    ↓
Random Forest Classifier (rf_model.py)
    ↓
Predicted faculty-course scores
    ↓
CP-SAT Solver (cpsat_solver.py)
    ↓
Optimized conflict-free timetable
```

### Deployment
- Windows Server environment
- IIS or nginx reverse proxy
- Python virtual environment (.venv)
- Automated backup scripts

---

## Success Metrics

### Primary Metrics
1. **Scheduling Time Reduction**: From 4-6 weeks to < 1 week
2. **Conflict Rate**: < 1% of generated schedules have conflicts
3. **Faculty Satisfaction**: > 85% satisfied with assigned courses
4. **System Adoption**: > 90% of faculty submit availability digitally

### Secondary Metrics
1. **Workload Balance**: Standard deviation of faculty units < 3
2. **Specialization Match**: > 80% assignments match faculty specialization
3. **Schedule Stability**: < 10% changes after initial publication
4. **User Engagement**: > 70% faculty log in weekly during scheduling period

---

## Future Enhancements

### Phase 2 Features
- Integration with university LMS (Learning Management System)
- Mobile native app (iOS/Android)
- Automated email reminders for submission deadlines
- Advanced analytics with predictive insights
- Multi-department support
- Calendar export (iCal, Google Calendar)

### Phase 3 Features
- Student enrollment integration
- Classroom utilization optimization
- Multi-campus scheduling
- API for external system integration
- Advanced reporting with BI tools
- Machine learning model retraining pipeline

---

## Glossary

**Academic Year**: A 12-month period (e.g., "2025-2026")  
**Semester**: Either 1st or 2nd term within an academic year  
**Section**: A specific class instance of a course (e.g., CMSC 21 - 1IT-A)  
**Teaching Load**: Total number of units assigned to a faculty member  
**CP-SAT**: Constraint Programming Solver from Google OR-Tools  
**Random Forest**: Ensemble machine learning algorithm for classification  
**Hard Constraint**: Must be satisfied (e.g., no double-booking)  
**Soft Constraint**: Preferred but not required (e.g., preferred days)  
**Conflict**: Overlapping assignments (time, room, or faculty)  
**Coverage**: Percentage of sections with assigned faculty

## API Endpoint Summary

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | All | Login |
| POST | `/api/auth/logout` | All | Logout |
| GET | `/api/auth/me` | All | Current user |
| GET | `/api/profile` | All | Get own profile |
| PATCH | `/api/profile` | All | Update profile |
| PATCH | `/api/profile/password` | All | Change password |
| GET | `/api/availability` | Faculty | Own submission for active semester |
| POST | `/api/availability` | Faculty | Save/replace draft slots |
| POST | `/api/availability/finalize` | Faculty | Submit finalized availability |
| DELETE | `/api/availability/slots/<id>` | Faculty | Remove one draft slot |
| GET | `/api/availability/all` | Chairperson | All submissions for active semester |
| GET | `/api/availability/<id>` | Chairperson | Single submission detail |
| POST | `/api/review/<id>/approve` | Chairperson | Approve submission |
| POST | `/api/review/<id>/reject` | Chairperson | Reject submission |
| POST | `/api/review/<id>/return` | Chairperson | Return for revision |
| GET | `/api/schedule` | Faculty | Own schedule |
| GET | `/api/schedule/<faculty_id>` | Chairperson | Any faculty's schedule |
| POST | `/api/schedule/publish` | Chairperson | Persist generated schedule |
| GET | `/api/notifications` | All | All notifications + unread count |
| GET | `/api/notifications/unread` | All | Unread count only |
| PATCH | `/api/notifications/<id>/read` | All | Mark one as read |
| PATCH | `/api/notifications/read-all` | All | Mark all as read |
| GET | `/api/health` | — | Server status |
| POST | `/api/generate` | Chairperson | Run RF → CP-SAT pipeline |
| GET | `/api/faculty` | Chairperson | List all faculty |
| GET | `/api/courses` | Chairperson | List active courses |

---

*Document Version: 1.2*  
*Last Updated: September 3, 2026*  
*Project: CCISched - PUP CCIS*  
*Team: Beltran, Laranang, Lontoc, Padrique*
