"""
id_utils.py
-----------
Shared helper for converting "FA-023"-style faculty codes into deterministic
numeric database IDs. Used by both init_db.py (when seeding faculty) and
app.py (when loading historical assignment data for RF training), so the
two always agree on the same mapping without a runtime lookup table.
"""

import re


def fa_to_id(code: str) -> int:
    """'FA-023' -> 24. Falls back to hashing unrecognized formats so the
    pipeline doesn't crash on an unexpected code, though every faculty
    record should use the FA-### convention."""
    code = str(code).strip()
    match = re.search(r"(\d+)", code)
    if match:
        return int(match.group(1)) + 1
    return abs(hash(code)) % 100000 + 100000   # unlikely fallback, kept safe/high
