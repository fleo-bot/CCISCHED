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
//  FACULTY SUBMISSION DATA — from API
// ─────────────────────────────────────────────
let facultySubmissions = [];
let semester = null;

async function loadSubmissions() {
  try {
    const response = await API.getAllSubmissions();
    facultySubmissions = response.submissions || [];
    semester = response.semester;
    
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Failed to load submissions:', err);
  }
}
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
function renderStats() {
  const el = document.getElementById('csSummaryChips');
  if (!el) return;
  
  const total = facultySubmissions.length;
  const submitted = facultySubmissions.filter(f => f.status === 'submitted').length;
  const approved = facultySubmissions.filter(f => f.status === 'approved').length;
  const pending = facultySubmissions.filter(f => f.status === 'pending').length;

  el.innerHTML = `
    <span class="cs-chip cs-chip--total">${total} Total</span>
    <span class="cs-chip cs-chip--submitted">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${submitted} Submitted
    </span>
    <span class="cs-chip cs-chip--approved">${approved} Approved</span>
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
function renderTable(filter = 'all', query = '') {
  const body    = document.getElementById('csBody');
  const countEl = document.getElementById('csCount');
  if (!body) return;

  const q = query.trim().toLowerCase();

  const filtered = facultySubmissions.filter(f => {
    const matchStatus = filter === 'all'
      || (filter === 'submitted' && f.status === 'submitted')
      || (filter === 'approved' && f.status === 'approved')
      || (filter === 'pending'   && f.status === 'pending');
    const matchQuery = !q || f.faculty_name.toLowerCase().includes(q);
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

  body.innerHTML = filtered.map(f => {
    const statusBadge = 
      f.status === 'approved' ? `<span class="cs-status cs-status--approved">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Approved
      </span>` :
      f.status === 'submitted' ? `<span class="cs-status cs-status--submitted">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Submitted
      </span>` :
      f.status === 'returned' ? `<span class="cs-status cs-status--returned">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M6 2V10M6 2L3 5M6 2L9 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        Returned
      </span>` :
      `<span class="cs-status cs-status--pending">Pending</span>`;
    
    return `
      <div class="cs-row">
        <div class="cs-row__name">
          <div class="cs-row__avatar">${initials(f.faculty_name)}</div>
          <div>
            <p class="cs-row__name-text">${f.faculty_name}</p>
          </div>
        </div>
        <span class="cs-row__type">Faculty</span>
        <div class="cs-row__slots">
          <span class="cs-slot-count ${(f.slots?.length || 0) === 0 ? 'cs-slot-count--zero' : ''}">${f.slots?.length || 0}</span>
        </div>
        <div class="cs-row__status">${statusBadge}</div>
        <div class="cs-row__actions">
          <button class="cs-action-btn" onclick="viewSubmission(${f.id})" title="View details">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
              <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}
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
//  VIEW SUBMISSION DETAIL
// ─────────────────────────────────────────────
function viewSubmission(submissionId) {
  window.location.href = `submission-detail.html?id=${submissionId}`;
}

// ─────────────────────────────────────────────
//  FILTER + SEARCH
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';

document.getElementById('statusFilter')?.addEventListener('change', function () {
  activeFilter = this.value;
  renderTable(activeFilter, searchQuery);
});

document.getElementById('searchInput')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderTable(activeFilter, searchQuery);
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
loadSubmissions();

