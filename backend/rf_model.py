"""
rf_model.py
-----------
Random Forest layer of the CCISched pipeline.

Responsibility: produce a score matrix
    scores[faculty_id][section_id]  ∈  [0.0, 1.0]
representing how suitable a faculty member is for each section.
The CP-SAT solver uses these as objective weights.

Feature engineering (6 features per pair)
──────────────────────────────────────────
1. preferred_match   – course code is in faculty.preferred_courses
2. spec_match        – specialisation keyword overlaps course title / code
3. exp_years_norm    – years of experience normalised to [0, 1]
4. rank_score        – numeric weight for academic rank
5. educ_score        – numeric weight for highest degree
6. emp_full          – 1 if Full Time / Permanent / Temporary, 0 if Part Time

Historical signal
─────────────────
The historical_assignments CSV has faculty_id and section_id columns.
section_id values (401-420) map directly to Sections.csv section_id values.
Each confirmed row is a positive training example (label = 1).
Balanced negatives are generated synthetically.

When < 4 positive examples exist the RF is skipped and the final
score equals the rule-based average (safe fallback).

Blend:  70 % RF probability  +  30 % rule-based score
"""

from __future__ import annotations

import warnings
import re
from typing import Dict

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────
#  Lookup tables
# ──────────────────────────────────────────────
RANK_WEIGHTS: Dict[str, float] = {
    "instructor i":           0.30,
    "instructor ii":          0.40,
    "instructor iii":         0.50,
    "assistant professor i":  0.60,
    "assistant professor ii": 0.65,
    "associate professor i":  0.75,
    "associate professor ii": 0.80,
    "professor i":            0.90,
    "professor ii":           0.95,
}

EDUC_WEIGHTS: Dict[str, float] = {
    "bs cs":  0.30, "bs it": 0.30,
    "mis":    0.45,
    "mit":    0.55,
    "ms cs":  0.65,
    "phd it": 0.85,
    "phd cs": 0.90,
}

# Specialisation -> terms found in the current CCISched curriculum.
#
# These are deliberately based on the course titles/codes in
# CCISched-Courses.csv instead of the old seed-data codes.  Code terms are
# matched exactly; title terms are matched as phrases.
SPEC_KEYWORDS: Dict[str, list[str]] = {
    "web and mobile application development": [
        "web development", "applications development",
        "integrative programming", "multimedia", "e-commerce",
        "m-commerce",
    ],
    "network administration": [
        "data communications and networking", "network administration",
        "wide area network", "network and enterprise protection",
        "switching and wireless network configuration",
    ],
    "machine learning": [
        "machine learning", "data mining", "introduction to data science",
        "natural language processing", "artificial intelligence",
        "introduction to artificial intelligence",
    ],
    "information assurance and security": [
        "information assurance and security", "cybersecurity",
        "cloud and virtualization security", "network and enterprise protection",
    ],
    "it project management": [
        "project management",
    ],
    "human-computer interaction": [
        "human computer interaction",
    ],
    "systems integration and architecture": [
        "systems integration and architecture", "integrative programming",
        "integrated software application",
    ],
    "database administration and architecture": [
        "database administration", "information management",
        "introduction to database management system",
    ],
    "software engineering": [
        "software engineering", "computer programming",
        "programming", "applications development",
        "integrated software application", "quality assurance",
    ],
    "computer architecture and organization": [
        "computer architecture and organization",
        "logic design and digital computer circuits",
        "computer organization and assembly language",
    ],
    "algorithm design and analysis": [
        "data structures and algorithms",
        "design and analysis of algorithms",
        "programming languages",
        "discrete structures",
    ],
    "artificial intelligence": [
        "artificial intelligence", "machine learning",
        "natural language processing", "data mining",
        "introduction to data science",
    ],
    "automata and computability": [
        "automata and language theory", "discrete structures",
        "logic design and digital computer circuits",
        "principles of programming languages",
    ],
    "data science and analytics": [
        "introduction to data science", "data mining",
        "machine learning", "r programming",
        "modeling and simulation",
    ],
    "theory of computation": [
        "automata and language theory", "discrete structures",
        "principles of programming languages",
    ],
    "enterprise systems": [
        "systems integration and architecture", "integrated software application",
        "information management", "enterprise systems",
    ],
}

# Backward compatible aliases for specialization values that may already be
# stored in older database rows.
SPEC_ALIASES: Dict[str, str] = {
    "web development": "web and mobile application development",
    "networks": "network administration",
    "cybersecurity": "information assurance and security",
    "database systems": "database administration and architecture",
    "data science": "data science and analytics",
    "computer science": "algorithm design and analysis",
}


def _normalise_specialization(raw: str) -> str:
    text = str(raw or "").strip().lower()
    return SPEC_ALIASES.get(text, text)


def _title_key(text: str) -> str:
    """Lower-case, collapse whitespace, and split a trailing digit from the
    word before it ('Security1' -> 'security 1') so near-identical course
    titles compare equal."""
    t = re.sub(r"\s+", " ", str(text or "").strip().lower())
    return re.sub(r"(?<=[a-z])(?=\d)", " ", t)


def _title_family(key: str) -> str:
    """'software engineering 2' -> 'software engineering'."""
    return re.sub(r"\s+\d+$", "", key)


def _course_title_specialization_match(spec: str, title: str) -> tuple[bool, str]:
    """Match a specialization that is itself a course title (the current
    faculty export lists e.g. 'Software Engineering 2' or 'Data Mining').
    Matches the same title, or another course in the same numbered family
    ('Software Engineering 1' / '... 2')."""
    spec_key, title_key = _title_key(spec), _title_key(title)
    if not spec_key or not title_key:
        return False, ""
    if spec_key == title_key:
        return True, f"course title {title.strip()}"
    family = _title_family(spec_key)
    if family and family == _title_family(title_key):
        return True, f"course family {family}"
    return False, ""


def specialization_matches(
    faculty_row: pd.Series, course_row: pd.Series
) -> tuple[bool, str]:
    """Return (matched, reason) for the faculty specialization/course pair."""
    spec = _normalise_specialization(faculty_row.get("specialization", ""))
    if not spec or spec == "nan":
        return False, ""

    code = re.sub(r"\s+", "", str(course_row.get("course_code", "")).strip().lower())
    title = re.sub(r"\s+", " ", str(course_row.get("course_title", "")).strip().lower())

    # Specializations that aren't one of the broad areas in SPEC_KEYWORDS are
    # treated as course titles.
    if spec not in SPEC_KEYWORDS:
        return _course_title_specialization_match(spec, title)

    for term in SPEC_KEYWORDS.get(spec, []):
        term_norm = re.sub(r"\s+", " ", term.strip().lower())
        # Current course codes are matched exactly. This prevents obsolete
        # codes such as "it201" from accidentally acting like title keywords.
        if re.fullmatch(r"[a-z]{2,6}\d{2,4}", term_norm):
            if code == term_norm:
                return True, f"course code {str(course_row.get('course_code', '')).strip()}"
        elif term_norm and term_norm in title:
            return True, term

    return False, ""


def _parse_preferred(raw: str) -> list[str]:
    """'DB301,GEED012,NET201' → ['DB301', 'GEED012', 'NET201']"""
    if not isinstance(raw, str):
        return []
    import re
    return [c.strip().upper() for c in re.split(r"[,;|]+", raw) if c.strip()]


def _feature_vector(faculty_row: pd.Series, course_row: pd.Series) -> list[float]:
    """Build the 6-element feature vector for one (faculty, course) pair."""
    code  = str(course_row["course_code"]).upper()
    title = str(course_row["course_title"]).lower()
    spec  = str(faculty_row.get("specialization", "")).lower()
    prefs = _parse_preferred(faculty_row.get("preferred_courses", ""))

    preferred_match = float(code in prefs)

    spec_match, _ = specialization_matches(faculty_row, course_row)
    spec_match = float(spec_match)

    exp      = float(faculty_row.get("exp_years", 0) or 0)
    exp_norm = min(exp / 25.0, 1.0)

    rank_score = RANK_WEIGHTS.get(
        str(faculty_row.get("academic_rank", "")).lower(), 0.40
    )
    educ_score = EDUC_WEIGHTS.get(
        str(faculty_row.get("highest_educ_attainment", "")).lower(), 0.40
    )
    emp_full = float(
        str(faculty_row.get("employment_type", "")).lower().startswith(
            ("full", "permanent", "temporary")
        )
    )

    return [preferred_match, spec_match, exp_norm, rank_score, educ_score, emp_full]


def _build_training_data(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    hist_df: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Each confirmed historical row → positive example (label=1).
    hist.course_code identifies the course directly (historical rows record
    cohort/section context too, but a "section" is now a student cohort
    that takes many courses, not a single course-offering — so we match
    training examples on course_code, not through a section lookup).
    """
    fac_idx    = faculty_df.set_index("faculty_id")
    course_idx = courses_df.set_index("course_id")
    code_to_id = courses_df.set_index("course_code")["course_id"].to_dict()

    X_pos, X_neg = [], []

    for _, row in hist_df.iterrows():
        fid  = int(row["faculty_id"])
        code = str(row.get("course_code", "")).strip()

        if fid not in fac_idx.index or code not in code_to_id:
            continue

        cid = code_to_id[code]
        if cid not in course_idx.index:
            continue

        frow = fac_idx.loc[fid]
        crow = course_idx.loc[cid]
        X_pos.append(_feature_vector(frow, crow))

        # Two synthetic negatives per positive — courses this faculty
        # historically did NOT teach
        neg_courses = courses_df[courses_df["course_id"] != cid].sample(
            min(2, len(courses_df) - 1), random_state=fid
        )
        for _, nc in neg_courses.iterrows():
            X_neg.append(_feature_vector(frow, nc))

    if not X_pos:
        return np.empty((0, 6)), np.empty(0)

    X = np.array(X_pos + X_neg, dtype=float)
    y = np.array([1] * len(X_pos) + [0] * len(X_neg), dtype=int)
    return X, y


def compute_scores(
    faculty_df: pd.DataFrame,
    sections_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    hist_df: pd.DataFrame,
) -> Dict[int, Dict[int, float]]:
    """
    Returns  scores[faculty_id][section_id] ∈ [0.0, 1.0].
    """
    fac_idx    = faculty_df.set_index("faculty_id")
    sec_idx    = sections_df.set_index("section_id")
    course_idx = courses_df.set_index("course_id")

    X_train, y_train = _build_training_data(
        faculty_df, sections_df, courses_df, hist_df
    )
    use_rf = len(X_train) >= 4 and len(np.unique(y_train)) == 2

    rf = None
    if use_rf:
        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=6,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
        )
        rf.fit(X_train, y_train)

    scores: Dict[int, Dict[int, float]] = {}

    for fid, frow in fac_idx.iterrows():
        scores[fid] = {}
        for sid, srow in sec_idx.iterrows():
            cid = int(srow["course_id"])
            if cid not in course_idx.index:
                scores[fid][sid] = 0.0
                continue

            crow  = course_idx.loc[cid]
            feats = _feature_vector(frow, crow)
            rule  = float(np.mean(feats))

            if rf is not None:
                arr     = np.array(feats, dtype=float).reshape(1, -1)
                rf_prob = float(rf.predict_proba(arr)[0][1])
                final   = 0.70 * rf_prob + 0.30 * rule
            else:
                final = rule

            scores[fid][sid] = round(final, 4)

    return scores
