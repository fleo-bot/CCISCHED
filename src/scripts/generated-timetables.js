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
//  META LABEL  (AY / Semester passed via URL)
// ─────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const ayParam  = params.get('ay')  || 'A.Y. 2025–2026';
const semParam = params.get('sem') || '1st Semester';

const gtMeta = document.getElementById('gtMeta');
if (gtMeta) gtMeta.textContent = `${ayParam} \u00a0·\u00a0 ${semParam}`;

// Pre-select the matching term in the dropdown
const gtTermEl = document.getElementById('gtTerm');
if (gtTermEl) {
  const semLower = semParam.toLowerCase();
  if (semLower.includes('2nd'))    gtTermEl.value = '2nd';
  else if (semLower.includes('sum')) gtTermEl.value = 'summer';
  else                              gtTermEl.value = '1st';
}

// ─────────────────────────────────────────────
//  LOAD RESULT FROM SESSION STORAGE
//  Written by chairperson-schedule.js after the
//  /api/generate call completes.
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore parse errors */ }

/**
 * Map the backend faculty_data array into the shape this page's
 * renderRows() expects:
 *   { id, name, profileHref, courses: string[] }
 */
function _buildFacultyData(apiResult) {
  if (!apiResult?.faculty_data?.length) return null;
  return apiResult.faculty_data.map(f => ({
    id:          f.id,
    name:        f.name,
    profileHref: 'assignment-detail.html',
    courses:     f.courses,  // already "CS101 – Introduction to Computing"
  }));
}

const FACULTY_DATA = _buildFacultyData(_apiResult) ?? [
  // ── Fallback shown when backend is not running ──
  {
    id: 1,
    name: 'Ana Cruz',
    profileHref: 'assignment-detail.html',
    courses: ['CS101 – Introduction to Computing'],
  },
];

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
const tableBody = document.getElementById('gtTableBody');

function renderRows(data) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!data.length) {
    tableBody.innerHTML = `
      <div class="gt-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="8" width="32" height="28" rx="5" stroke="white" stroke-width="2"/>
          <path d="M4 16h32" stroke="white" stroke-width="2"/>
          <circle cx="13" cy="24" r="2" fill="white"/>
          <circle cx="20" cy="24" r="2" fill="white"/>
          <circle cx="27" cy="24" r="2" fill="white"/>
        </svg>
        <p class="gt-empty__text">NO MATCHING FACULTY FOUND</p>
      </div>`;
    return;
  }

  data.forEach((faculty, i) => {
    const row = document.createElement('div');
    row.className = 'gt-row';
    row.style.animationDelay = `${i * 60}ms`;

    const coursesHTML = faculty.courses
      .map(c => `<p class="gt-course-item">${c}</p>`)
      .join('');

    // Build the faculty timetable URL with name, AY, sem, and back-link params
    const timetableUrl = `faculty-timetable.html?name=${encodeURIComponent(faculty.name)}&ay=${encodeURIComponent(ayParam)}&sem=${encodeURIComponent(semParam)}&from=generated-timetables.html`;

    row.innerHTML = `
      <div class="gt-row__faculty">
        <span class="gt-row__name" data-href="${timetableUrl}">${faculty.name}</span>
        <button class="gt-profile-btn" data-href="${timetableUrl}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M2 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Profile
        </button>
      </div>
      <div class="gt-row__courses">${coursesHTML}</div>
    `;

    tableBody.appendChild(row);
  });
}

renderRows(FACULTY_DATA);

// ─────────────────────────────────────────────
//  SEARCH FILTER
// ─────────────────────────────────────────────
document.getElementById('gtSearch')?.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? FACULTY_DATA.filter(f => f.name.toLowerCase().includes(q))
    : FACULTY_DATA;
  renderRows(filtered);
});

// ─────────────────────────────────────────────
//  TERM FILTER
// ─────────────────────────────────────────────
document.getElementById('gtTerm')?.addEventListener('change', () => {
  // In a real app you'd re-fetch or filter by semester.
  // For now just show all data to keep the UI responsive.
  renderRows(FACULTY_DATA);
});

// ─────────────────────────────────────────────
//  ROW DELEGATION  (Profile button + name click)
// ─────────────────────────────────────────────
tableBody?.addEventListener('click', e => {
  const btn  = e.target.closest('.gt-profile-btn');
  const name = e.target.closest('.gt-row__name');
  const href = (btn || name)?.dataset?.href;
  if (href) window.location.href = href;
});

// ─────────────────────────────────────────────
//  ACTION BUTTONS
// ─────────────────────────────────────────────
document.getElementById('exportPdfBtn')?.addEventListener('click', exportAllToPDF);

document.getElementById('distributeBtn')?.addEventListener('click', () => {
  // Navigate to the schedule dashboard; the ?distributed=1 flag
  // tells that page to show the success notification on arrival.
  window.location.href = `schedule.html?distributed=1`;
});

// ─────────────────────────────────────────────
//  PDF EXPORT  — print-based, no dependencies
// ─────────────────────────────────────────────
function exportAllToPDF() {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    showToast('Pop-up blocked. Please allow pop-ups and try again.', 'warn');
    return;
  }

  const rows = FACULTY_DATA.map(faculty => `
    <div class="faculty-block">
      <p class="faculty-name">${faculty.name}</p>
      <table>
        <thead>
          <tr><th>Assigned Courses &amp; Sections</th></tr>
        </thead>
        <tbody>
          ${faculty.courses.map(c => `<tr><td>${c}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Generated Timetables — ${ayParam} ${semParam}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
          color: #111;
          background: #fff;
          padding: 40px 48px;
        }
        .doc-header {
          background: #800000;
          color: #fff;
          padding: 20px 28px;
          border-radius: 10px;
          margin-bottom: 28px;
        }
        .doc-header h1 {
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: 0.12em;
        }
        .doc-header p {
          font-size: 0.78rem;
          opacity: 0.70;
          margin-top: 4px;
          letter-spacing: 0.06em;
        }
        .faculty-block {
          margin-bottom: 24px;
          border: 1.5px solid rgba(128,0,0,0.18);
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .faculty-name {
          background: rgba(128,0,0,0.07);
          color: #800000;
          font-size: 0.88rem;
          font-weight: 800;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(128,0,0,0.12);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead tr {
          background: #800000;
        }
        thead th {
          color: #fff;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          padding: 8px 16px;
          text-align: left;
        }
        tbody td {
          padding: 8px 16px;
          font-size: 0.80rem;
          color: #111;
          border-bottom: 1px solid rgba(128,0,0,0.07);
        }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background: #fff8f8; }
        .doc-footer {
          margin-top: 32px;
          font-size: 0.68rem;
          color: #999;
          text-align: center;
          border-top: 1px solid #eee;
          padding-top: 14px;
        }
        @media print {
          body { padding: 24px 32px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <h1>GENERATED TIMETABLES</h1>
        <p>${ayParam} &nbsp;·&nbsp; ${semParam}</p>
      </div>

      ${rows}

      <div class="doc-footer">
        CCISched &nbsp;·&nbsp; Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      <\/script>
    </body>
    </html>
  `);

  win.document.close();
  showToast('Opening print dialog…');
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
const toastEl = document.getElementById('gtToast');
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.background = type === 'warn' ? '#92400E' : 'var(--maroon)';
  toastEl.classList.add('gt-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('gt-toast--show'), 3000);
}
