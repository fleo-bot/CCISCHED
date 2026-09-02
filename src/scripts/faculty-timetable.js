'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  URL PARAMS
// ─────────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const facultyName = decodeURIComponent(params.get('name') || 'Faculty Member');
const ayParam     = params.get('ay')  || 'A.Y. 2025–2026';
const semParam    = params.get('sem') || '1st Semester';

// Back-URL so the breadcrumb / back button return to the right page
const backUrl = params.get('from') || 'generated-timetables.html';

// ── Populate toolbar ──
const ftNamePill = document.getElementById('ftNamePill');
if (ftNamePill) {
  ftNamePill.innerHTML = `<span>${facultyName}</span>`;
}

const ftSemLabel = document.getElementById('ftSemLabel');
if (ftSemLabel) {
  // Shorten semester label: "1st Semester" → "1st Sem"
  const shortSem = semParam.replace('Semester', 'Sem').replace('semester', 'Sem');
  ftSemLabel.textContent = `${shortSem} · ${ayParam}`;
}

// ── Populate print header (hidden on screen, visible in print) ──
const printFacultyName = document.getElementById('printFacultyName');
if (printFacultyName) {
  printFacultyName.textContent = facultyName;
}

const printSemester = document.getElementById('printSemester');
if (printSemester) {
  const shortSem = semParam.replace('Semester', 'Sem').replace('semester', 'Sem');
  printSemester.textContent = `${shortSem}, ${ayParam}`;
}

// ── Breadcrumb back link ──
document.getElementById('breadcrumbBack')?.addEventListener('click', () => {
  window.location.href = backUrl;
});

// ─────────────────────────────────────────────
//  TIMETABLE DATA
//  Loaded from sessionStorage (written by the
//  chairperson-schedule.js API call).
//  Falls back to empty schedule when backend is off.
// ─────────────────────────────────────────────
const TIME_COLS = [
  '7:30 - 9:00',
  '9:00 - 10:30',
  '10:30 - 12:00',
  '12:00 - 1:30',
  '1:30 - 3:00',
  '3:00 - 4:30',
  '4:30 - 6:00',
  '6:00 - 7:30',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Load API result from sessionStorage ──
let _apiTimetable = null;
try {
  const raw = sessionStorage.getItem('ccisched_result');
  if (raw) {
    const parsed = JSON.parse(raw);
    // timetable is keyed by faculty_id (number); convert to name-keyed map
    // for backwards compatibility with the SCHEDULES lookup below.
    const byId = parsed.timetable ?? {};
    _apiTimetable = {};

    // Build id→name map from faculty_data
    (parsed.faculty_data ?? []).forEach(f => {
      const blocks = byId[f.id] ?? byId[String(f.id)] ?? [];
      if (blocks.length) _apiTimetable[f.name] = blocks;
    });
  }
} catch (_) { /* ignore */ }

// Static fallback entries (shown when backend has not run yet)
const SCHEDULES_FALLBACK = {};

// Merge: API data takes priority, fallback fills gaps
const SCHEDULES = _apiTimetable && Object.keys(_apiTimetable).length
  ? _apiTimetable
  : SCHEDULES_FALLBACK;

// Fallback: empty schedule for unknown faculty
const schedule = SCHEDULES[facultyName] || [];

// ─────────────────────────────────────────────
//  BUILD TABLE
// ─────────────────────────────────────────────
const schedMap = {};
schedule.forEach(entry => {
  schedMap[`${entry.day}-${entry.col}`] = entry;
});

// Header
const thead = document.getElementById('ftHead');
if (thead) {
  const thDay = document.createElement('th');
  thDay.className = 'th-day';
  thead.appendChild(thDay);

  TIME_COLS.forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    thead.appendChild(th);
  });
}

// Body
const tbody = document.getElementById('ftBody');
if (tbody) {
  DAYS.forEach(day => {
    const tr = document.createElement('tr');

    const tdDay = document.createElement('td');
    tdDay.className = 'td-day';
    tdDay.textContent = day;
    tr.appendChild(tdDay);

    TIME_COLS.forEach((_, colIdx) => {
      const td = document.createElement('td');
      td.className = 'td-slot';

      const entry = schedMap[`${day}-${colIdx}`];
      if (entry) {
        const block = document.createElement('div');
        const typeClass = entry.type === 'Lecture' ? ' ft-block--lecture' : ' ft-block--laboratory';
        block.className = 'ft-block' + typeClass + (entry.highlight ? ' ft-block--highlight' : '');
        block.setAttribute('title', `${entry.code}: ${entry.name} — ${entry.section} (${entry.type || 'Laboratory'})`);
        block.innerHTML = `
          <span class="ft-block__code">${entry.code}:</span>
          <span class="ft-block__name">${entry.name}</span>
          <span class="ft-block__section">${entry.section}</span>
          <span class="ft-block__type">${entry.type || 'LABORATORY'}</span>
        `;
        td.appendChild(block);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
//  EXPORT INDIVIDUAL PDF
// ─────────────────────────────────────────────
document.getElementById('exportIndividualBtn')?.addEventListener('click', () => {
  window.print();
});

// ─────────────────────────────────────────────
//  BACK TO ASSIGNMENT LIST
// ─────────────────────────────────────────────
document.getElementById('backToListBtn')?.addEventListener('click', () => {
  window.location.href = backUrl;
});
