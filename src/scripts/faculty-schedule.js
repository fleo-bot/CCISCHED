'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Populate print header (hidden on screen, visible in print) ──
const printFacultyName = document.getElementById('printFacultyName');
if (printFacultyName) {
  // You can get this from session storage or API
  printFacultyName.textContent = 'Maria Santos';
}

const printSemester = document.getElementById('printSemester');
if (printSemester) {
  printSemester.textContent = '1st Semester, A.Y. 2025–2026';
}

// ── Notification bell ──
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  SCHEDULE DATA
// ─────────────────────────────────────────────

// Time columns shown across the top (label only — display string)
const TIME_COLS = [
  '7:30 - 9:00',
  '9:00 - 10:30',
  '10:30 - 12:00',
  '12:00 - 1:30',
  '1:30 - 3:30',
  '3:00 - 4:30',
  '4:30 - 6:00',
  '6:00 - 7:30',
  '7:30 - 9:00',
];

// Days shown as row labels
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Teaching assignments.
 * Each entry targets a specific day + time column index (0-based).
 * highlight: true  → blue border (e.g. "current" block)
 *
 * Indices correspond to TIME_COLS above:
 *   0 = 7:30-9:00  | 1 = 9:00-10:30  | 2 = 10:30-12:00
 *   3 = 12:00-1:30 | 4 = 1:30-3:30   | 5 = 3:00-4:30
 *   6 = 4:30-6:00  | 7 = 6:00-7:30   | 8 = 7:30-9:00 PM
 */
const SCHEDULE = [
  // Monday
  { day: 'Monday',    col: 0, code: 'COMP 016', name: 'Web Development', section: 'BSIT 3-3', type: 'Laboratory' },
  { day: 'Monday',    col: 5, code: 'COMP 016', name: 'Web Development', section: 'BSIT 3-2', type: 'Laboratory' },

  // Tuesday
  { day: 'Tuesday',   col: 2, code: 'INTE 303', name: 'Capstone 1',      section: 'BSIT 3-1', type: 'Lecture' },

  // Wednesday
  { day: 'Wednesday', col: 0, code: 'COMP 016', name: 'Web Development', section: 'BSIT 3-3', type: 'Laboratory' },
  { day: 'Wednesday', col: 5, code: 'COMP 016', name: 'Web Development', section: 'BSIT 3-2', type: 'Laboratory' },

  // Thursday  — highlighted
  { day: 'Thursday',  col: 2, code: 'INTE 303', name: 'Capstone 1',      section: 'BSIT 3-1', type: 'Lecture', highlight: true },

  // Friday
  { day: 'Friday',    col: 0, code: 'COMP 017', name: 'Multimedia',      section: 'BSIT 3-3', type: 'Lecture' },
  { day: 'Friday',    col: 5, code: 'COMP 017', name: 'Multimedia',      section: 'BSIT 3-2', type: 'Lecture' },
];

// ─────────────────────────────────────────────
//  BUILD TABLE
// ─────────────────────────────────────────────

// Build a lookup map:  "Day-colIndex" → entry
const schedMap = {};
SCHEDULE.forEach(entry => {
  schedMap[`${entry.day}-${entry.col}`] = entry;
});

// ── Header row ──
const thead = document.getElementById('schedHead');
if (thead) {
  // Empty corner cell
  const thDay = document.createElement('th');
  thDay.className = 'th-day';
  thead.appendChild(thDay);

  TIME_COLS.forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    thead.appendChild(th);
  });
}

// ── Body rows ──
const tbody = document.getElementById('schedBody');
if (tbody) {
  DAYS.forEach(day => {
    const tr = document.createElement('tr');

    // Day label cell
    const tdDay = document.createElement('td');
    tdDay.className = 'td-day';
    tdDay.textContent = day;
    tr.appendChild(tdDay);

    // Time slot cells
    TIME_COLS.forEach((_, colIdx) => {
      const td = document.createElement('td');
      td.className = 'td-slot';

      const entry = schedMap[`${day}-${colIdx}`];
      if (entry) {
        const block = document.createElement('div');
        const typeClass = entry.type === 'Lecture' ? ' sched-block--lecture' : ' sched-block--laboratory';
        block.className = 'sched-block' + typeClass + (entry.highlight ? ' sched-block--highlight' : '');
        block.setAttribute('title', `${entry.code}: ${entry.name} — ${entry.section} (${entry.type})`);
        block.innerHTML = `
          <span class="sched-block__code">${entry.code}:</span>
          <span class="sched-block__name">${entry.name}</span>
          <span class="sched-block__section">${entry.section}</span>
          <span class="sched-block__type">${entry.type}</span>
        `;
        td.appendChild(block);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
//  EXPORT PDF  — clean print window (no browser headers/footers)
// ─────────────────────────────────────────────
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  const schedCardHTML = document.querySelector('.sched-card').outerHTML;
  const toolbarHTML   = document.querySelector('.sched-toolbar').outerHTML;

  // Inline both stylesheets so the popup is self-contained
  const styleHref1 = '../styles/faculty-dashboard.css';
  const styleHref2 = '../styles/faculty-schedule.css';

  const win = window.open('', '_blank', 'width=1100,height=800');
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title></title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="${styleHref1}"/>
  <link rel="stylesheet" href="${styleHref2}"/>
  <style>
    @page { margin: 1cm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Raleway', sans-serif; background: #fff; padding: 16px; }

    /* Toolbar — clean black & white */
    .sched-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1.5px solid #333;
      margin-bottom: 14px;
    }
    .sched-toolbar__info,
    .sched-toolbar__name {
      border: 1.5px solid #333 !important;
      box-shadow: none !important;
      background: #fff !important;
    }
    .sched-toolbar__label { color: #111 !important; }
    .sched-toolbar__sub   { color: #555 !important; }
    .sched-toolbar__name span { color: #111 !important; }
    .sched-export-btn { display: none !important; }

    /* Card */
    .sched-card { box-shadow: none; border: 1px solid #ccc; }

    /* Blocks — black & white */
    .sched-block--laboratory,
    .sched-block--lecture {
      background: #f5f5f5 !important;
      border: 1.5px solid #555 !important;
    }
    .sched-block--laboratory .sched-block__code,
    .sched-block--laboratory .sched-block__name,
    .sched-block--lecture .sched-block__code,
    .sched-block--lecture .sched-block__name { color: #111 !important; }
    .sched-block--laboratory .sched-block__section,
    .sched-block--laboratory .sched-block__type,
    .sched-block--lecture .sched-block__section,
    .sched-block--lecture .sched-block__type { color: #444 !important; }

    /* Table */
    .sched-table th {
      color: #111 !important;
      border-bottom: 2px solid #aaa !important;
      border-right: 1px solid #ccc !important;
    }
    .sched-table td.td-day {
      color: #111 !important;
      border-right: 2px solid #aaa !important;
    }
    .sched-table tbody tr { border-bottom: 1px solid #ccc !important; }
    .sched-table td.td-slot {
      border-right: 1px solid #ccc !important;
      background-image:
        linear-gradient(rgba(0,0,0,0.20) 50%, transparent 50%),
        linear-gradient(rgba(0,0,0,0.20) 50%, transparent 50%) !important;
      background-size: 1px 6px, 1px 6px !important;
      background-repeat: repeat-y, repeat-y !important;
      background-position: calc(50% - 22px) 0, calc(50% + 22px) 0 !important;
    }
  </style>
</head>
<body>
  ${toolbarHTML}
  ${schedCardHTML}
  <script>
    // Wait for fonts then print
    document.fonts.ready.then(() => {
      window.print();
      window.onafterprint = () => window.close();
    });
  <\/script>
</body>
</html>`);
  win.document.close();
});
