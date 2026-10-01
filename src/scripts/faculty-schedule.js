'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Populate faculty name shown on this page (toolbar pill + hidden print
//    header) with the real logged-in user, once auth-check.js confirms it ──
function applyCurrentUserToPage(user) {
  if (!user) return;
  const fullName = `${user.first_name} ${user.last_name}`;

  const printFacultyName = document.getElementById('printFacultyName');
  if (printFacultyName) printFacultyName.textContent = fullName;

  const toolbarName = document.querySelector('.sched-toolbar__name span');
  if (toolbarName) toolbarName.textContent = fullName;
}

document.addEventListener('authReady', (e) => applyCurrentUserToPage(e.detail));
if (typeof currentUser !== 'undefined' && currentUser) applyCurrentUserToPage(currentUser);

const printSemester = document.getElementById('printSemester');
if (printSemester) {
  printSemester.textContent = '1st Semester, A.Y. 2025–2026';
}

// ── Notification bell ──
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  SCHEDULE DATA — fetched from API
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

let SCHEDULE = []; // Will be populated from API

// Helper: convert "07:30" to column index
function timeToColIndex(timeStart) {
  const timeMap = {
    '07:30': 0, '09:00': 1, '10:30': 2, '12:00': 3,
    '13:30': 4, '15:00': 5, '16:30': 6, '18:00': 7, '19:30': 8,
  };
  return timeMap[timeStart] ?? 0;
}

// Fetch schedule from API
async function loadSchedule() {
  try {
    const response = await API.getMySchedule();
    const scheduleEntries = response.schedule || [];
    
    // Convert API format to UI format
    SCHEDULE = scheduleEntries.map(entry => ({
      day: entry.day,
      col: timeToColIndex(entry.time_start),
      code: entry.course_code,
      name: entry.course_title,
      section: entry.section_name,
      type: entry.class_type,
      highlight: false, // Can add logic to highlight today's classes
    }));
    
    buildTable();
  } catch (err) {
    console.error('Failed to load schedule:', err);
    // Show empty table
    buildTable();
  }
}

// ─────────────────────────────────────────────
//  BUILD TABLE
// ─────────────────────────────────────────────
function buildTable() {
  // Build a lookup map:  "Day-colIndex" → entry
  const schedMap = {};
  SCHEDULE.forEach(entry => {
    schedMap[`${entry.day}-${entry.col}`] = entry;
  });

  // ── Header row ──
  const thead = document.getElementById('schedHead');
  if (thead) {
    thead.innerHTML = ''; // Clear existing
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
    tbody.innerHTML = ''; // Clear existing
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
}

// Init: load schedule from API
loadSchedule();

// ─────────────────────────────────────────────
//  EXPORT PDF  — clean print window (no browser headers/footers)
// ─────────────────────────────────────────────
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  const schedCardHTML = document.querySelector('.sched-card').outerHTML;

  // Grab live values for faculty name and semester
  const facultyName = document.getElementById('printFacultyName')?.textContent || '';
  const semester    = document.getElementById('printSemester')?.textContent    || '';

  // Resolve logo paths relative to the popup's about:blank origin
  const pupLogoURL = new URL('../assets/images/pup-seal.png', window.location.href).href;
  const cciLogoURL = new URL('../assets/images/cci-seal.png', window.location.href).href;

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

    /* Row 1: logos | text | faculty box */
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
    .print-header__logo {
      width: 56px;
      height: 56px;
    }
    .print-header__text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .print-header__university {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      margin: 0;
      letter-spacing: 0.01em;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__office {
      font-size: 10px;
      font-weight: 400;
      color: #000;
      margin: 0;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__college {
      font-size: 12px;
      font-weight: 700;
      color: #000;
      margin: 3px 0 0 0;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__faculty-box {
      flex-shrink: 0;
      width: 190px;
      min-height: 56px;
      border: 2px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
    }
    .print-header__faculty-box span {
      font-size: 16px;
      font-weight: 700;
      color: #000;
      text-align: center;
      font-family: 'Raleway', sans-serif;
    }

    /* Row 2: centered title + semester */
    .print-header__row2 {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      width: 100%;
    }
    .print-header__title {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      margin: 0;
      letter-spacing: 0.05em;
      text-align: center;
      font-family: 'Raleway', sans-serif;
    }
    .print-header__semester {
      font-size: 12px;
      font-weight: 700;
      color: #000;
      margin: 0;
      text-align: center;
      font-family: 'Raleway', sans-serif;
    }

    /* ── Schedule card & table ── */
    .sched-card { box-shadow: none; border: 1px solid #ccc; overflow: hidden; border-radius: 8px; }
    .sched-table-wrap { overflow-x: auto; width: 100%; }
    .sched-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Raleway', Arial, sans-serif;
      min-width: 700px;
    }
    .sched-table th {
      padding: 10px 6px;
      font-size: 0.65rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #111;
      text-align: center;
      border-bottom: 2px solid #aaa;
      border-right: 1px solid #ccc;
      white-space: nowrap;
      background: #fff;
    }
    .sched-table th:last-child { border-right: none; }
    .sched-table th.th-day {
      width: 110px;
      text-align: left;
      padding-left: 16px;
      color: #111;
      font-size: 0.68rem;
    }
    .sched-table tbody tr { border-bottom: 1px solid #ccc; }
    .sched-table tbody tr:last-child { border-bottom: none; }
    .sched-table td.td-day {
      padding: 0 8px 0 16px;
      font-size: 0.80rem;
      font-weight: 800;
      color: #111;
      text-align: left;
      white-space: nowrap;
      background: #fff;
      border-right: 2px solid #aaa;
      height: 80px;
      vertical-align: middle;
    }
    .sched-table td.td-slot {
      padding: 6px 4px;
      text-align: center;
      vertical-align: middle;
      height: 80px;
      border-right: 1px solid #ccc;
      background-image:
        linear-gradient(rgba(0,0,0,0.18) 50%, transparent 50%),
        linear-gradient(rgba(0,0,0,0.18) 50%, transparent 50%);
      background-size: 1px 6px, 1px 6px;
      background-repeat: repeat-y, repeat-y;
      background-position: calc(50% - 22px) 0, calc(50% + 22px) 0;
    }
    .sched-table td.td-slot:last-child { border-right: none; }

    /* Class blocks */
    .sched-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      padding: 6px 4px;
      border-radius: 6px;
      background: #f5f5f5;
      border: 1.5px solid #555;
      height: 100%;
      min-height: 66px;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
    }
    .sched-block__code  { font-size: 0.65rem; font-weight: 900; letter-spacing: 0.04em; text-align: center; line-height: 1.2; color: #111; }
    .sched-block__name  { font-size: 0.63rem; font-weight: 700; text-align: center; line-height: 1.3; color: #111; }
    .sched-block__section { font-size: 0.60rem; font-weight: 600; text-align: center; color: #444; }
    .sched-block__type  { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; color: #444; }
  </style>
</head>
<body>

  <!-- ── Header ── -->
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
        <span>${facultyName}</span>
      </div>
    </div>
    <div class="print-header__row2">
      <p class="print-header__title">TEACHING ASSIGNMENT</p>
      <p class="print-header__semester">${semester}</p>
    </div>
  </div>

  <!-- ── Schedule table ── -->
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
