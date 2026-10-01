"""Quick validation for the current faculty and course CSV data."""

from pathlib import Path
import pandas as pd
from rf_model import specialization_matches

DATA = Path(__file__).parent / "data"

faculty = pd.read_csv(DATA / "CCISched-Faculty.csv")
courses = pd.read_csv(DATA / "CCISched-Courses.csv")

faculty["specialization"] = faculty["specialization"].fillna("")

matched = 0
total = 0
by_spec = {}

for _, frow in faculty.iterrows():
    spec = frow["specialization"]
    spec_total = 0
    for _, crow in courses.iterrows():
        total += 1
        ok, _ = specialization_matches(frow, crow)
        if ok:
            matched += 1
            spec_total += 1
    by_spec[spec] = spec_total

print(f"Matched faculty/course pairs: {matched}/{total}")
for spec, count in sorted(by_spec.items()):
    print(f"{spec}: {count}")
