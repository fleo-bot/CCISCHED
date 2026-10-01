"""
room_allocator.py
-----------------
Conflict-free room assignment for published timetables.

The CP-SAT solver only decides WHO teaches WHAT and WHEN ("rooms deferred",
room_id = 0).  Without this step every published Schedule row is saved with
room "TBA", so the Room Availability page has nothing to match against and
every room is always shown as "Available".

This module is deliberately free of Flask / SQLAlchemy so it can be unit
tested on its own.  It works on any objects that expose:
    id, room_code, room_type, capacity, is_active
"""

from __future__ import annotations

import re
from typing import Iterable, Sequence


def to_minutes(value) -> int | None:
    """'07:30', '07:30:00', '1:30 PM' -> minutes since midnight (or None)."""
    m = re.fullmatch(
        r"\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*", str(value or "")
    )
    if not m:
        return None
    h, minute, mer = int(m.group(1)), int(m.group(2)), (m.group(3) or "").upper()
    if mer == "PM" and h < 12:
        h += 12
    if mer == "AM" and h == 12:
        h = 0
    if h > 23 or minute > 59:
        return None
    return h * 60 + minute


def wanted_room_type(lec_units: int | None, lab_units: int | None) -> str:
    """Laboratory when the course is lab-dominant, otherwise Lecture."""
    lab = lab_units or 0
    lec = lec_units or 0
    return "Laboratory" if lab > 0 and lab >= lec else "Lecture"


def is_lab(room_type: str | None) -> bool:
    return "lab" in str(room_type or "").lower()


class RoomAllocator:
    def __init__(self, rooms: Iterable):
        self.rooms = sorted(
            (r for r in rooms if getattr(r, "is_active", True) is not False),
            key=lambda r: r.room_code,
        )
        # room_id -> day -> [(start_min, end_min)]
        self._booked: dict[int, dict[str, list[tuple[int, int]]]] = {}
        self._usage: dict[int, int] = {r.id: 0 for r in self.rooms}

    # ── bookings ──────────────────────────────────────────
    def reserve(self, room_id: int, days: Sequence[str], start: int, end: int) -> None:
        by_day = self._booked.setdefault(room_id, {})
        for day in days:
            by_day.setdefault(day, []).append((start, end))
        self._usage[room_id] = self._usage.get(room_id, 0) + len(days)

    def is_free(self, room_id: int, days: Sequence[str], start: int, end: int) -> bool:
        by_day = self._booked.get(room_id, {})
        for day in days:
            for s, e in by_day.get(day, ()):
                if start < e and s < end:      # half-open interval overlap
                    return False
        return True

    # ── selection ─────────────────────────────────────────
    def pick(self, days: Sequence[str], start: int, end: int,
             want_type: str = "Lecture", min_capacity: int = 0):
        """Return a free room (preferring `want_type`), or None if none free.

        Among equally suitable rooms the least-used one wins so classes are
        spread across the building instead of piling into the first room.
        """
        want_lab = is_lab(want_type)

        def rank(room):
            type_penalty = 0 if is_lab(room.room_type) == want_lab else 1
            cap_penalty = 0 if (room.capacity or 0) >= min_capacity else 1
            return (cap_penalty, type_penalty, self._usage.get(room.id, 0), room.room_code)

        for room in sorted(self.rooms, key=rank):
            if self.is_free(room.id, days, start, end):
                return room
        return None


def room_label(room) -> str:
    """Same label format publish_schedule has always used."""
    return f"{room.room_code} ({room.building})"
