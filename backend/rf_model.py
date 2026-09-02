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
6. emp_full          – 1 if Full Time, 0 if Part Time

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

# Specialisation → keywords that appear in course_code or course_title
SPEC_KEYWORDS: Dict[str, list[str]] = {
    "web development":         ["web", "it201", "it301", "it302", "hci", "multimedia", "it203"],
    "artificial intelligence": ["cs401", "machine learning", "ds401", "data science", "analytics"],
    "networks":                ["net201", "computer networks", "network"],
    "software engineering":    ["cs102", "cs103", "cs201", "cs202", "programming", "software"],
    "database systems":        ["db301", "it202", "database", "sql"],
    "data science":            ["ds401", "ds301", "ds101", "data mining", "data science", "analytics"],
    "computer science":        ["cs101", "cs102", "cs201", "cs301", "cs401", "computing"],
    "cybersecurity":           ["ias301", "security", "assurance"],
}


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

    kws = SPEC_KEYWORDS.get(spec, [])
    spec_match = float(any(kw in code.lower() or kw in title for kw in kws))

    exp      = float(faculty_row.get("exp_years", 0) or 0)
    exp_norm = min(exp / 25.0, 1.0)

    rank_score = RANK_WEIGHTS.get(
        str(faculty_row.get("academic_rank", "")).lower(), 0.40
    )
    educ_score = EDUC_WEIGHTS.get(
        str(faculty_row.get("highest_educ_attainment", "")).lower(), 0.40
    )
    emp_full = float(
        str(faculty_row.get("employment_type", "")).lower().startswith("full")
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
    hist.section_id holds the section_id (401-420).
    We look up the section → course → features.
    """
    fac_idx     = faculty_df.set_index("faculty_id")
    sec_idx     = sections_df.set_index("section_id")
    course_idx  = courses_df.set_index("course_id")

    X_pos, X_neg = [], []

    for _, row in hist_df.iterrows():
        fid = int(row["faculty_id"])
        sid = int(row["section_id"])

        if fid not in fac_idx.index or sid not in sec_idx.index:
            continue

        cid = int(sec_idx.loc[sid]["course_id"])
        if cid not in course_idx.index:
            continue

        frow = fac_idx.loc[fid]
        crow = course_idx.loc[cid]
        X_pos.append(_feature_vector(frow, crow))

        # Two synthetic negatives per positive
        neg_secs = sections_df[sections_df["section_id"] != sid].sample(
            min(2, len(sections_df) - 1), random_state=fid
        )
        for _, ns in neg_secs.iterrows():
            nc_id = int(ns["course_id"])
            if nc_id in course_idx.index:
                X_neg.append(_feature_vector(frow, course_idx.loc[nc_id]))

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
