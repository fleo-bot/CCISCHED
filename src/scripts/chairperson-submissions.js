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
//  FACULTY SUBMISSION DATA
//  Mirrors the faculty list in chairperson-faculty.js
//  submitted = has availability data; pending = no submission
//  Load from sessionStorage if available, otherwise use default
// ─────────────────────────────────────────────
const DEFAULT_FACULTY_SUBMISSIONS = [
  {
    id: 0,
    name: 'Ana Cruz',
    type: 'Full-Time',
    submitted: true,
    submittedDate: 'Aug 12, 2026',
    slots: [
      { dayIndices: [0,2,4], times: ['7:30 - 9:00','9:00 - 10:30'], timeLabel: '7:30 AM – 10:30 AM' },
      { dayIndices: [1,3],   times: ['10:30 - 12:00','12:00 - 1:30'], timeLabel: '10:30 AM – 1:30 PM' },
    ],
    preference: '10:30 - 12:00',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 1,
    name: 'Andrea Gonzales',
    type: 'Part-Time',
    submitted: true,
    submittedDate: 'Aug 14, 2026',
    slots: [
      { dayIndices: [0,1,2,3], times: ['9:00 - 10:30','10:30 - 12:00'], timeLabel: '9:00 AM – 12:00 PM' },
    ],
    preference: '9:00 - 10:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 2,
    name: 'Ben Torres',
    type: 'Designee | Chairperson',
    submitted: true,
    submittedDate: 'Aug 10, 2026',
    slots: [
      { dayIndices: [0,2], times: ['10:30 - 12:00','12:00 - 1:30'], timeLabel: '10:30 AM – 1:30 PM' },
    ],
    preference: '10:30 - 12:00',
    status: 'Current Submission',
    workflowStatus: 'approved',
  },
  {
    id: 3,
    name: 'Juan Dela Cruz',
    type: 'Part-Time',
    submitted: true,
    submittedDate: 'Aug 13, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['7:30 - 9:00','9:00 - 10:30'], timeLabel: '7:30 AM – 10:30 AM' },
      { dayIndices: [0,2,4],     times: ['10:30 - 12:00'], timeLabel: '10:30 AM – 12:00 PM' },
    ],
    preference: '9:00 - 10:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 4,
    name: 'Maria Santos',
    type: 'Full-Time',
    submitted: true,
    submittedDate: 'Aug 15, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['9:00 - 10:30','12:00 - 1:30'], timeLabel: '9:00 AM – 1:30 PM' },
    ],
    preference: '9:00 - 10:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 5,
    name: 'Leo Reyes',
    type: 'Full-Time',
    submitted: true,
    submittedDate: 'Aug 11, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['10:30 - 12:00','12:00 - 1:30'], timeLabel: '10:30 AM – 1:30 PM' },
    ],
    preference: '10:30 - 12:00',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 6,
    name: 'Carla Mendoza',
    type: 'Part-Time',
    submitted: true,
    submittedDate: 'Aug 16, 2026',
    slots: [
      { dayIndices: [0,1,2,3], times: ['9:00 - 10:30'], timeLabel: '9:00 AM – 10:30 AM' },
    ],
    preference: '9:00 - 10:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 7,
    name: 'Mark Villanueva',
    type: 'Full-Time',
    submitted: true,
    submittedDate: 'Aug 9, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['7:30 - 9:00','9:00 - 10:30'], timeLabel: '7:30 AM – 10:30 AM' },
      { dayIndices: [0,1,4],     times: ['10:30 - 12:00'], timeLabel: '10:30 AM – 12:00 PM' },
    ],
    preference: '9:00 - 10:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 8,
    name: 'Sofia Dela Peña',
    type: 'Full-Time',
    submitted: true,
    submittedDate: 'Aug 17, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['7:30 - 9:00','9:00 - 10:30'], timeLabel: '7:30 AM – 10:30 AM' },
    ],
    preference: '7:30 - 9:00',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 9,
    name: 'Rico Aguilar',
    type: 'Part-Time',
    submitted: true,
    submittedDate: 'Aug 18, 2026',
    slots: [
      { dayIndices: [0,2,4], times: ['12:00 - 1:30'], timeLabel: '12:00 PM – 1:30 PM' },
    ],
    preference: '12:00 - 1:30',
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
];

// Load from sessionStorage or use defaults
let FACULTY_SUBMISSIONS = [];
try {
  const stored = sessionStorage.getItem('cp_submissions');
  FACULTY_SUBMISSIONS = stored ? JSON.parse(stored) : DEFAULT_FACULTY_SUBMISSIONS;
} catch {
  FACULTY_SUBMISSIONS = DEFAULT_FACULTY_SUBMISSIONS;
}

// ─────────────────────────────────────────────
//  SAVE TO sessionStorage so detail page can read it
// ─────────────────────────────────────────────
sessionStorage.setItem('cp_submissions', JSON.stringify(FACULTY_SUBMISSIONS));

// ─────────────────────────────────────────────
//  SUMMARY CHIPS
// ─────────────────────────────────────────────
function renderSummary() {
  const el = document.getElementById('csSummaryChips');
  if (!el) return;
  const total     = FACULTY_SUBMISSIONS.length;
  const submitted = FACULTY_SUBMISSIONS.filter(f => f.submitted).length;
  const pending   = total - submitted;

  el.innerHTML = `
    <span class="cs-chip cs-chip--total">${total} Total</span>
    <span class="cs-chip cs-chip--submitted">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${submitted} Submitted
    </span>
    <span class="cs-chip cs-chip--pending">${pending} Pending</span>
  `;
}

// ─────────────────────────────────────────────
//  GET INITIALS
// ─────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─────────────────────────────────────────────
//  RENDER ROWS
// ─────────────────────────────────────────────
function renderRows(filter = 'all', query = '') {
  const body    = document.getElementById('csBody');
  const countEl = document.getElementById('csCount');
  if (!body) return;

  const q = query.trim().toLowerCase();

  const filtered = FACULTY_SUBMISSIONS.filter(f => {
    const matchStatus = filter === 'all'
      || (filter === 'submitted' && f.submitted)
      || (filter === 'pending'   && !f.submitted);
    const matchQuery = !q || f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  if (countEl) countEl.textContent = `${filtered.length} faculty`;

  if (!filtered.length) {
    body.innerHTML = `
      <div class="cs-empty">
        <p>No submissions match the current filter.</p>
      </div>`;
    return;
  }

  body.innerHTML = filtered.map(f => `
    <div class="cs-row">

      <!-- Name + avatar -->
      <div class="cs-row__name">
        <div class="cs-row__avatar">${initials(f.name)}</div>
        <div>
          <p class="cs-row__name-text">${f.name}</p>
        </div>
      </div>

      <!-- Type -->
      <span class="cs-row__type">${f.type}</span>

      <!-- Slot count -->
      <div class="cs-row__slots">
        <span class="cs-slot-count ${f.slots.length === 0 ? 'cs-slot-count--zero' : ''}">${f.slots.length}</span>
      </div>

      <!-- Status -->
      <div class="cs-row__status">
        ${f.submitted
          ? (f.workflowStatus === 'approved'
              ? `<span class="cs-status cs-status--approved">
                   <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                     <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                   </svg>
                   Approved
                 </span>`
              : f.workflowStatus === 'returned'
              ? `<span class="cs-status cs-status--returned">↑ Returned</span>`
              : f.workflowStatus === 'rejected'
              ? `<span class="cs-status cs-status--rejected">✗ Rejected</span>`
              : `<span class="cs-status cs-status--submitted">
                   <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                     <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                   </svg>
                   Submitted
                 </span>`)
          : `<span class="cs-status cs-status--pending">⏳ Pending</span>`
        }
      </div>

      <!-- Date -->
      <span class="cs-row__date">${f.submittedDate || '—'}</span>

      <!-- Actions -->
      <div class="cs-row__actions">
        ${f.submitted
          ? `<a href="submission-detail.html?id=${f.id}" class="cs-view-btn">
               <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                 <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="7" cy="7" r="2" fill="currentColor"/>
               </svg>
               View Detail
             </a>`
          : `<button class="cs-remind-btn" data-id="${f.id}">
               <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                 <path d="M7 1.5C4.79 1.5 3 3.29 3 5.5v3.5L1.5 11h11L11 9V5.5C11 3.29 9.21 1.5 7 1.5Z"
                   stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                 <path d="M5.5 11a1.5 1.5 0 003 0" stroke="currentColor" stroke-width="1.4"/>
               </svg>
               Send Reminder
             </button>`
        }
      </div>

    </div>
  `).join('');

  // Wire remind buttons
  body.querySelectorAll('.cs-remind-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = FACULTY_SUBMISSIONS[parseInt(btn.dataset.id, 10)];
      showToast(`Reminder sent to ${f.name}`);
    });
  });
}

// ─────────────────────────────────────────────
//  FILTER + SEARCH
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';

document.getElementById('statusFilter')?.addEventListener('change', function () {
  activeFilter = this.value;
  renderRows(activeFilter, searchQuery);
});

document.getElementById('searchInput')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderRows(activeFilter, searchQuery);
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl, toastTimer;

function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'cs-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('cs-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('cs-toast--show'), 2800);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
renderSummary();
renderRows();
