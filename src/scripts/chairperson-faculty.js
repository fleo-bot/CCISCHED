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
//  FACULTY DATA
//  load = current units assigned
//  max  = maximum allowed units
// ─────────────────────────────────────────────
let facultyData = [
  { 
    name: 'Ana Cruz',       
    type: 'Full-Time',          
    load: 15, 
    max: 15,
    availability: {
      'Monday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Tuesday': [],
      'Wednesday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00', '12:00 - 1:30'],
      'Thursday': [],
      'Friday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00', '12:00 - 1:30'],
      'Saturday': []
    },
    preference: '10:30 - 12:00',
    status: 'Current Submission'
  },
  { 
    name: 'Andrea Gonzales', 
    type: 'Part-Time',         
    load:  8, 
    max: 12,
    availability: {
      'Monday': ['9:00 - 10:30', '10:30 - 12:00'],
      'Tuesday': ['9:00 - 10:30'],
      'Wednesday': ['9:00 - 10:30', '10:30 - 12:00'],
      'Thursday': ['9:00 - 10:30'],
      'Friday': [],
      'Saturday': []
    },
    preference: '9:00 - 10:30',
    status: 'Current Submission'
  },
  { 
    name: 'Ben Torres',     
    type: 'Designee|Chairperson', 
    load: 6, 
    max:  6,
    availability: {
      'Monday': ['10:30 - 12:00', '12:00 - 1:30'],
      'Tuesday': ['10:30 - 12:00'],
      'Wednesday': ['10:30 - 12:00', '12:00 - 1:30'],
      'Thursday': [],
      'Friday': [],
      'Saturday': []
    },
    preference: '10:30 - 12:00',
    status: 'Current Submission'
  },
  { 
    name: 'Juan Dela Cruz', 
    type: 'Part-Time',           
    load: 11, 
    max: 12,
    availability: {
      'Monday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Tuesday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Wednesday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Thursday': ['7:30 - 9:00'],
      'Friday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Saturday': []
    },
    preference: '9:00 - 10:30',
    status: 'Current Submission'
  },
  { 
    name: 'Maria Santos',   
    type: 'Full-Time',           
    load:  9, 
    max: 15,
    availability: {
      'Monday': ['9:00 - 10:30', '12:00 - 1:30'],
      'Tuesday': ['9:00 - 10:30', '10:30 - 12:00', '12:00 - 1:30'],
      'Wednesday': ['9:00 - 10:30'],
      'Thursday': ['9:00 - 10:30', '10:30 - 12:00'],
      'Friday': ['9:00 - 10:30', '12:00 - 1:30'],
      'Saturday': []
    },
    preference: '9:00 - 10:30',
    status: 'Current Submission'
  },
  { 
    name: 'Leo Reyes',      
    type: 'Full-Time',           
    load: 12, 
    max: 15,
    availability: {
      'Monday': ['10:30 - 12:00', '12:00 - 1:30'],
      'Tuesday': ['10:30 - 12:00', '12:00 - 1:30'],
      'Wednesday': ['10:30 - 12:00'],
      'Thursday': ['10:30 - 12:00', '12:00 - 1:30'],
      'Friday': ['10:30 - 12:00'],
      'Saturday': []
    },
    preference: '10:30 - 12:00',
    status: 'Current Submission'
  },
  { 
    name: 'Carla Mendoza',  
    type: 'Part-Time',           
    load:  6, 
    max: 12,
    availability: {
      'Monday': ['9:00 - 10:30'],
      'Tuesday': ['9:00 - 10:30', '10:30 - 12:00'],
      'Wednesday': ['9:00 - 10:30'],
      'Thursday': ['9:00 - 10:30', '10:30 - 12:00'],
      'Friday': [],
      'Saturday': []
    },
    preference: '9:00 - 10:30',
    status: 'Current Submission'
  },
  { 
    name: 'Mark Villanueva', 
    type: 'Full-Time',          
    load: 14, 
    max: 15,
    availability: {
      'Monday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Tuesday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Wednesday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Thursday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Friday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Saturday': []
    },
    preference: '9:00 - 10:30',
    status: 'Current Submission'
  },
  { 
    name: 'Sofia Dela Peña', 
    type: 'Full-Time',           
    load: 10, 
    max: 15,
    availability: {
      'Monday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Tuesday': ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00'],
      'Wednesday': ['7:30 - 9:00'],
      'Thursday': ['7:30 - 9:00', '9:00 - 10:30'],
      'Friday': ['7:30 - 9:00'],
      'Saturday': []
    },
    preference: '7:30 - 9:00',
    status: 'Current Submission'
  },
  { 
    name: 'Rico Aguilar',   
    type: 'Part-Time',           
    load:  4, 
    max: 12,
    availability: {
      'Monday': ['12:00 - 1:30'],
      'Tuesday': [],
      'Wednesday': ['12:00 - 1:30'],
      'Thursday': [],
      'Friday': ['12:00 - 1:30'],
      'Saturday': []
    },
    preference: '12:00 - 1:30',
    status: 'Current Submission'
  },
];

// ─────────────────────────────────────────────
//  RENDER ROWS
// ─────────────────────────────────────────────
const facultyList = document.getElementById('facultyList');

function renderRows(filter = 'all', query = '') {
  if (!facultyList) return;
  facultyList.innerHTML = '';

  const q = query.trim().toLowerCase();

  facultyData.forEach((f, idx) => {
    const matchFilter = filter === 'all' || f.type === filter;
    const matchQuery  = !q || f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
    if (!matchFilter || !matchQuery) return;

    const pct = Math.min((f.load / f.max) * 100, 100).toFixed(1);
    const over = f.load >= f.max;

    const row = document.createElement('div');
    row.className = 'fl-row';
    row.dataset.idx = idx;

    row.innerHTML = `
      <span class="fl-row__name">${f.name}</span>
      <span class="fl-row__type">${f.type.replace('|', ' | ')}</span>
      <div class="fl-load">
        <div class="fl-load__track">
          <div class="fl-load__fill ${over ? 'fl-load__fill--over' : ''}"
               style="width:0%" data-pct="${pct}"></div>
        </div>
        <span class="fl-load__label">${f.load}/${f.max}</span>
      </div>
      <div class="fl-row__actions">
        <button class="fl-avail-btn" data-idx="${idx}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          View Availability
        </button>
      </div>
    `;

    facultyList.appendChild(row);
  });

  // Animate progress bars after paint
  requestAnimationFrame(() => {
    setTimeout(() => {
      facultyList.querySelectorAll('.fl-load__fill').forEach(fill => {
        fill.style.width = fill.dataset.pct + '%';
      });
    }, 60);
  });
}

renderRows();

// ─────────────────────────────────────────────
//  FILTER + SEARCH
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';

document.getElementById('typeFilter')?.addEventListener('change', function () {
  activeFilter = this.value;
  renderRows(activeFilter, searchQuery);
});

document.getElementById('facultySearch')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderRows(activeFilter, searchQuery);
});

// ─────────────────────────────────────────────
//  VIEW AVAILABILITY MODAL
// ─────────────────────────────────────────────
const vaOverlay   = document.getElementById('vaModalOverlay');
const vaTitle     = document.getElementById('vaModalTitle');
const vaContent   = vaOverlay?.querySelector('.va-modal__content');

const TIME_SLOTS = ['7:30 - 9:00', '9:00 - 10:30', '10:30 - 12:00', '12:00 - 1:30'];
const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hasAvailability(f) {
  if (!f.availability) return false;
  return DAYS.some(d => (f.availability[d] || []).length > 0);
}

function openAvailabilityModal(f) {
  if (!vaOverlay) return;

  if (vaTitle) vaTitle.textContent = 'VIEW AVAILABILITY';

  if (hasAvailability(f)) {
    // ── Has availability: white body with grey fields ──
    vaContent.innerHTML = `
      <div class="va-modal__info">
        <span class="va-name-badge">Submitted Availability: ${f.name}</span>
        <div class="va-info-grid">
          <div>
            <span class="va-info-label">Faculty Type</span>
            <div class="va-info-value">${f.type.replace('|', ' | ')}</div>
          </div>
          <div>
            <span class="va-info-label">Status</span>
            <div class="va-info-value">${f.status || 'Current Submission'}</div>
          </div>
        </div>
        <button class="va-history-btn" id="vaHistoryBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 4v4.5L10.5 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          View History
        </button>
      </div>

      <span class="va-section-label">AVAILABILITY SCHEDULE</span>

      <div class="va-table-wrap">
        <table class="va-table">
          <thead>
            <tr>
              <th>TIME</th>
              ${DAYS.map(d => `<th>${d.toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${TIME_SLOTS.map(slot => `
              <tr>
                <td>${slot}</td>
                ${DAYS.map(d =>
                  (f.availability[d] || []).includes(slot)
                    ? `<td><span class="va-available">Available</span></td>`
                    : `<td></td>`
                ).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="va-preference">
        <span class="va-pref-label">Available Time Preference</span>
        <div class="va-pref-value">${f.preference || '—'}</div>
      </div>
    `;

    vaContent.querySelector('#vaHistoryBtn')?.addEventListener('click', () => {
      openHistoryModal(f);
    });

    vaOverlay.querySelector('.va-modal__footer').innerHTML = `
      <button class="va-modal-btn va-modal-btn--close" id="vaCloseBtn">Close</button>
    `;
    vaOverlay.querySelector('#vaCloseBtn')?.addEventListener('click', closeAvailabilityModal);

  } else {
    // ── No availability: white body with maroon warning ──
    vaContent.innerHTML = `
      <div class="va-empty">
        <div class="va-empty__icon">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L44 40H4L24 6Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M24 19v10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="33" r="1.5" fill="white"/>
          </svg>
        </div>
        <p class="va-empty__title">NO AVAILABILITY SUBMITTED</p>
        <p class="va-empty__sub">No availability schedule has been submitted by this user<br>for the current semester</p>
      </div>
    `;

    vaOverlay.querySelector('.va-modal__footer').innerHTML = `
      <button class="va-modal-btn va-modal-btn--remind" id="vaRemindBtn">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5C5.24 1.5 3 3.74 3 6.5v4l-1.5 2h13L13 10.5v-4C13 3.74 10.76 1.5 8 1.5Z"
                stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" stroke-width="1.4"/>
        </svg>
        Send Reminder Notification
      </button>
      <button class="va-modal-btn va-modal-btn--close" id="vaCloseBtn2">Close</button>
    `;
    vaOverlay.querySelector('#vaRemindBtn')?.addEventListener('click', () => {
      showToast(`Reminder sent to ${f.name}`);
      closeAvailabilityModal();
    });
    vaOverlay.querySelector('#vaCloseBtn2')?.addEventListener('click', closeAvailabilityModal);
  }

  vaOverlay.classList.add('va-modal-overlay--open');
}

function closeAvailabilityModal() {
  vaOverlay?.classList.remove('va-modal-overlay--open');
}

// Delegation on the list
facultyList?.addEventListener('click', e => {
  const btn = e.target.closest('.fl-avail-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  openAvailabilityModal(facultyData[idx]);
});

// Header X close button (static in HTML)
document.getElementById('vaModalClose')?.addEventListener('click', closeAvailabilityModal);

// Close on overlay click or Escape
vaOverlay?.addEventListener('click', e => {
  if (e.target === vaOverlay) closeAvailabilityModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && vaOverlay?.classList.contains('va-modal-overlay--open')) {
    closeAvailabilityModal();
  }
});

// ─────────────────────────────────────────────
//  VIEW HISTORY MODAL
// ─────────────────────────────────────────────

// Time columns (matches faculty-schedule.js)
const VH_TIME_COLS = [
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

const VH_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Historical schedule data keyed by faculty name → academic year → semester
const HISTORY_DATA = {
  'Ana Cruz': {
    '2025-2026': {
      '1': [
        { day: 'Monday',    col: 0, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-3', type: 'Laboratory' },
        { day: 'Monday',    col: 5, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-2', type: 'Laboratory' },
        { day: 'Tuesday',   col: 2, code: 'INTE 303', name: 'Capstone 1',        section: 'BSIT 3-1', type: 'Lecture'    },
        { day: 'Wednesday', col: 0, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-3', type: 'Laboratory' },
        { day: 'Wednesday', col: 5, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-2', type: 'Laboratory' },
        { day: 'Thursday',  col: 2, code: 'INTE 303', name: 'Capstone 1',        section: 'BSIT 3-1', type: 'Lecture',  highlight: true },
        { day: 'Friday',    col: 0, code: 'COMP 017', name: 'Multimedia',        section: 'BSIT 3-3', type: 'Lecture'   },
        { day: 'Friday',    col: 5, code: 'COMP 017', name: 'Multimedia',        section: 'BSIT 3-2', type: 'Lecture'   },
      ],
      '2': [
        { day: 'Monday',    col: 1, code: 'COMP 101', name: 'Intro to Computing', section: 'BSIT 1-1', type: 'Lecture'  },
        { day: 'Wednesday', col: 1, code: 'COMP 101', name: 'Intro to Computing', section: 'BSIT 1-1', type: 'Lecture'  },
        { day: 'Friday',    col: 1, code: 'COMP 101', name: 'Intro to Computing', section: 'BSIT 1-2', type: 'Lecture'  },
      ],
    },
    '2024-2025': {
      '1': [
        { day: 'Tuesday',   col: 0, code: 'COMP 015', name: 'Data Structures',   section: 'BSIT 2-1', type: 'Lecture'   },
        { day: 'Thursday',  col: 0, code: 'COMP 015', name: 'Data Structures',   section: 'BSIT 2-1', type: 'Lecture'   },
        { day: 'Tuesday',   col: 3, code: 'COMP 015', name: 'Data Structures',   section: 'BSIT 2-2', type: 'Lecture'   },
        { day: 'Thursday',  col: 3, code: 'COMP 015', name: 'Data Structures',   section: 'BSIT 2-2', type: 'Lecture'   },
      ],
      '2': [],
    },
  },
};

// Default fallback schedule used when no specific history entry exists
const DEFAULT_HISTORY = [
  { day: 'Monday',    col: 0, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-3', type: 'Laboratory' },
  { day: 'Monday',    col: 5, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-2', type: 'Laboratory' },
  { day: 'Tuesday',   col: 2, code: 'INTE 303', name: 'Capstone 1',        section: 'BSIT 3-1', type: 'Lecture'    },
  { day: 'Wednesday', col: 0, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-3', type: 'Laboratory' },
  { day: 'Wednesday', col: 5, code: 'COMP 016', name: 'Web Development',   section: 'BSIT 3-2', type: 'Laboratory' },
  { day: 'Thursday',  col: 2, code: 'INTE 303', name: 'Capstone 1',        section: 'BSIT 3-1', type: 'Lecture',  highlight: true },
  { day: 'Friday',    col: 0, code: 'COMP 017', name: 'Multimedia',        section: 'BSIT 3-3', type: 'Lecture'   },
  { day: 'Friday',    col: 5, code: 'COMP 017', name: 'Multimedia',        section: 'BSIT 3-2', type: 'Lecture'   },
];

const vhOverlay  = document.getElementById('vhModalOverlay');
const vhClose    = document.getElementById('vhModalClose');
const vhCloseBtn = document.getElementById('vhCloseBtn');
const vhHead     = document.getElementById('vhSchedHead');
const vhBody     = document.getElementById('vhSchedBody');
const vhAcadYear = document.getElementById('vhAcadYear');
const vhSemester = document.getElementById('vhSemester');

let _vhCurrentFaculty = null;

function buildScheduleGrid(entries) {
  if (!vhHead || !vhBody) return;

  // Build lookup map
  const map = {};
  entries.forEach(e => { map[`${e.day}-${e.col}`] = e; });

  // Header
  vhHead.innerHTML = '';
  const corner = document.createElement('th');
  corner.className = 'th-day';
  vhHead.appendChild(corner);
  VH_TIME_COLS.forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    vhHead.appendChild(th);
  });

  // Body rows
  vhBody.innerHTML = '';
  VH_DAYS.forEach(day => {
    const tr = document.createElement('tr');

    const tdDay = document.createElement('td');
    tdDay.className = 'td-day';
    tdDay.textContent = day;
    tr.appendChild(tdDay);

    VH_TIME_COLS.forEach((_, colIdx) => {
      const td = document.createElement('td');
      td.className = 'td-slot';

      const entry = map[`${day}-${colIdx}`];
      if (entry) {
        const block = document.createElement('div');
        const typeClass = entry.type === 'Lecture' ? ' sched-block--lecture' : ' sched-block--laboratory';
        block.className = 'sched-block' + typeClass + (entry.highlight ? ' sched-block--highlight' : '');
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

    vhBody.appendChild(tr);
  });
}

function getHistoryEntries(name, year, sem) {
  const byFaculty = HISTORY_DATA[name];
  if (!byFaculty) return DEFAULT_HISTORY;
  if (!year || !sem) return DEFAULT_HISTORY;
  const bySem = byFaculty[year]?.[sem];
  if (!bySem) return DEFAULT_HISTORY;
  return bySem.length ? bySem : [];
}

function openHistoryModal(f) {
  if (!vhOverlay) return;
  _vhCurrentFaculty = f;

  // Reset filters
  if (vhAcadYear) vhAcadYear.value = '2025-2026';
  if (vhSemester) vhSemester.value = '1';

  buildScheduleGrid(getHistoryEntries(f.name, '2025-2026', '1'));
  vhOverlay.classList.add('vh-modal-overlay--open');
}

function closeHistoryModal() {
  vhOverlay?.classList.remove('vh-modal-overlay--open');
}

// Filter changes rebuild the grid
function onVhFilterChange() {
  if (!_vhCurrentFaculty) return;
  const year = vhAcadYear?.value || '';
  const sem  = vhSemester?.value || '';
  buildScheduleGrid(getHistoryEntries(_vhCurrentFaculty.name, year, sem));
}

vhAcadYear?.addEventListener('change', onVhFilterChange);
vhSemester?.addEventListener('change', onVhFilterChange);

// Close handlers
vhClose?.addEventListener('click', closeHistoryModal);
vhCloseBtn?.addEventListener('click', closeHistoryModal);
vhOverlay?.addEventListener('click', e => {
  if (e.target === vhOverlay) closeHistoryModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && vhOverlay?.classList.contains('vh-modal-overlay--open')) {
    closeHistoryModal();
  }
});

// ─────────────────────────────────────────────
//  PENDING AVAILABILITY MODAL
// ─────────────────────────────────────────────
function showPendingModal(pendingCount) {
  const pendingFaculty = facultyData.filter(f => !f.availability || !hasAvailability(f));
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'pending-modal-overlay pending-modal-overlay--open';
  overlay.innerHTML = `
    <div class="pending-modal" role="dialog" aria-modal="true" aria-labelledby="pendingModalTitle">
      <div class="pending-modal__header">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <path d="M24 6L44 40H4L24 6Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M24 19v10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="24" cy="33" r="1.5" fill="currentColor"/>
        </svg>
        <p class="pending-modal__title" id="pendingModalTitle">CANNOT GENERATE ASSIGNMENT</p>
      </div>
      
      <div class="pending-modal__body">
        <p class="pending-modal__message">
          <strong>${pendingCount}</strong> ${pendingCount === 1 ? 'faculty has' : 'faculty have'} not submitted their availability form for the current semester.
        </p>
        <p class="pending-modal__sub">
          All faculty members must submit their availability before generating assignments.
        </p>
        
        <div class="pending-list-header">
          <span>Faculty with Pending Submissions:</span>
        </div>
        <div class="pending-list">
          ${pendingFaculty.map(f => `
            <div class="pending-faculty-item">
              <div class="pending-faculty-info">
                <span class="pending-faculty-name">${f.name}</span>
                <span class="pending-faculty-type">${f.type.replace('|', ' | ')}</span>
              </div>
              <span class="pending-status-badge">Pending</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="pending-modal__footer">
        <button class="pending-modal-btn pending-modal-btn--secondary" id="pendingRemindBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C5.24 1.5 3 3.74 3 6.5v4l-1.5 2h13L13 10.5v-4C13 3.74 10.76 1.5 8 1.5Z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          Send Reminder to All
        </button>
        <button class="pending-modal-btn pending-modal-btn--primary" id="pendingCloseBtn">
          Close
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Event handlers
  document.getElementById('pendingCloseBtn')?.addEventListener('click', () => {
    overlay.classList.remove('pending-modal-overlay--open');
    setTimeout(() => overlay.remove(), 300);
  });
  
  document.getElementById('pendingRemindBtn')?.addEventListener('click', () => {
    showToast(`Reminder sent to ${pendingCount} ${pendingCount === 1 ? 'faculty member' : 'faculty members'}`);
    overlay.classList.remove('pending-modal-overlay--open');
    setTimeout(() => overlay.remove(), 300);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('pending-modal-overlay--open');
      setTimeout(() => overlay.remove(), 300);
    }
  });
  
  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.classList.remove('pending-modal-overlay--open');
      setTimeout(() => overlay.remove(), 300);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ─────────────────────────────────────────────
//  UPDATE GENERATE BUTTON STATE
// ─────────────────────────────────────────────
function updateGenerateButtonState() {
  const genBtn = document.getElementById('generateBtn');
  if (!genBtn) return;
  
  const pendingCount = facultyData.filter(f => !f.availability || !hasAvailability(f)).length;
  
  if (pendingCount > 0) {
    genBtn.disabled = true;
    genBtn.classList.add('fm-btn--disabled');
    genBtn.title = `Cannot generate: ${pendingCount} pending availability ${pendingCount === 1 ? 'submission' : 'submissions'}`;
  } else {
    genBtn.disabled = false;
    genBtn.classList.remove('fm-btn--disabled');
    genBtn.title = 'Generate faculty assignments';
  }
}

// ─────────────────────────────────────────────
//  GENERATE FACULTY ASSIGNMENT — loading overlay
// ─────────────────────────────────────────────
const genOverlay     = document.getElementById('genOverlay');
const genProgressFill = document.getElementById('genProgressFill');
const genPct         = document.getElementById('genPct');
const genStatus      = document.getElementById('genStatus');

// Steps with label + target % reached at end of that step
const GEN_STEPS = [
  { label: 'Loading faculty data…',         pct: 15 },
  { label: 'Loading course offerings…',     pct: 30 },
  { label: 'Running Random Forest model…',  pct: 55 },
  { label: 'Applying constraints…',         pct: 72 },
  { label: 'Generating…',                   pct: 88 },
  { label: 'Finalizing assignments…',       pct: 100 },
];

function openGenOverlay()  { genOverlay?.classList.add('gen-overlay--open'); }
function closeGenOverlay() { genOverlay?.classList.remove('gen-overlay--open'); }

function runGenSequence() {
  openGenOverlay();
  let stepIdx = 0;
  let currentPct = 0;

  function runStep() {
    if (stepIdx >= GEN_STEPS.length) {
      // Done — brief pause then navigate to results page
      setTimeout(() => {
        closeGenOverlay();
        window.location.href = 'generated-assignment.html';
      }, 600);
      return;
    }

    const step = GEN_STEPS[stepIdx];
    const targetPct = step.pct;

    if (genStatus) genStatus.textContent = step.label;

    // Animate from currentPct to targetPct
    const startPct = currentPct;
    const startTime = performance.now();
    const stepDuration = 520 + Math.random() * 300; // slight randomness per step

    function animatePct(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / stepDuration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const pct      = Math.round(startPct + (targetPct - startPct) * eased);

      if (genProgressFill) genProgressFill.style.width = pct + '%';
      if (genPct) genPct.textContent = pct + '%';
      currentPct = pct;

      if (progress < 1) {
        requestAnimationFrame(animatePct);
      } else {
        stepIdx++;
        setTimeout(runStep, 180); // short pause between steps
      }
    }

    requestAnimationFrame(animatePct);
  }

  // Reset bar before starting
  if (genProgressFill) genProgressFill.style.width = '0%';
  if (genPct) genPct.textContent = '0%';
  if (genStatus) genStatus.textContent = 'Initializing…';

  setTimeout(runStep, 200);
}

document.getElementById('generateBtn')?.addEventListener('click', () => {
  // Check if there are any pending availability submissions
  const pendingCount = facultyData.filter(f => !f.availability || !hasAvailability(f)).length;
  
  if (pendingCount > 0) {
    // Show modal instead of generating
    showPendingModal(pendingCount);
    return;
  }
  
  runGenSequence();
});

// Remove the button state update since button should always be clickable
// setTimeout(() => {
//   updateGenerateButtonState();
// }, 100);

// ─────────────────────────────────────────────
//  VIEW SUBMISSIONS button
// ─────────────────────────────────────────────
document.getElementById('viewSubmissionsBtn')?.addEventListener('click', () => {
  window.location.href = 'view-submissions.html';
});

// ─────────────────────────────────────────────
//  ADD FACULTY MODAL
// ─────────────────────────────────────────────
const addOverlay  = document.getElementById('addFacultyOverlay');
const addClose    = document.getElementById('addFacultyClose');
const addCancel   = document.getElementById('addFacultyCancel');
const addSaveBtn  = document.getElementById('addFacultySave');

document.getElementById('addFacultyBtn')?.addEventListener('click', () => {
  // Clear all fields
  ['addFirstName','addMiddleName','addLastName','addEmail','addAge',
   'addRole','addDepartment','addRank','addYears','addSpecialization',
   'addEmployment','addEducation'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal();
});

function openModal()  { addOverlay?.classList.add('fl-modal-overlay--open'); }
function closeModal() { addOverlay?.classList.remove('fl-modal-overlay--open'); }

addClose?.addEventListener('click', closeModal);
addCancel?.addEventListener('click', closeModal);
addOverlay?.addEventListener('click', e => { if (e.target === addOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

addSaveBtn?.addEventListener('click', () => {
  const first = document.getElementById('addFirstName')?.value.trim();
  const last  = document.getElementById('addLastName')?.value.trim();
  const type  = document.getElementById('addEmployment')?.value.trim() || 'Full-Time';

  if (!first || !last) {
    showToast('First and last name are required.', 'error');
    return;
  }

  // Determine max load based on employment type
  let maxLoad = 15; // Full-Time default
  if (type.toLowerCase().includes('part-time')) {
    maxLoad = 12;
  } else if (type.toLowerCase().includes('designee') || type.toLowerCase().includes('chairperson')) {
    maxLoad = 6;
  }

  // Add new faculty member with no availability initially
  facultyData.push({ 
    name: `${first} ${last}`, 
    type, 
    load: 0, 
    max: maxLoad,
    availability: null,
    preference: null,
    status: null
  });
  
  renderRows(activeFilter, searchQuery);

  const totalEl = document.getElementById('totalFaculty');
  if (totalEl) totalEl.textContent = facultyData.length;

  closeModal();
  showToast(`${first} ${last} added to faculty.`);Toast(`${first} ${last} added to faculty.`);
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'fl-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.background = type === 'error' ? '#C0392B' : 'var(--maroon)';
  toastEl.classList.add('fl-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('fl-toast--show'), 2800);
}

// ─────────────────────────────────────────────
//  TOTAL FACULTY COUNTER ANIMATION
// ─────────────────────────────────────────────
function animateCount(id, target, duration = 700) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(p * target);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

setTimeout(() => animateCount('totalFaculty', facultyData.length), 100);
