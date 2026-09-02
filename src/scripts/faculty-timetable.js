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
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups and try again.');
    return;
  }

  const shortSem = semParam.replace('Semester', 'Sem').replace('semester', 'Sem');

  // Build table HTML for the print window
  const headerCells = TIME_COLS.map(t => `<th>${t}</th>`).join('');

  const bodyRows = DAYS.map(day => {
    const cells = TIME_COLS.map((_, colIdx) => {
      const entry = schedMap[`${day}-${colIdx}`];
      if (entry) {
        const typeClass = entry.type === 'Lecture' ? 'p-block--lecture' : 'p-block--laboratory';
        return `<td class="td-slot">
          <div class="p-block ${typeClass}">
            <span class="p-block__code">${entry.code}:</span>
            <span class="p-block__name">${entry.name}</span>
            <span class="p-block__section">${entry.section}</span>
            <span class="p-block__type">${entry.type || 'LABORATORY'}</span>
          </div>
        </td>`;
      }
      return '<td class="td-slot"></td>';
    }).join('');
    return `<tr><td class="td-day">${day}</td>${cells}</tr>`;
  }).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Timetable — ${facultyName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>
        @page { margin: 1cm; }
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body { 
          font-family: 'Raleway', 'Segoe UI', Arial, sans-serif; 
          color: #111; 
          background: #f5f5f5; 
          padding: 28px 32px; 
        }
        
        /* Toolbar with pills */
        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 16px;
        }
        
        .pill {
          display: inline-flex;
          flex-direction: column;
          padding: 11px 22px;
          background: #fff;
          border: 2px solid rgba(128, 0, 0, 0.35);
          border-radius: 50px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        
        .pill--assignment {
          min-width: 170px;
        }
        
        .pill__label {
          font-size: 0.72rem;
          font-weight: 800;
          color: #800000;
          line-height: 1.3;
        }
        
        .pill__sub {
          font-size: 0.62rem;
          font-weight: 600;
          color: #888;
          margin-top: 2px;
        }
        
        .pill--name {
          padding: 13px 32px;
        }
        
        .pill--name span {
          font-size: 1.05rem;
          font-weight: 900;
          color: #800000;
          letter-spacing: 0.01em;
        }
        
        .export-btn {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          background: #fff;
          border: 2px solid rgba(128, 0, 0, 0.35);
          border-radius: 50px;
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #800000;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        
        /* Table card */
        .table-card {
          background: #fff;
          border-radius: 12px;
          border: 2px solid rgba(128, 0, 0, 0.18);
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: 'Raleway', sans-serif;
          min-width: 700px;
        }
        
        thead tr { background: #fff; }
        
        th { 
          padding: 14px 8px;
          font-size: 0.66rem;
          font-weight: 900;
          letter-spacing: 0.09em;
          color: #800000;
          text-align: center;
          border-bottom: 2px solid rgba(128, 0, 0, 0.18);
          border-right: 1px solid rgba(128, 0, 0, 0.10);
          white-space: nowrap;
        }
        
        th:last-child { border-right: none; }
        
        th:first-child {
          width: 110px;
          text-align: left;
          padding-left: 20px;
          color: #111;
          font-size: 0.68rem;
        }
        
        tbody tr { border-bottom: 1px solid rgba(128, 0, 0, 0.10); }
        tbody tr:last-child { border-bottom: none; }
        
        td.td-day {
          padding: 0 8px 0 20px;
          font-size: 0.80rem;
          font-weight: 800;
          color: #800000;
          text-align: left;
          white-space: nowrap;
          background: #fff;
          border-right: 2px solid rgba(128, 0, 0, 0.18);
          height: 82px;
          vertical-align: middle;
        }
        
        td.td-slot {
          padding: 6px 4px;
          text-align: center;
          vertical-align: middle;
          height: 82px;
          position: relative;
          border-right: 1px solid rgba(128, 0, 0, 0.10);
          /* Dashed guide lines */
          background-image:
            linear-gradient(rgba(128, 0, 0, 0.28) 50%, transparent 50%),
            linear-gradient(rgba(128, 0, 0, 0.28) 50%, transparent 50%);
          background-size: 1px 6px, 1px 6px;
          background-repeat: repeat-y, repeat-y;
          background-position: calc(50% - 22px) 0, calc(50% + 22px) 0;
        }
        
        td.td-slot:last-child { border-right: none; }
        
        /* Class blocks */
        .p-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          padding: 6px 4px;
          border-radius: 8px;
          background: #F9EDED;
          border: 1.5px solid rgba(128, 0, 0, 0.22);
          height: 100%;
          min-height: 68px;
          box-sizing: border-box;
          position: relative;
          z-index: 1;
        }
        
        /* Laboratory → maroon tint */
        .p-block--laboratory {
          background: #F9EDED;
          border-color: rgba(128, 0, 0, 0.30);
        }
        
        .p-block--laboratory .p-block__code,
        .p-block--laboratory .p-block__name {
          color: #800000;
        }
        
        .p-block--laboratory .p-block__section,
        .p-block--laboratory .p-block__type {
          color: rgba(128, 0, 0, 0.65);
        }
        
        /* Lecture → blue tint */
        .p-block--lecture {
          background: #EEF2FF;
          border-color: rgba(43, 95, 217, 0.30);
        }
        
        .p-block--lecture .p-block__code,
        .p-block--lecture .p-block__name {
          color: #2B5FD9;
        }
        
        .p-block--lecture .p-block__section,
        .p-block--lecture .p-block__type {
          color: rgba(43, 95, 217, 0.65);
        }
        
        .p-block__code {
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-align: center;
          line-height: 1.2;
        }
        
        .p-block__name {
          font-size: 0.63rem;
          font-weight: 700;
          text-align: center;
          line-height: 1.3;
        }
        
        .p-block__section {
          font-size: 0.60rem;
          font-weight: 600;
          text-align: center;
        }
        
        .p-block__type {
          font-size: 0.58rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: center;
        }
        
        @media print {
          body { 
            background: #fff; 
            padding: 16px 20px; 
          }
          .export-btn { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <div class="pill pill--assignment">
          <span class="pill__label">Teaching Assignment</span>
          <span class="pill__sub">${shortSem} · ${ayParam}</span>
        </div>
        <div class="pill pill--name">
          <span>${facultyName}</span>
        </div>
        <button class="export-btn" onclick="window.print()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="9" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 9h5M5 11.5h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M11 6l2 2-2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Export PDF
        </button>
      </div>
      
      <div class="table-card">
        <table>
          <thead><tr><th></th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      
      <script>
        window.onload = function() {
          // Auto-print removed - user clicks button
        };
        window.onafterprint = function() { 
          window.close(); 
        };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
});

// ─────────────────────────────────────────────
//  BACK TO ASSIGNMENT LIST
// ─────────────────────────────────────────────
document.getElementById('backToListBtn')?.addEventListener('click', () => {
  window.location.href = backUrl;
});
