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
//  ASSIGNMENT DATA — loaded from sessionStorage
//  (written by chairperson-schedule.js)
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore */ }

const ASSIGNMENTS = _apiResult?.dept_summary ?? [
  {
    department: 'Bachelor of Science in Computer Science',
    totalFaculty: 0,
    status: 'Completed',
  },
  {
    department: 'Bachelor of Science in Information Technology',
    totalFaculty: 0,
    status: 'Completed',
  },
];

// ─────────────────────────────────────────────
//  RENDER TABLE ROWS
// ─────────────────────────────────────────────
const gaBody = document.getElementById('gaBody');

function renderRows() {
  if (!gaBody) return;
  gaBody.innerHTML = '';

  ASSIGNMENTS.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'ga-row';
    row.innerHTML = `
      <span class="ga-row__dept">${item.department}</span>
      <span class="ga-row__faculty">${item.totalFaculty}</span>
      <span class="ga-row__status">${item.status}</span>
      <div class="ga-row__actions">
        <button class="ga-view-btn" data-idx="${idx}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="7" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          View
        </button>
      </div>
    `;
    gaBody.appendChild(row);
  });
}

renderRows();

// ─────────────────────────────────────────────
//  VIEW BUTTON DELEGATION
// ─────────────────────────────────────────────
gaBody?.addEventListener('click', e => {
  const btn = e.target.closest('.ga-view-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  window.location.href = `assignment-detail.html?dept=${idx}`;
});

// ─────────────────────────────────────────────
//  BOTTOM ACTIONS
// ─────────────────────────────────────────────
document.getElementById('discardAllBtn')?.addEventListener('click', () => {
  showToast('All assignments discarded.');
  setTimeout(() => window.location.href = 'faculty.html', 1200);
});

document.getElementById('approveAllBtn')?.addEventListener('click', () => {
  showToast('All assignments approved successfully.');
  setTimeout(() => window.location.href = 'faculty.html', 1400);
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'ga-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.background = type === 'error' ? '#C0392B' : 'var(--maroon)';
  toastEl.classList.add('ga-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('ga-toast--show'), 2800);
}
