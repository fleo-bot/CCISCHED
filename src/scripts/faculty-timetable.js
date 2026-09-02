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
  printSemester.textContent = `${semParam}, A.Y. ${ayParam}`;
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
//  EXPORT PDF  — same self-contained popup as faculty/schedule.html
// ─────────────────────────────────────────────
document.getElementById('exportIndividualBtn')?.addEventListener('click', () => {
  const schedCardHTML = document.querySelector('.ft-card').outerHTML;

  const pupLogoURL = new URL('../assets/images/pup-seal.png', window.location.href).href;
  const cciLogoURL = new URL('../assets/images/cci-seal.png', window.location.href).href;

  const displayFaculty = facultyName;
  const displaySemester = `${semParam}, A.Y. ${ayParam}`;

  const win = window.open('', '_blank', 'width=1200,height=900');
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Teaching Assignment</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    @page { size: landscape; margin: 1cm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body { font-family: 'Raleway', sans-serif; background: #fff; margin: 0; padding: 16px; }

    /* ── Print header ── */
    .print-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    .print-header__row1 {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .print-header__logos {
      display: flex;
      flex-direction: row;
      gap: 6px;
      flex-shrink: 0;
      align-items: center;
    }
    .print-header__logo { width: 56px; height: 56px; }
    .print-header__text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .print-header__university {
      font-size: 13px; font-weight: 700; color: #000; margin: 0;
      letter-spacing: 0.01em; font-family: 'Raleway', sans-serif;
    }
    .print-header__office {
      font-size: 10px; font-weight: 400; color: #000; margin: 0;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__college {
      font-size: 12px; font-weight: 700; color: #000; margin: 3px 0 0 0;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__faculty-box {
      flex-shrink: 0; width: 190px; min-height: 56px;
      border: 2px solid #000; display: flex;
      align-items: center; justify-content: center; padding: 8px 12px;
    }
    .print-header__faculty-box span {
      font-size: 16px; font-weight: 700; color: #000;
      text-align: center; font-family: 'Raleway', sans-serif;
    }
    .print-header__row2 {
      display: flex; flex-direction: column;
      align-items: center; gap: 1px; width: 100%;
    }
    .print-header__title {
      font-size: 13px; font-weight: 700; color: #000; margin: 0;
      letter-spacing: 0.05em; text-align: center; font-family: 'Raleway', sans-serif;
    }
    .print-header__semester {
      font-size: 12px; font-weight: 700; color: #000; margin: 0;
      text-align: center; font-family: 'Raleway', sans-serif;
    }

    /* ── Table card ── */
    .ft-card { box-shadow: none; border: 1px solid #ccc; overflow: hidden; border-radius: 8px; }
    .ft-table-wrap { overflow-x: auto; width: 100%; }
    .ft-table {
      width: 100%; border-collapse: collapse;
      font-family: 'Raleway', Arial, sans-serif; min-width: 700px;
    }
    .ft-table th {
      padding: 10px 6px; font-size: 0.65rem; font-weight: 900;
      letter-spacing: 0.08em; color: #111; text-align: center;
      border-bottom: 2px solid #aaa; border-right: 1px solid #ccc;
      white-space: nowrap; background: #fff;
    }
    .ft-table th:last-child { border-right: none; }
    .ft-table th.th-day {
      width: 110px; text-align: left; padding-left: 16px;
      color: #111; font-size: 0.68rem;
    }
    .ft-table tbody tr { border-bottom: 1px solid #ccc; }
    .ft-table tbody tr:last-child { border-bottom: none; }
    .ft-table td.td-day {
      padding: 0 8px 0 16px; font-size: 0.80rem; font-weight: 800;
      color: #111; text-align: left; white-space: nowrap;
      background: #fff; border-right: 2px solid #aaa;
      height: 80px; vertical-align: middle;
    }
    .ft-table td.td-slot {
      padding: 6px 4px; text-align: center; vertical-align: middle;
      height: 80px; border-right: 1px solid #ccc;
      background-image:
        linear-gradient(rgba(0,0,0,0.18) 50%, transparent 50%),
        linear-gradient(rgba(0,0,0,0.18) 50%, transparent 50%);
      background-size: 1px 6px, 1px 6px;
      background-repeat: repeat-y, repeat-y;
      background-position: calc(50% - 22px) 0, calc(50% + 22px) 0;
    }
    .ft-table td.td-slot:last-child { border-right: none; }

    /* Blocks */
    .ft-block {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 1px; padding: 6px 4px;
      border-radius: 6px; background: #f5f5f5; border: 1.5px solid #555;
      height: 100%; min-height: 66px; box-sizing: border-box;
      position: relative; z-index: 1;
    }
    .ft-block__code  { font-size: 0.65rem; font-weight: 900; letter-spacing: 0.04em; text-align: center; line-height: 1.2; color: #111; }
    .ft-block__name  { font-size: 0.63rem; font-weight: 700; text-align: center; line-height: 1.3; color: #111; }
    .ft-block__section { font-size: 0.60rem; font-weight: 600; text-align: center; color: #444; }
    .ft-block__type  { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; color: #444; }
  </style>
</head>
<body>

  <div class="print-header">
    <div class="print-header__row1">
      <div class="print-header__logos">
        <img src="${pupLogoURL}" alt="PUP Seal" class="print-header__logo">
        <img src="${cciLogoURL}" alt="CCI Seal" class="print-header__logo">
      </div>
      <div class="print-header__text">
        <p class="print-header__university">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</p>
        <p class="print-header__office">Office of the Vice President for Academic Affairs</p>
        <p class="print-header__college">COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
      </div>
      <div class="print-header__faculty-box">
        <span>${displayFaculty}</span>
      </div>
    </div>
    <div class="print-header__row2">
      <p class="print-header__title">TEACHING ASSIGNMENT</p>
      <p class="print-header__semester">${displaySemester}</p>
    </div>
  </div>

  ${schedCardHTML}

  <script>
    document.fonts.ready.then(() => {
      window.print();
      window.onafterprint = () => window.close();
    });
  <\/script>
</body>
</html>`);
  win.document.close();
});

// ─────────────────────────────────────────────
//  BACK TO ASSIGNMENT LIST
// ─────────────────────────────────────────────
document.getElementById('backToListBtn')?.addEventListener('click', () => {
  window.location.href = backUrl;
});
