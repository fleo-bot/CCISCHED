"""
cpsat_solver.py
---------------
CP-SAT constraint layer of the CCISched pipeline, split into two sequential
stages so "who teaches what" and "when do they teach it" are decided by two
separate models, matching the study's two use cases (Generate Faculty
Assignment, Generate Timetable):

  STAGE 1 — solve_faculty_assignment()
    Decides which faculty teaches which section. The Random Forest's
    suitability scores (rf_model.compute_scores) are the only thing being
    maximised here — this is where "the RF applies."

  STAGE 2 — solve_timetable()
    Takes STAGE 1's fixed (faculty, section) pairs and decides a real
    (day, time slot) for each one, subject to the faculty's actual
    availability and no double-booking. It does not re-decide who teaches
    what — that was already fixed in stage 1.

Both stages are solved with CP-SAT (falling back to a greedy heuristic if
OR-Tools isn't installed or a model comes back infeasible within its time
budget) — "both ... has cp sat."

Time slots come from a shared global grid that mirrors the availability
form's own 90-minute rows exactly (src/scripts/availability-utils.js
TIME_BLOCKS), so a faculty member's real submitted availability — however
many blocks, on whatever days, including evenings — maps onto the same grid
the timetable is built from. (An earlier version of this pruning only
recognised the two shift blocks "08:xx" and "13:xx" from the original seed
data; any slot outside that exact pattern was silently dropped from
candidacy. That bug is fixed by building the grid from real time ranges via
_slot_range()/block containment instead of string-matching a shift label.)

Known simplification (unchanged from before): each (cohort x course)
offering gets exactly ONE 90-minute weekly meeting, regardless of unit
count — a 3-unit course would really meet more than once a week. Rooms are
also not assigned in this pass.

Hard constraints
----------------
Stage 1 (assignment):
  H1. Each section is assigned to AT MOST one faculty — not every offering
      is guaranteed coverage if total faculty capacity can't cover them all.
  H2. Faculty total assigned units <= max_units.
  Qualification is a strong PREFERENCE, not a hard rule: every eligible
  faculty is a candidate for every section, but qualified faculty are
  always favoured. A non-qualified faculty is only used when the qualified
  ones are out of capacity (or a course has no qualified faculty at all),
  and those assignments are flagged in their justification text.
  Fallback comes in two tiers: faculty from the SAME department as the
  section's program (BSIT -> Information Technology, BSCS -> Computer
  Science, BSIS -> Information Systems) are used first, then faculty from
  OTHER departments. Set RESTRICT_FALLBACK_TO_DEPARTMENT = True to disable
  the cross-department tier. If a department is missing or not recognised,
  the faculty counts as same-department.

Stage 2 (timetable):
  H3. A faculty can only be placed in a slot they're actually available for
      (from their real availability data).
  H4. No faculty double-booking: a faculty can teach at most one of their
      assigned offerings per slot.
  H5. No cohort double-booking: a cohort (student group, e.g. "BSIT 4-1")
      can attend at most one of its own courses per slot.
  A stage-1 pair that has no feasible slot (e.g. every slot the faculty is
  available for is already taken by their other offerings) is returned
  separately as "unscheduled" rather than silently dropped.

Soft constraints (maximised in objective)
------------------------------------------
Stage 1: S1. Maximise sum of RF scores across all assignments.
         S2. +0.10 bonus per section where course code is in preferred_courses.
Stage 2: maximise the number of stage-1 pairs that get placed into a slot
         (coverage), with a small secondary weight toward placing
         higher-RF-score pairs first when there's slack to choose from.

Output
------
  solve_faculty_assignment(...) -> (list[dict], str)   -- rows, solver mode
  solve_timetable(...)          -> (list[dict], list[dict], str)
                                    -- scheduled rows, unscheduled rows, mode
"""

from __future__ import annotations

import re
from typing import Dict, List

import pandas as pd
from rf_model import specialization_matches

try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False


# ──────────────────────────────────────────────
#  Global slot grid
#  Mirrors AvailabilityUtils.TIME_BLOCKS in the frontend exactly (same 9
#  90-minute rows, same boundaries), so real submitted availability — not
#  just the two Morning/Afternoon shifts the original seed data happened to
#  use — maps onto this grid.
# ──────────────────────────────────────────────
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

DAY_BLOCKS: list[tuple[int, int]] = [
    (450,  540),    # 7:30 - 9:00
    (540,  630),    # 9:00 - 10:30
    (630,  720),    # 10:30 - 12:00
    (720,  810),    # 12:00 - 1:30
    (810,  900),    # 1:30 - 3:00
    (900,  990),    # 3:00 - 4:30
    (990,  1080),   # 4:30 - 6:00
    (1080, 1170),   # 6:00 - 7:30
    (1170, 1260),   # 7:30 - 9:00 PM
]

# Flat list of (day_index, start_min, end_min) — the universal slot grid.
SLOT_GRID: list[tuple[int, int, int]] = [
    (day_idx, start, end)
    for day_idx in range(6)
    for (start, end) in DAY_BLOCKS
]


def _minutes_to_label(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h:02d}:{m:02d}"


def slot_label(slot_idx: int) -> tuple[str, str, str]:
    """slot index -> (day_name, start_label, end_label)"""
    day_idx, start, end = SLOT_GRID[slot_idx]
    return DAY_NAMES[day_idx], _minutes_to_label(start), _minutes_to_label(end)


# ──────────────────────────────────────────────
#  Real availability -> slot grid
# ──────────────────────────────────────────────
def _parse_clock(raw: str) -> int | None:
    """'08:00', '13:00:00', '9:00 AM' -> minutes since midnight, or None."""
    m = re.fullmatch(r"\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*", str(raw or ""))
    if not m:
        return None
    h = int(m.group(1))
    minute = int(m.group(2))
    mer = (m.group(3) or "").upper()
    if mer == "PM" and h < 12:
        h += 12
    if mer == "AM" and h == 12:
        h = 0
    if h > 23 or minute > 59:
        return None
    return h * 60 + minute


def _slot_range(time_start: str, time_end: str) -> tuple[int, int] | None:
    """A stored slot's time_start/time_end -> (start, end) in minutes.

    Nothing on this timetable happens before 7:30 AM, so an hour of 1-6 in a
    24h value can only be an afternoon/evening time that lost its "PM" (an
    older save stored e.g. 1:30 PM as "01:30") -- shift it back, mirroring
    the same fix applied on the frontend (AvailabilityUtils.slotRange).
    """
    def fix(t: int | None) -> int | None:
        return t + 12 * 60 if (t is not None and 60 <= t < 7 * 60) else t

    start = fix(_parse_clock(time_start))
    end   = fix(_parse_clock(time_end))
    if start is None or end is None or end <= start:
        return None
    return start, end


def build_faculty_slot_availability(
    raw_availability: dict[int, list[dict]],
) -> dict[int, set[int]]:
    """
    Convert each faculty's real availability rows into the set of global
    SLOT_GRID indices they're available for.

    raw_availability: {faculty_id: [{"day_indices": [0,2], "time_start":
        "09:00", "time_end": "13:30"}, ...], ...} -- i.e. AvailabilitySlot
        rows, one dict per stored slot.

    A grid block counts as available only when it's fully contained in the
    submitted range (a 9:00 AM-1:30 PM slot covers the 9:00-10:30,
    10:30-12:00 and 12:00-1:30 blocks, but not 7:30-9:00) -- the same rule
    the chairperson-facing UI uses, so what the solver sees matches what's
    shown on screen.
    """
    result: dict[int, set[int]] = {}
    for fid, rows in raw_availability.items():
        slots: set[int] = set()
        for row in rows:
            rng = _slot_range(row.get("time_start"), row.get("time_end"))
            if not rng:
                continue
            start, end = rng
            covered = [i for i, (_, s, e) in enumerate(SLOT_GRID) if s >= start and e <= end]
            for day_idx in row.get("day_indices") or []:
                for grid_idx in covered:
                    if SLOT_GRID[grid_idx][0] == day_idx:
                        slots.add(grid_idx)
        result[fid] = slots
    return result


# ──────────────────────────────────────────────
#  Misc helpers
# ──────────────────────────────────────────────
def _parse_preferred(raw: str) -> list[str]:
    if not isinstance(raw, str):
        return []
    return [c.strip().upper() for c in re.split(r"[,;|]+", raw) if c.strip()]


def _justification(frow: pd.Series, crow: pd.Series, rf_score: float,
                    day: str | None = None, start: str | None = None,
                    end: str | None = None,
                    fallback: bool = False, cross_dept: bool = False) -> str:
    name      = f"{frow['first_name']} {frow['last_name']}"
    code      = crow["course_code"]
    prefs     = _parse_preferred(frow.get("preferred_courses", ""))
    pref_note = f"{code} is in {name.split()[0]}'s preferred courses. " if code in prefs else ""
    spec_match, spec_reason = specialization_matches(frow, crow)
    if spec_match:
        spec_note = (
            f"Specialisation in {frow.get('specialization', 'N/A')} "
            f"matches {spec_reason}. "
        )
    else:
        spec_note = ""
    exp_note  = f"{int(frow.get('exp_years', 0) or 0)} yr(s) experience. "
    day_note  = f"Scheduled {day} {start}-{end}, within faculty's real availability. " if day else ""
    sc_note   = f"RF fitness: {rf_score:.0%}."
    fb_note   = ""
    if fallback:
        fb_note = FALLBACK_NOTE + " " + ((CROSS_DEPT_NOTE + " ") if cross_dept else "")
    return fb_note + pref_note + spec_note + exp_note + day_note + sc_note


FALLBACK_NOTE   = "Not on the qualification list for this course (fallback assignment)."
CROSS_DEPT_NOTE = "Covered from another department."

# False: when same-department faculty run out, faculty from the other
#        department may cover the remaining sections (lowest priority).
# True : fallback stays inside the section's own department.
RESTRICT_FALLBACK_TO_DEPARTMENT = False


def _dept_code(text) -> str:
    """Normalise a department name ('Department of Information Technology')
    or program code ('BSIT') to a short track code: 'IT' | 'CS' | 'IS' | ''."""
    t = str(text or "").strip().upper()
    if not t:
        return ""
    if "INFORMATION TECHNOLOGY" in t:
        return "IT"
    if "COMPUTER SCIENCE" in t:
        return "CS"
    if "INFORMATION SYSTEM" in t:
        return "IS"
    if t.startswith("BS"):
        t = t[2:]
    return t if t in ("IT", "CS", "IS") else ""


def _faculty_dept_map(faculty_df: pd.DataFrame) -> dict[int, str]:
    if "department" not in faculty_df.columns:
        return {}
    return {int(r["faculty_id"]): _dept_code(r["department"]) for _, r in faculty_df.iterrows()}


def _same_department(fac_dept: dict[int, str], fid: int, section_program: str) -> bool:
    """True if the faculty may cover a section of this program as fallback.
    Unknown department on either side never blocks an assignment."""
    sec = _dept_code(section_program)
    fac = fac_dept.get(fid, "")
    return not sec or not fac or sec == fac


def _candidate_faculty_for_course(
    course_id: int,
    qualified_by_course: dict[int, set[int]],
    all_faculty_ids: list[int],
    section_program: str = "",
    fac_dept: dict[int, str] | None = None,
) -> tuple[set[int], set[int], set[int]]:
    """Returns (qualified, same_dept_fallback, other_dept_fallback) for a section.

    `qualified`           eligible faculty formally qualified for the course.
    `same_dept_fallback`  other eligible faculty in the section's department.
    `other_dept_fallback` everyone else (empty if
                          RESTRICT_FALLBACK_TO_DEPARTMENT is True).
    All three are candidates, so a section isn't left empty just because the
    better tiers ran out of units, but the solvers always prefer them in
    that order.
    """
    eligible  = set(all_faculty_ids)
    qualified = qualified_by_course.get(course_id, set()) & eligible
    fac_dept  = fac_dept or {}
    rest      = eligible - qualified
    same      = {f for f in rest if _same_department(fac_dept, f, section_program)}
    other     = set() if RESTRICT_FALLBACK_TO_DEPARTMENT else rest - same
    return qualified, same, other


def _build_assignment_row(fid, sid, srow, crow, frow, units, scores,
                          fallback: bool = False, cross_dept: bool = False) -> dict:
    """Stage 1 output: who teaches what, no day/time yet."""
    sc = scores.get(fid, {}).get(sid, 0.0)
    return {
        "faculty_id":      fid,
        "faculty_name":    f"{frow['first_name']} {frow['last_name']}",
        "section_id":      sid,
        "section_name":    srow["section_name"],
        "course_id":       int(srow["course_id"]),
        "course_code":     crow["course_code"],
        "course_title":    crow["course_title"],
        "program_code":    srow.get("program_code", ""),
        "units":           units,
        "employment_type": frow.get("employment_type", "Full Time"),
        "max_units":       int(frow.get("max_units", 21) or 21),
        "rf_score":        round(sc * 100, 1),
        "justification":   _justification(frow, crow, sc, fallback=fallback,
                                         cross_dept=cross_dept),
        "is_fallback":     fallback,
        "is_cross_dept":   cross_dept,
    }


def _finalize_row(assignment_row: dict, slot_idx: int, load_after: int,
                   frow: pd.Series, crow: pd.Series, scores) -> dict:
    day, start, end = slot_label(slot_idx)
    sc = scores.get(assignment_row["faculty_id"], {}).get(assignment_row["section_id"], 0.0)
    row = dict(assignment_row)
    row.update({
        "day":           day,
        "time_start":    start,
        "time_end":      end,
        "room_id":       0,   # rooms deferred
        "load":          load_after,
        "justification": _justification(
            frow, crow, sc, day, start, end,
            fallback=FALLBACK_NOTE in (assignment_row.get("justification") or ""),
            cross_dept=CROSS_DEPT_NOTE in (assignment_row.get("justification") or "")),
    })
    return row


# ──────────────────────────────────────────────
#  STAGE 1 — Faculty Assignment (RF-scored)
# ──────────────────────────────────────────────
def _greedy_faculty_assignment(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
    qualified_by_course: dict[int, set[int]],
    eligible_fids: set[int],
) -> List[dict]:
    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")
    sec_by_id  = {int(r["section_id"]): r for _, r in sections_df.iterrows()}

    load_used: dict[int, int] = {fid: 0 for fid in eligible_fids}
    fac_dept = _faculty_dept_map(faculty_df)

    # (tier, score, fid, sid) with tier 2 = qualified, 1 = same-department
    # fallback, 0 = other-department fallback. Sorting descending means every
    # better tier is tried before any worse one.
    scored_pairs: list[tuple[int, float, int, int]] = []
    for sid, srow in sec_by_id.items():
        cid = int(srow["course_id"])
        qualified, same, other = _candidate_faculty_for_course(
            cid, qualified_by_course, list(eligible_fids),
            str(srow.get("program_code", "") or ""), fac_dept)
        for tier, group in ((2, qualified), (1, same), (0, other)):
            for fid in group:
                scored_pairs.append((tier, scores.get(fid, {}).get(sid, 0.0), fid, sid))
    scored_pairs.sort(reverse=True)

    assigned_section: set[int] = set()
    results: list[dict] = []

    for tier, sc, fid, sid in scored_pairs:
        if sid in assigned_section:
            continue
        srow  = sec_by_id[sid]
        cid   = int(srow["course_id"])
        units = int(course_idx.loc[cid]["units"]) if cid in course_idx.index else 3

        frow  = fac_idx.loc[fid]
        max_u = int(frow.get("max_units", 21) or 21)
        if load_used[fid] + units > max_u:
            continue

        load_used[fid] += units
        assigned_section.add(sid)

        crow = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course"
        })
        results.append(_build_assignment_row(fid, sid, srow, crow, frow, units, scores,
                                             fallback=tier < 2, cross_dept=tier == 0))

    return results


def solve_faculty_assignment(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
    qualified_by_course: dict[int, set[int]],
    faculty_slots: dict[int, set[int]],
) -> tuple[List[dict], str]:
    """
    STAGE 1. Decides which faculty teaches which section — maximising RF
    score, not touching time at all. Returns (rows, mode) where mode is
    "CP-SAT" or "Greedy".

    Only faculty who submitted at least one real availability slot this
    semester (faculty_slots) are eligible: assigning a course to someone
    with zero availability would just be an unschedulable pair handed to
    stage 2, so the eligibility check happens once, here.
    """
    # Availability can exist for ids that are not faculty accounts (e.g. a
    # chairperson/demo row that received a slot from an availability CSV).
    # Those ids are not in faculty_df, so they must never be candidates.
    known_fids    = {int(f) for f in faculty_df["faculty_id"]}
    eligible_fids = {fid for fid, slots in faculty_slots.items()
                     if slots and fid in known_fids}

    if not ORTOOLS_AVAILABLE:
        return (_greedy_faculty_assignment(faculty_df, sections_df, courses_df,
                                            scores, qualified_by_course, eligible_fids),
                "Greedy")

    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")
    sec_by_id  = {int(r["section_id"]): r for _, r in sections_df.iterrows()}
    section_ids = list(sec_by_id.keys())

    sec_units: dict[int, int] = {}
    sec_course: dict[int, int] = {}
    for sid, srow in sec_by_id.items():
        cid = int(srow["course_id"])
        sec_course[sid] = cid
        sec_units[sid]  = int(course_idx.loc[cid]["units"]) if cid in course_idx.index else 3

    model = cp_model.CpModel()
    SCALE = 10_000

    # x[(fid, sid)] = 1 iff faculty fid is assigned section sid.
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    tier_of: dict[tuple[int, int], int] = {}   # 2 qualified, 1 same-dept, 0 other-dept
    by_section: dict[int, list] = {sid: [] for sid in section_ids}
    by_faculty: dict[int, list[tuple[int, int]]] = {}

    fac_dept = _faculty_dept_map(faculty_df)

    # Qualified faculty plus same-department and (unless restricted)
    # other-department fallback faculty are candidates. They're preferred in
    # that order through the objective below.
    for sid, srow in sec_by_id.items():
        cid = sec_course[sid]
        qualified, same, other = _candidate_faculty_for_course(
            cid, qualified_by_course, list(eligible_fids),
            str(srow.get("program_code", "") or ""), fac_dept)
        for fid, tier in ([(f, 2) for f in qualified] + [(f, 1) for f in same]
                          + [(f, 0) for f in other]):
            var = model.NewBoolVar(f"x_{fid}_{sid}")
            x[(fid, sid)] = var
            tier_of[(fid, sid)] = tier
            by_section[sid].append(var)
            by_faculty.setdefault(fid, []).append((sid, var))

    # ── H1: each section assigned to at most one faculty ──
    for sid in section_ids:
        if by_section[sid]:
            model.AddAtMostOne(by_section[sid])

    # ── H2: load limit per faculty ──
    for fid, pairs in by_faculty.items():
        frow  = fac_idx.loc[fid]
        max_u = int(frow.get("max_units", 21) or 21)
        terms = [var * sec_units[sid] for sid, var in pairs]
        if terms:
            model.Add(sum(terms) <= max_u)

    # ── Objective: coverage first, then qualification, then RF score ──
    #   qualified pair          : 2.0 + (RF score + preference bonus) -> 2.0 .. 3.1
    #   same-dept fallback pair : 1.0 + 0.5  * RF score               -> 1.0 .. 1.5
    #   other-dept fallback pair: 0.5 + 0.25 * RF score               -> 0.5 .. 0.75
    #   unassigned              : 0
    # Every assignment is worth more than leaving a section empty, and each
    # tier always beats the one below it, so fallback faculty are only used
    # where the better tiers are genuinely out of capacity.
    obj = []
    for (fid, sid), var in x.items():
        frow  = fac_idx.loc[fid]
        cid   = sec_course[sid]
        code  = course_idx.loc[cid]["course_code"] if cid in course_idx.index else ""
        prefs = _parse_preferred(frow.get("preferred_courses", ""))
        raw   = scores.get(fid, {}).get(sid, 0.0)
        tier = tier_of[(fid, sid)]
        if tier == 2:
            bonus  = 0.10 if code in prefs else 0.0
            weight = 2.0 + raw + bonus
        elif tier == 1:
            weight = 1.0 + 0.5 * raw
        else:
            weight = 0.5 + 0.25 * raw
        obj.append(var * int(weight * SCALE))

    if obj:
        model.Maximize(sum(obj))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20.0
    solver.parameters.num_search_workers  = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return (_greedy_faculty_assignment(faculty_df, sections_df, courses_df,
                                            scores, qualified_by_course, eligible_fids),
                "Greedy")

    results = []
    for (fid, sid), var in x.items():
        if solver.Value(var) != 1:
            continue
        srow  = sec_by_id[sid]
        cid   = sec_course[sid]
        crow  = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course"
        })
        units = sec_units[sid]
        frow  = fac_idx.loc[fid]
        results.append(_build_assignment_row(fid, sid, srow, crow, frow, units, scores,
                                             fallback=tier_of[(fid, sid)] < 2,
                                             cross_dept=tier_of[(fid, sid)] == 0))

    return results, "CP-SAT"


# ──────────────────────────────────────────────
#  STAGE 2 — Timetable Generation (slot placement)
# ──────────────────────────────────────────────
def _greedy_timetable(
    assignment_rows: List[dict],
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    faculty_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
    faculty_slots: dict[int, set[int]],
) -> tuple[List[dict], List[dict]]:
    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")
    sec_by_id  = {int(r["section_id"]): r for _, r in sections_df.iterrows()}

    load_used:      dict[int, int]      = {}
    faculty_booked: dict[int, set[int]] = {}
    cohort_booked:  dict[str, set[int]] = {}

    ordered = sorted(assignment_rows, key=lambda r: -r["rf_score"])

    scheduled, unscheduled = [], []
    for arow in ordered:
        fid, sid = arow["faculty_id"], arow["section_id"]
        srow  = sec_by_id[sid]
        cname = srow["section_name"]
        cid   = int(srow["course_id"])
        crow  = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course"
        })
        frow  = fac_idx.loc[fid]

        cohort_used = cohort_booked.setdefault(cname, set())
        f_booked    = faculty_booked.setdefault(fid, set())
        free_slots  = faculty_slots.get(fid, set()) - f_booked - cohort_used
        if not free_slots:
            unscheduled.append(arow)
            continue

        slot_idx = min(free_slots)
        f_booked.add(slot_idx)
        cohort_used.add(slot_idx)
        load_used[fid] = load_used.get(fid, 0) + arow["units"]

        scheduled.append(_finalize_row(arow, slot_idx, load_used[fid], frow, crow, scores))

    return scheduled, unscheduled


def solve_timetable(
    assignment_rows: List[dict],
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    faculty_df: pd.DataFrame,
    scores: Dict[int, Dict[int, float]],
    faculty_slots: dict[int, set[int]],
) -> tuple[List[dict], List[dict], str]:
    """
    STAGE 2. Takes STAGE 1's fixed (faculty, section) pairs and decides a
    real (day, time slot) for each -- it does not touch who's assigned to
    what. Returns (scheduled_rows, unscheduled_rows, mode).

    A pair with no feasible slot (every slot its faculty is available for
    already used by their other offerings, or a cohort clash) is returned
    in unscheduled_rows rather than silently dropped.
    """
    if not assignment_rows:
        return [], [], ("CP-SAT" if ORTOOLS_AVAILABLE else "Greedy")

    if not ORTOOLS_AVAILABLE:
        return (*_greedy_timetable(assignment_rows, sections_df, courses_df,
                                    faculty_df, scores, faculty_slots), "Greedy")

    fac_idx      = faculty_df.set_index("faculty_id")
    course_idx   = courses_df.set_index("course_id")
    sec_by_id    = {int(r["section_id"]): r for _, r in sections_df.iterrows()}
    arow_by_pair = {(r["faculty_id"], r["section_id"]): r for r in assignment_rows}

    model = cp_model.CpModel()

    # z[(fid, sid, slot_idx)] = 1 iff this stage-1 pair is placed at slot_idx.
    # Only created for slots the faculty is actually available for (H3).
    z: dict[tuple[int, int, int], cp_model.IntVar] = {}
    by_pair:    dict[tuple[int, int], list]              = {}
    by_faculty_slot: dict[tuple[int, int], list]         = {}
    by_cohort_slot:  dict[tuple[str, int], list]         = {}

    for arow in assignment_rows:
        fid, sid = arow["faculty_id"], arow["section_id"]
        cname = sec_by_id[sid]["section_name"]
        for slot_idx in faculty_slots.get(fid, set()):
            var = model.NewBoolVar(f"z_{fid}_{sid}_{slot_idx}")
            z[(fid, sid, slot_idx)] = var
            by_pair.setdefault((fid, sid), []).append(var)
            by_faculty_slot.setdefault((fid, slot_idx), []).append(var)
            by_cohort_slot.setdefault((cname, slot_idx), []).append(var)

    # ── each pair placed at most once (some pairs may end up unschedulable) ──
    for pair_vars in by_pair.values():
        if pair_vars:
            model.AddAtMostOne(pair_vars)

    # ── H4: no faculty double-booking ──
    for group in by_faculty_slot.values():
        if len(group) > 1:
            model.AddAtMostOne(group)

    # ── H5: no cohort double-booking ──
    for group in by_cohort_slot.values():
        if len(group) > 1:
            model.AddAtMostOne(group)

    # ── Objective: maximise pairs placed (coverage); break ties toward
    #    placing the higher-RF-score pairs when there's slack to choose ──
    obj = []
    for (fid, sid, slot_idx), var in z.items():
        weight = 1000 + int(arow_by_pair[(fid, sid)]["rf_score"])
        obj.append(var * weight)

    if obj:
        model.Maximize(sum(obj))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20.0
    solver.parameters.num_search_workers  = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return (*_greedy_timetable(assignment_rows, sections_df, courses_df,
                                    faculty_df, scores, faculty_slots), "Greedy")

    placed_pairs: set[tuple[int, int]] = set()
    load_used: dict[int, int] = {}
    scheduled: list[dict] = []

    for (fid, sid, slot_idx), var in z.items():
        if solver.Value(var) != 1:
            continue
        arow = arow_by_pair[(fid, sid)]
        cid  = int(sec_by_id[sid]["course_id"])
        crow = course_idx.loc[cid] if cid in course_idx.index else pd.Series({
            "course_code": "UNKN", "course_title": "Unknown Course"
        })
        frow = fac_idx.loc[fid]
        load_used[fid] = load_used.get(fid, 0) + arow["units"]
        scheduled.append(_finalize_row(arow, slot_idx, load_used[fid], frow, crow, scores))
        placed_pairs.add((fid, sid))

    unscheduled = [r for r in assignment_rows
                   if (r["faculty_id"], r["section_id"]) not in placed_pairs]

    return scheduled, unscheduled, "CP-SAT"
