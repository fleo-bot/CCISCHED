"""
models.py
---------
SQLAlchemy ORM models for CCISched.

Tables
──────
  users                  — faculty + chairperson accounts
  semesters              — academic semesters
  availability_slots     — individual day/time preference slots
  availability_submissions — one submission per faculty per semester
  schedules              — generated schedule entries (faculty × section × time)
  notifications          — in-app notifications for both roles
"""

from __future__ import annotations
from datetime import datetime, timezone

from database import db


# ─────────────────────────────────────────────────────────────
#  USERS
# ─────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id                    = db.Column(db.Integer, primary_key=True)
    employee_number       = db.Column(db.String(30), unique=True, nullable=False)
    first_name            = db.Column(db.String(80), nullable=False)
    last_name             = db.Column(db.String(80), nullable=False)
    email                 = db.Column(db.String(120), unique=True, nullable=False)
    password_hash         = db.Column(db.String(256), nullable=False)

    # "faculty" | "chairperson"
    role                  = db.Column(db.String(20), nullable=False, default="faculty")

    # Profile fields
    specialization        = db.Column(db.String(100))
    academic_rank         = db.Column(db.String(80))
    highest_educ_attainment = db.Column(db.String(80))
    exp_years             = db.Column(db.Integer, default=0)
    employment_type       = db.Column(db.String(20), default="Full Time")  # Full Time | Part Time
    max_units             = db.Column(db.Integer, default=21)
    preferred_courses     = db.Column(db.String(200))   # comma-separated course codes
    preferred_days        = db.Column(db.String(20))    # MWF | TTh | Sat | etc.

    # Avatar — "male" | "female" (maps to SVG assets)
    avatar                = db.Column(db.String(10), default="female")

    created_at            = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at            = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                                      onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    submissions   = db.relationship("AvailabilitySubmission", back_populates="faculty",
                                    cascade="all, delete-orphan")
    notifications = db.relationship("Notification", back_populates="user",
                                    cascade="all, delete-orphan",
                                    foreign_keys="Notification.user_id")
    schedules     = db.relationship("Schedule", back_populates="faculty",
                                    cascade="all, delete-orphan")

    def to_dict(self, include_private: bool = False) -> dict:
        d = {
            "id":                      self.id,
            "employee_number":         self.employee_number,
            "first_name":              self.first_name,
            "last_name":               self.last_name,
            "full_name":               f"{self.first_name} {self.last_name}",
            "email":                   self.email,
            "role":                    self.role,
            "specialization":          self.specialization,
            "academic_rank":           self.academic_rank,
            "highest_educ_attainment": self.highest_educ_attainment,
            "exp_years":               self.exp_years,
            "employment_type":         self.employment_type,
            "max_units":               self.max_units,
            "preferred_courses":       self.preferred_courses,
            "preferred_days":          self.preferred_days,
            "avatar":                  self.avatar,
            "created_at":              self.created_at.isoformat() if self.created_at else None,
            "updated_at":              self.updated_at.isoformat() if self.updated_at else None,
        }
        return d


# ─────────────────────────────────────────────────────────────
#  SEMESTERS
# ─────────────────────────────────────────────────────────────
class Semester(db.Model):
    __tablename__ = "semesters"

    id                  = db.Column(db.Integer, primary_key=True)
    academic_year       = db.Column(db.String(20), nullable=False)   # "2025-2026"
    semester_term       = db.Column(db.String(10), nullable=False)   # "1st" | "2nd"
    start_date          = db.Column(db.Date)
    end_date            = db.Column(db.Date)
    max_units_per_faculty = db.Column(db.Integer, default=21)
    is_active           = db.Column(db.Boolean, default=False)

    submissions = db.relationship("AvailabilitySubmission", back_populates="semester",
                                  cascade="all, delete-orphan")
    schedules   = db.relationship("Schedule", back_populates="semester",
                                  cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id":                    self.id,
            "academic_year":         self.academic_year,
            "semester_term":         self.semester_term,
            "start_date":            self.start_date.isoformat() if self.start_date else None,
            "end_date":              self.end_date.isoformat() if self.end_date else None,
            "max_units_per_faculty": self.max_units_per_faculty,
            "is_active":             self.is_active,
        }


# ─────────────────────────────────────────────────────────────
#  AVAILABILITY SUBMISSIONS
# ─────────────────────────────────────────────────────────────
class AvailabilitySubmission(db.Model):
    __tablename__ = "availability_submissions"

    id          = db.Column(db.Integer, primary_key=True)
    faculty_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    semester_id = db.Column(db.Integer, db.ForeignKey("semesters.id"), nullable=False)

    # pending | submitted | approved | rejected | returned
    status      = db.Column(db.String(20), nullable=False, default="pending")

    # Chairperson feedback when returning / rejecting
    remarks     = db.Column(db.Text)

    submitted_at  = db.Column(db.DateTime)
    reviewed_at   = db.Column(db.DateTime)
    reviewed_by   = db.Column(db.Integer, db.ForeignKey("users.id"))

    created_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    faculty     = db.relationship("User", back_populates="submissions",
                                  foreign_keys=[faculty_id])
    reviewer    = db.relationship("User", foreign_keys=[reviewed_by])
    semester    = db.relationship("Semester", back_populates="submissions")
    slots       = db.relationship("AvailabilitySlot", back_populates="submission",
                                  cascade="all, delete-orphan")

    __table_args__ = (
        db.UniqueConstraint("faculty_id", "semester_id", name="uq_faculty_semester"),
    )

    def to_dict(self, include_slots: bool = True) -> dict:
        d = {
            "id":           self.id,
            "faculty_id":   self.faculty_id,
            "faculty_name": self.faculty.full_name if self.faculty else None,
            "semester_id":  self.semester_id,
            "semester":     self.semester.to_dict() if self.semester else None,
            "status":       self.status,
            "remarks":      self.remarks,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "reviewed_at":  self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewed_by":  self.reviewed_by,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
            "updated_at":   self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_slots:
            d["slots"] = [s.to_dict() for s in self.slots]
        return d

    # Convenience property used in to_dict
    @property
    def full_name(self):
        return f"{self.faculty.first_name} {self.faculty.last_name}" if self.faculty else ""


# ─────────────────────────────────────────────────────────────
#  AVAILABILITY SLOTS  (child of submission)
# ─────────────────────────────────────────────────────────────
class AvailabilitySlot(db.Model):
    __tablename__ = "availability_slots"

    id              = db.Column(db.Integer, primary_key=True)
    submission_id   = db.Column(db.Integer, db.ForeignKey("availability_submissions.id"),
                                nullable=False)
    slot_number     = db.Column(db.Integer, nullable=False)   # 1, 2, 3 …

    # Days as comma-separated indices: "0,2,4" = Mon, Wed, Fri
    day_indices     = db.Column(db.String(20), nullable=False)

    time_start      = db.Column(db.String(10), nullable=False)  # "07:00"
    time_end        = db.Column(db.String(10), nullable=False)  # "17:00"
    time_label      = db.Column(db.String(40))                  # "7:00 AM – 5:00 PM"

    submission = db.relationship("AvailabilitySubmission", back_populates="slots")

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "slot_number":  self.slot_number,
            "day_indices":  [int(x) for x in self.day_indices.split(",") if x],
            "time_start":   self.time_start,
            "time_end":     self.time_end,
            "time_label":   self.time_label,
        }


# ─────────────────────────────────────────────────────────────
#  SCHEDULES  (generated timetable entries)
# ─────────────────────────────────────────────────────────────
class Schedule(db.Model):
    __tablename__ = "schedules"

    id              = db.Column(db.Integer, primary_key=True)
    faculty_id      = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    semester_id     = db.Column(db.Integer, db.ForeignKey("semesters.id"), nullable=False)

    course_code     = db.Column(db.String(20), nullable=False)
    course_title    = db.Column(db.String(120), nullable=False)
    section_name    = db.Column(db.String(40), nullable=False)
    class_type      = db.Column(db.String(20), default="Lecture")  # Lecture | Laboratory

    day             = db.Column(db.String(15), nullable=False)      # "Monday"
    time_start      = db.Column(db.String(10), nullable=False)      # "07:30"
    time_end        = db.Column(db.String(10), nullable=False)      # "09:00"
    room            = db.Column(db.String(40))

    units           = db.Column(db.Integer, default=3)

    created_at      = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    faculty     = db.relationship("User", back_populates="schedules")
    semester    = db.relationship("Semester", back_populates="schedules")

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "faculty_id":   self.faculty_id,
            "semester_id":  self.semester_id,
            "course_code":  self.course_code,
            "course_title": self.course_title,
            "section_name": self.section_name,
            "class_type":   self.class_type,
            "day":          self.day,
            "time_start":   self.time_start,
            "time_end":     self.time_end,
            "room":         self.room,
            "units":        self.units,
        }


# ─────────────────────────────────────────────────────────────
#  NOTIFICATIONS
# ─────────────────────────────────────────────────────────────
class Notification(db.Model):
    __tablename__ = "notifications"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # "submission_received" | "submission_approved" | "submission_rejected"
    # "submission_returned" | "schedule_published"
    notif_type  = db.Column(db.String(40), nullable=False)

    title       = db.Column(db.String(120), nullable=False)
    message     = db.Column(db.Text, nullable=False)
    is_read     = db.Column(db.Boolean, default=False)

    # Optional link to related objects
    related_submission_id = db.Column(db.Integer,
                                      db.ForeignKey("availability_submissions.id"),
                                      nullable=True)

    created_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user        = db.relationship("User", back_populates="notifications",
                                  foreign_keys=[user_id])

    def to_dict(self) -> dict:
        return {
            "id":                     self.id,
            "user_id":                self.user_id,
            "notif_type":             self.notif_type,
            "title":                  self.title,
            "message":                self.message,
            "is_read":                self.is_read,
            "related_submission_id":  self.related_submission_id,
            "created_at":             self.created_at.isoformat() if self.created_at else None,
        }
