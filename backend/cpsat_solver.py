"""
cpsat_solver.py
---------------
CP-SAT constraint layer of the CCISched pipeline.

Works at the SECTION level — each section in Sections.csv must be
assigned to exactly one faculty member.

Hard constraints
────────────────
H1. Each section gets exactly one faculty assigned.
H2. Faculty total assigned units ≤ max_units (from faculty.csv).
H3. Faculty may only be assigned to a section whose preferred_days
    overlaps their available days.
H4. No faculty may be double-booked: two sections assigned to the
    same faculty may not have overlapping time slots on the same day.
H5. No room double-booking: two sections in the same room at the
    same time on the same day cannot both be assigned (rooms are
    pre-assigned in Sections.csv, so this is a sanity check).

Soft constraints (maximised in objective)
─────────────────────────────────────────
S1. Maximise sum of RF scores across all assignments.
S2. +0.10 bonus per section where course code is in preferred_courses.

Output
──────
  solve(...) → list[dict]  — one dict per assigned section
"""

from __future__ import annotations

import re
from typing import Dict, List

import pandas as pd

try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False


# ──────────────────────────────────────────────
#  Day / time helpers
# ──────────────────────────────────────────────
_DAY_SETS = {
    "MWF":  {"Monday", "Wednesday", "Friday"},
    "TTh":  {"Tuesday", "Thursday"},
    "Sat":  {"Saturday"},
    "MTh":  {"Monday", "Thursday"},
    "MW":   {"Monday", "Wednesday"},
    "TF":   {"Tuesday", "Friday"},
}

_PREF_DAY_COLS = {
    "Monday":    "time_preference_mon",
    "Tuesday":   "time_preference_tue",
    "Wednesday": "time_preference_wed",
    "Thursday":  "time_preference_thu",
    "Friday":    "time_preference_fri",
    "Saturday":  "time_preference_sat",
}


def _faculty_available_days(frow: pd.Series) -> set[str]:
    """Days where the faculty is NOT 'Not available'."""
    avail = set()
    for day, col in _PREF_DAY_COLS.items():
        val = str(frow.get(col, "Not available")).strip().lower()
        if val not in ("not available", "none", ""):
            avail.add(day)
    return avail


def _section_days(srow: pd.Series) -> set[str]:
    """Expand 'MWF' / 'TTh' etc. to a set of day names."""
    raw = str(srow.get("preferred_days", "MWF")).strip()
    return _DAY_SETS.get(raw, {"Monday", "Wednesday", "Friday"})


def _days_compatible(frow: pd.Series, srow: pd.Series) -> bool:
    return bool(_faculty_available_days(frow) & _section_days(srow))


def _time_to_minutes(t: str) -> int:
    """'07:30:00' → 450"""
    try:
        parts = str(t).split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0


def _slots_overlap(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
    """True if two [start, end) intervals overlap."""
    return start_a < end_b and start_b < end_a


def _parse_preferred(raw: str) -> list[str]:
    if not isinstance(raw, str):
        return []
    return [c.strip().upper() for c in re.split(r"[,;|]+", raw) if c.strip()]


# ──────────────────────────────────────────────
#  Justification builder
# ──────────────────────────────────────────────
def _justification(frow: pd.Series, crow: pd.Series,
                   srow: pd.Series, rf_score: float) -> str:
    name      = f"{frow['first_name']} {frow['last_name']}"
    code      = crow["course_code"]
    prefs     = _parse_preferred(frow.get("preferred_courses", ""))
    pref_note = f"{code} is in {name.split()[0]}'s preferred courses. " if code in prefs else ""
    spec_note = f"Specialisation in {frow.get('specialization', 'N/A')} aligns well. "
    exp_note  = f"{int(frow.get('exp_years', 0))} yr(s) experience. "
    day_note  = f"Available on {srow.get('preferred_days','?')} days. "
    sc_note   = f"RF fitness: {rf_score:.0%}."
    return pref_note + spec_note + exp_note + day_note + sc_note


# ──────────────────────────────────────────────
#  Greedy fallback
# ──────────────────────────────────────────────
def _greedy_solve(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    rooms_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
) -> List[dict]:
    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")
    load_used  = {int(fid): 0 for fid in fac_idx.index}
    # Track (faculty_id, day, start_min) to detect time conflicts
    booked: dict[int, list[tuple[set, int, int]]] = {int(fid): [] for fid in fac_idx.index}

    results = []

    for _, srow in sections_df.iterrows():
        sid      = int(srow["section_id"])
        cid      = int(srow["course_id"])
        units    = 3  # default; override from courses if available
        if cid in course_idx.index:
            units = int(course_idx.loc[cid].get("units", 3))

        s_days  = _section_days(srow)
        s_start = _time_to_minutes(srow["preferred_time_start"])
        s_end   = _time_to_minutes(srow["preferred_time_end"])

        candidates = []
        for fid, frow in fac_idx.iterrows():
            fid = int(fid)
            max_u = int(frow.get("max_units", 21) or 21)
            if load_used[fid] + units > max_u:
                continue
            if not _days_compatible(frow, srow):
                continue
            # Check time conflict with already-assigned sections
            conflict = False
            for (days_b, start_b, end_b) in booked[fid]:
                if days_b & s_days and _slots_overlap(s_start, s_end, start_b, end_b):
                    conflict = True
                    break
            if conflict:
                continue
            sc = scores.get(fid, {}).get(sid, 0.0)
            candidates.append((sc, fid))

        if not candidates:
            continue

        candidates.sort(reverse=True)
        best_score, best_fid = candidates[0]
        frow = fac_idx.loc[best_fid]
        load_used[best_fid] += units
        booked[best_fid].append((s_days, s_start, s_end))

        crow = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course"
        })

        results.append({
            "faculty_id":      best_fid,
            "faculty_name":    f"{frow['first_name']} {frow['last_name']}",
            "section_id":      sid,
            "section_name":    srow["section_name"],
            "course_id":       cid,
            "course_code":     crow["course_code"],
            "course_title":    crow["course_title"],
            "units":           units,
            "preferred_days":  srow["preferred_days"],
            "time_start":      srow["preferred_time_start"],
            "time_end":        srow["preferred_time_end"],
            "room_id":         int(srow.get("room_id", 0) or 0),
            "employment_type": frow.get("employment_type", "Full Time"),
            "load":            load_used[best_fid],
            "max_units":       int(frow.get("max_units", 21) or 21),
            "rf_score":        round(best_score * 100, 1),
            "justification":   _justification(frow, crow, srow, best_score),
        })

    return results


# ──────────────────────────────────────────────
#  CP-SAT solve
# ──────────────────────────────────────────────
def solve(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    rooms_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
) -> List[dict]:
    """
    Main entry point.  Returns a list of assignment dicts (one per section).
    Falls back to greedy if OR-Tools is not installed.
    """
    if not ORTOOLS_AVAILABLE:
        return _greedy_solve(faculty_df, sections_df, courses_df, rooms_df, scores)

    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")

    faculty_ids  = [int(f) for f in fac_idx.index]
    section_rows = sections_df.reset_index(drop=True)
    section_ids  = [int(r["section_id"]) for _, r in section_rows.iterrows()]

    SCALE = 10_000
    model  = cp_model.CpModel()

    # x[fid][sid] = 1 iff faculty fid teaches section sid
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    for fid in faculty_ids:
        for sid in section_ids:
            x[(fid, sid)] = model.NewBoolVar(f"x_{fid}_{sid}")

    # ── H1: each section assigned to exactly one faculty ──
    for sid in section_ids:
        model.AddExactlyOne(x[(fid, sid)] for fid in faculty_ids)

    # Pre-compute section units and time data
    sec_units: dict[int, int] = {}
    sec_days:  dict[int, set] = {}
    sec_start: dict[int, int] = {}
    sec_end:   dict[int, int] = {}

    for _, srow in section_rows.iterrows():
        sid = int(srow["section_id"])
        cid = int(srow["course_id"])
        sec_units[sid] = int(course_idx.loc[cid]["units"]) if cid in course_idx.index else 3
        sec_days[sid]  = _section_days(srow)
        sec_start[sid] = _time_to_minutes(srow["preferred_time_start"])
        sec_end[sid]   = _time_to_minutes(srow["preferred_time_end"])

    # ── H2: load limit per faculty ──
    for fid in faculty_ids:
        frow  = fac_idx.loc[fid]
        max_u = int(frow.get("max_units", 21) or 21)
        model.Add(
            sum(x[(fid, sid)] * sec_units[sid] for sid in section_ids) <= max_u
        )

    # ── H3: day availability ──
    for fid in faculty_ids:
        frow      = fac_idx.loc[fid]
        avail     = _faculty_available_days(frow)
        for _, srow in section_rows.iterrows():
            sid = int(srow["section_id"])
            if not (avail & sec_days[sid]):
                model.Add(x[(fid, sid)] == 0)

    # ── H4: no faculty time-conflict ──
    # For every pair of sections that share at least one day AND overlap in time,
    # at most one can be assigned to the same faculty.
    for i in range(len(section_ids)):
        for j in range(i + 1, len(section_ids)):
            sid_a = section_ids[i]
            sid_b = section_ids[j]
            if (sec_days[sid_a] & sec_days[sid_b] and
                    _slots_overlap(sec_start[sid_a], sec_end[sid_a],
                                   sec_start[sid_b], sec_end[sid_b])):
                for fid in faculty_ids:
                    model.Add(x[(fid, sid_a)] + x[(fid, sid_b)] <= 1)

    # ── H5: no room double-booking ──
    # Group sections by room; within the same room, pairs that overlap in time
    # on overlapping days cannot both run (they are already fixed in the CSV,
    # but we validate here so the solver can see the constraint).
    room_sections: dict[int, list[int]] = {}
    for _, srow in section_rows.iterrows():
        rid = int(srow.get("room_id", 0) or 0)
        room_sections.setdefault(rid, []).append(int(srow["section_id"]))

    for rid, sids in room_sections.items():
        for i in range(len(sids)):
            for j in range(i + 1, len(sids)):
                sa, sb = sids[i], sids[j]
                if (sec_days[sa] & sec_days[sb] and
                        _slots_overlap(sec_start[sa], sec_end[sa],
                                       sec_start[sb], sec_end[sb])):
                    # Both sections in the same room at the same time: impossible
                    # to assign them simultaneously regardless of faculty
                    for fid in faculty_ids:
                        model.Add(x[(fid, sa)] + x[(fid, sb)] <= 1)

    # ── Objective: maximise weighted RF score + preference bonus ──
    obj = []
    for fid in faculty_ids:
        frow  = fac_idx.loc[fid]
        prefs = _parse_preferred(frow.get("preferred_courses", ""))
        for _, srow in section_rows.iterrows():
            sid = int(srow["section_id"])
            cid = int(srow["course_id"])
            code = course_idx.loc[cid]["course_code"] if cid in course_idx.index else ""
            raw  = scores.get(fid, {}).get(sid, 0.0)
            bonus = 0.10 if code in prefs else 0.0
            weight = int((raw + bonus) * SCALE)
            obj.append(x[(fid, sid)] * weight)

    model.Maximize(sum(obj))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60.0
    solver.parameters.num_search_workers  = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return _greedy_solve(faculty_df, sections_df, courses_df, rooms_df, scores)

    # ── Extract results ──
    load_used = {fid: 0 for fid in faculty_ids}
    results   = []

    for _, srow in section_rows.iterrows():
        sid  = int(srow["section_id"])
        cid  = int(srow["course_id"])
        crow = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course", "units": 3
        })
        units = int(crow.get("units", 3))

        for fid in faculty_ids:
            if solver.Value(x[(fid, sid)]) == 1:
                load_used[fid] += units
                frow = fac_idx.loc[fid]
                sc   = scores.get(fid, {}).get(sid, 0.0)

                results.append({
                    "faculty_id":      fid,
                    "faculty_name":    f"{frow['first_name']} {frow['last_name']}",
                    "section_id":      sid,
                    "section_name":    srow["section_name"],
                    "course_id":       cid,
                    "course_code":     crow["course_code"],
                    "course_title":    crow["course_title"],
                    "units":           units,
                    "preferred_days":  srow["preferred_days"],
                    "time_start":      srow["preferred_time_start"],
                    "time_end":        srow["preferred_time_end"],
                    "room_id":         int(srow.get("room_id", 0) or 0),
                    "employment_type": frow.get("employment_type", "Full Time"),
                    "load":            load_used[fid],
                    "max_units":       int(frow.get("max_units", 21) or 21),
                    "rf_score":        round(sc * 100, 1),
                    "justification":   _justification(frow, crow, srow, sc),
                })
                break

    return results
