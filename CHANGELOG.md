- Switched backend from PostgreSQL to MySQL.
- Fixed login, sessions, database setup, and seeding issues.
- Fixed Faculty Availability to use real database data.
- Fixed course assignments and made them editable.
- Fixed stale/incorrect notifications.
- Fixed Schedule Completion to use real faculty assignments.
- Fixed Faculty Teaching Assignments to use live data.
- Removed fake fallback data from timetable and assignment pages.
- Added CSV import for faculty, courses, rooms, sections, availability, and other data.
- Added CSV validation and import rules.
- Fixed Room Availability to use real rooms and schedules.
- Room status now follows the current time and schedule.
- Cleaned up hardcoded/demo data where needed.
- Added an Audit Log: records every state-changing action by chairperson and faculty (logins, failed logins, logouts, availability, reviews, course/section/faculty edits, generation, publishing, imports, profile changes), including failed/forbidden attempts.
- Audit Log page (chairperson only) with filters, search, pagination and CSV export. Entries are append-only.
- Fixed faculty profile missing Middle Name and Contact Number: the faculty CSV import now accepts "middle name" and "contact" headers, and maps Full-Time/Part-Time to the profile dropdown values (plus a Designee option).
- Faculty seed data replaced with CCISched-CCIS-Faculty.csv (55 faculty). Importer now reads "middle initial"; blank values in the CSV clear old ones; passwords are only set when an account is first created (re-importing no longer resets them). Employment types Permanent/Temporary/Part-Time supported in filters, profile and the ranking model.
- Faculty profile: removed the hardcoded "Maria Santos" placeholder; if the profile can't be loaded from the server the page now shows a red banner with the error instead of silently showing blank fields.
- Faculty profile and dashboard avatars now follow the gender saved on the profile instead of always showing the female avatar.
- Faculty dashboard is now fully data-driven: semester/AY labels, section counts, and the Availability Slots list come from the API (no more hardcoded "3 Sections" / "1st Sem"); removed a duplicate function that showed "Submitted" for approved submissions. Fixed the availability seeder mangling times ("8:00:00" -> "8:00:").
- Seed data replaced with the Oct 1 export (9 files, now in backend/data/ as CCISched-*.csv without the "-1" suffixes; the old files and the stray "- Copy" files were removed). Courses 57, curriculum 83, faculty 55, qualifications 1,283, availability matrix 3,297 rows, historical 1,664 rows.
- Seeder updates for the new layout: courses use the renamed `department` (IT/CS track) and `college` columns; qualifications no longer need `preference_rank` (taken from row order); availability is filtered to the active semester via `semester_id`, and back-to-back Morning/Afternoon/Evening shifts are merged into continuous slots so the solver doesn't lose periods that straddle a shift boundary. The CSV import page and its fallback metadata were updated to match.
- Specialization matching: faculty specializations are now course titles, so the ranking model matches them by course title / numbered family (e.g. Software Engineering 1 and 2) in addition to the existing keyword map. Previously only 2 of 55 faculty would have matched anything.
- NEW DATA ADDED
- Fixed Chairperson Edit Profile to load personal and academic fields from the logged-in account via the profile API; removed hardcoded Christian Rey/demo details and made the chairperson dashboard name live as well.
- Added an Add Chairperson form on the Chairperson Faculty page; it creates database accounts with the chairperson role and a generated initial password.
- Added notif for assingment and timetable distribution
- Fixed submissions page in chairperson dashboard

Acknowledgements
This project would never be complete without the support of the group, our families, our loved ones.
Keith Lontoc would like to thank Niña Joyce for her unending support and motivation and inspiration.
## UI fixes (2026-10-01)
- Removed Web Development and Capstone 1 from faculty availability choices.
- Removed Rejected from the chairperson submissions filter.
- Added delete controls for editable faculty availability slots.
- Changed notification timestamps to readable text (for example, “8 hours ago”).
