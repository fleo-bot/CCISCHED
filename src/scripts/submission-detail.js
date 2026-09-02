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
//  CONSTANTS
// ─────────────────────────────────────────────
const TIME_SLOTS = [
  '7:30 - 9:00',
  '9:00 - 10:30',
  '10:30 - 12:00',
  '12:00 - 1:30',
  '1:30 - 3:00',
  '3:00 - 4:30',
  '4:30 - 6:00',
  '6:00 - 7:30',
  '7:30 - 9:00 PM',
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────────
//  LOAD DATA — from sessionStorage written by chairperson-submissions.js
//  Fall back to embedded data so direct URL access still works
// ─────────────────────────────────────────────
const FALLBACK_DATA = [
  {
    id: 0, name: 'Ana Cruz', type: 'Full-Time', submitted: true,
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
    id: 1, name: 'Andrea Gonzales', type: 'Part-Time', submitted: true,
    submittedDate: 'Aug 14, 2026',
    slots: [
      { dayIndices: [0,1,2,3], times: ['9:00 - 10:30','10:30 - 12:00'], timeLabel: '9:00 AM – 12:00 PM' },
    ],
    preference: '9:00 - 10:30', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 2, name: 'Ben Torres', type: 'Designee | Chairperson', submitted: true,
    submittedDate: 'Aug 10, 2026',
    slots: [
      { dayIndices: [0,2], times: ['10:30 - 12:00','12:00 - 1:30'], timeLabel: '10:30 AM – 1:30 PM' },
    ],
    preference: '10:30 - 12:00', 
    status: 'Current Submission',
    workflowStatus: 'approved',
  },
  {
    id: 3, name: 'Juan Dela Cruz', type: 'Part-Time', submitted: true,
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
    id: 4, name: 'Maria Santos', type: 'Full-Time', submitted: true,
    submittedDate: 'Aug 15, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['9:00 - 10:30','12:00 - 1:30'], timeLabel: '9:00 AM – 1:30 PM' },
    ],
    preference: '9:00 - 10:30', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 5, name: 'Leo Reyes', type: 'Full-Time', submitted: true,
    submittedDate: 'Aug 11, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['10:30 - 12:00','12:00 - 1:30'], timeLabel: '10:30 AM – 1:30 PM' },
    ],
    preference: '10:30 - 12:00', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 6, name: 'Carla Mendoza', type: 'Part-Time', submitted: true,
    submittedDate: 'Aug 16, 2026',
    slots: [
      { dayIndices: [0,1,2,3], times: ['9:00 - 10:30'], timeLabel: '9:00 AM – 10:30 AM' },
    ],
    preference: '9:00 - 10:30', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 7, name: 'Mark Villanueva', type: 'Full-Time', submitted: true,
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
    id: 8, name: 'Sofia Dela Peña', type: 'Full-Time', submitted: true,
    submittedDate: 'Aug 17, 2026',
    slots: [
      { dayIndices: [0,1,2,3,4], times: ['7:30 - 9:00','9:00 - 10:30'], timeLabel: '7:30 AM – 10:30 AM' },
    ],
    preference: '7:30 - 9:00', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
  {
    id: 9, name: 'Rico Aguilar', type: 'Part-Time', submitted: true,
    submittedDate: 'Aug 18, 2026',
    slots: [
      { dayIndices: [0,2,4], times: ['12:00 - 1:30'], timeLabel: '12:00 PM – 1:30 PM' },
    ],
    preference: '12:00 - 1:30', 
    status: 'Current Submission',
    workflowStatus: 'pending',
  },
];

function loadSubmissions() {
  try {
    const raw = sessionStorage.getItem('cp_submissions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* fall through */ }
  // Initialize with fallback and save to sessionStorage
  sessionStorage.setItem('cp_submissions', JSON.stringify(FALLBACK_DATA));
  return FALLBACK_DATA;
}

// ─────────────────────────────────────────────
//  READ ?id= FROM URL
// ─────────────────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const targetId   = parseInt(params.get('id') ?? '0', 10);
const allFaculty = loadSubmissions();
const faculty    = allFaculty.find(f => f.id === targetId) ?? allFaculty[0];

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Count total availability cells across all slots
function totalCells(slots) {
  return slots.reduce((sum, s) =>
    sum + (s.dayIndices || []).length * (s.times || []).length, 0);
}

// Unique days covered
function daysCovered(slots) {
  const set = new Set();
  slots.forEach(s => (s.dayIndices || []).forEach(d => set.add(d)));
  return set.size;
}

// ─────────────────────────────────────────────
//  RENDER BREADCRUMB + PAGE TITLE
// ─────────────────────────────────────────────
const sdBreadcrumb = document.getElementById('sdBreadcrumb');
const sdFacultyName = document.getElementById('sdFacultyName');
const sdFacultySub  = document.getElementById('sdFacultySub');
const sdStatusBadge = document.getElementById('sdStatusBadge');

if (sdBreadcrumb)  sdBreadcrumb.textContent  = faculty.name;
if (sdFacultyName) sdFacultyName.textContent  = faculty.name;
if (sdFacultySub)  sdFacultySub.textContent   =
  `1st Semester · AY 2025–2026 · ${faculty.type} · ${faculty.submitted ? 'Availability submitted' : 'No submission yet'}`;

if (sdStatusBadge) {
  if (faculty.submitted) {
    sdStatusBadge.className = 'sd-status-badge sd-status-badge--submitted';
    sdStatusBadge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Submitted`;
  } else {
    sdStatusBadge.className = 'sd-status-badge sd-status-badge--pending';
    sdStatusBadge.innerHTML = `⏳ Pending`;
  }
}

// ─────────────────────────────────────────────
//  RENDER INFO CARD
// ─────────────────────────────────────────────
const sdInfoCard = document.getElementById('sdInfoCard');

if (sdInfoCard) {
  const cells    = totalCells(faculty.slots);
  const days     = daysCovered(faculty.slots);
  const slotCount = faculty.slots.length;

  sdInfoCard.innerHTML = `
    <div class="sd-info-card__header">
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="sd-info-card__avatar">${initials(faculty.name)}</div>
        <div>
          <p class="sd-info-card__title">${faculty.name.toUpperCase()}</p>
          <p class="sd-info-card__semester">1st Semester · AY 2025–2026</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <span class="sd-info-meta-chip">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="10" rx="2.5" stroke="rgba(255,255,255,0.70)" stroke-width="1.4"/>
            <path d="M1 6h12" stroke="rgba(255,255,255,0.70)" stroke-width="1.4"/>
            <rect x="4" y="1" width="1.8" height="4" rx="0.9" fill="rgba(255,255,255,0.70)"/>
            <rect x="8.2" y="1" width="1.8" height="4" rx="0.9" fill="rgba(255,255,255,0.70)"/>
          </svg>
          ${slotCount} ${slotCount === 1 ? 'Slot' : 'Slots'}
        </span>
        <span class="sd-info-meta-chip">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.70)" stroke-width="1.4"/>
            <path d="M7 4V7L9 9" stroke="rgba(255,255,255,0.70)" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          ${cells} Blocks
        </span>
        <span class="sd-info-meta-chip">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M2 4h10M2 10h6" stroke="rgba(255,255,255,0.70)" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          ${days} ${days === 1 ? 'Day' : 'Days'}
        </span>
      </div>
    </div>
    <div class="sd-info-card__body">
      <div class="sd-info-field">
        <span class="sd-info-label">Faculty Name</span>
        <div class="sd-info-value">${faculty.name}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Faculty Type</span>
        <div class="sd-info-value">${faculty.type}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Submission Status</span>
        <div class="sd-info-value">${faculty.status || 'No submission yet'}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Date Submitted</span>
        <div class="sd-info-value">${faculty.submittedDate || '—'}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Preferred Time</span>
        <div class="sd-info-value">${faculty.preference || '—'}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Semester</span>
        <div class="sd-info-value">1st Sem · AY 2025–2026</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
//  RENDER TIMETABLE SLOTS
// ─────────────────────────────────────────────
const sdSlotsEl = document.getElementById('sdSlots');

function renderSlots() {
  if (!sdSlotsEl) return;
  sdSlotsEl.innerHTML = '';

  // No submission state
  if (!faculty.submitted || !faculty.slots.length) {
    sdSlotsEl.innerHTML = `
      <div class="sd-no-submission">
        <div class="sd-no-submission__icon">
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L44 40H4L24 6Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M24 19v10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="33" r="1.8" fill="white"/>
          </svg>
        </div>
        <p class="sd-no-submission__title">NO AVAILABILITY SUBMITTED</p>
        <p class="sd-no-submission__sub">
          ${faculty.name} has not submitted an availability schedule<br>
          for the current semester.
        </p>
        <button class="sd-remind-btn" id="sdRemindBtn">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C5.24 1.5 3 3.74 3 6.5v4l-1.5 2h13L13 10.5v-4C13 3.74 10.76 1.5 8 1.5Z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          Send Reminder Notification
        </button>
      </div>
    `;
    document.getElementById('sdRemindBtn')?.addEventListener('click', () => {
      showToast(`Reminder sent to ${faculty.name}`);
    });
    return;
  }

  // Column headers HTML
  const headersHTML = DAY_FULL.map((day, i) => {
    const cls = i === 5 ? ' sd-table__th--sat' : '';
    return `<th class="sd-table__th${cls}">${day.toUpperCase()}</th>`;
  }).join('');

  faculty.slots.forEach((slot, idx) => {
    const slotNum    = idx + 1;
    const dayIndices = slot.dayIndices || [];
    const checkedTimes = slot.times   || [];
    const timeLabel  = slot.timeLabel || '—';

    // Day pills
    const dayPillsHTML = DAY_LABELS.map((lbl, i) => {
      const on = dayIndices.includes(i);
      return `<span class="sd-slot__day-pill sd-slot__day-pill--${on ? 'on' : 'off'}">${lbl}</span>`;
    }).join('');

    // Timetable rows
    const rowsHTML = TIME_SLOTS.map(timeSlot => {
      const timeChecked = checkedTimes.includes(timeSlot);

      const dayCells = DAY_FULL.map((_, colIdx) => {
        const checked = timeChecked && dayIndices.includes(colIdx);
        return `<td><div class="sd-cell sd-cell--${checked ? 'checked' : 'empty'}"></div></td>`;
      }).join('');

      return `<tr><td>${timeSlot}</td>${dayCells}</tr>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'sd-slot';
    card.innerHTML = `
      <div class="sd-slot__header">
        <div class="sd-slot__header-left">
          <span class="sd-slot__num">SLOT ${slotNum}</span>
          <span class="sd-slot__time-badge">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.4"/>
              <path d="M7 4V7L9.5 9" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            ${timeLabel}
          </span>
          <div class="sd-slot__days-row">${dayPillsHTML}</div>
        </div>
        <div class="sd-slot__meta">
          <span class="sd-slot__cell-count">
            ${(dayIndices.length * checkedTimes.length)} availability blocks
          </span>
        </div>
      </div>
      <div class="sd-table-wrap">
        <table class="sd-table">
          <thead>
            <tr>
              <th class="sd-table__th sd-table__th--time">TIME</th>
              ${headersHTML}
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
    `;

    sdSlotsEl.appendChild(card);
  });
}

renderSlots();

// ─────────────────────────────────────────────
//  PREV / NEXT FACULTY NAVIGATION
// ─────────────────────────────────────────────
const submittedOnly = allFaculty.filter(f => f.submitted);
const currentNavIdx = submittedOnly.findIndex(f => f.id === faculty.id);

const prevBtn = document.getElementById('sdPrevBtn');
const nextBtn = document.getElementById('sdNextBtn');
const navLabel = document.getElementById('sdNavLabel');

function updateNav() {
  if (!prevBtn || !nextBtn) return;

  const hasPrev = currentNavIdx > 0;
  const hasNext = currentNavIdx < submittedOnly.length - 1;

  prevBtn.disabled = !hasPrev;
  prevBtn.style.opacity = hasPrev ? '1' : '0.35';

  nextBtn.disabled = !hasNext;
  nextBtn.style.cssText = hasNext ? '' : 'opacity:0.35';

  if (navLabel) {
    navLabel.textContent =
      `${currentNavIdx + 1} / ${submittedOnly.length} submitted`;
  }
}

prevBtn?.addEventListener('click', () => {
  if (currentNavIdx > 0) {
    const prev = submittedOnly[currentNavIdx - 1];
    window.location.href = `submission-detail.html?id=${prev.id}`;
  }
});

nextBtn?.addEventListener('click', () => {
  if (currentNavIdx < submittedOnly.length - 1) {
    const next = submittedOnly[currentNavIdx + 1];
    window.location.href = `submission-detail.html?id=${next.id}`;
  }
});

updateNav();

// ─────────────────────────────────────────────
//  APPROVAL WORKFLOW — Show/Hide Action Buttons
// ─────────────────────────────────────────────
const sdActionButtons = document.getElementById('sdActionButtons');
const sdApproveBtn    = document.getElementById('sdApproveBtn');
const sdReturnBtn     = document.getElementById('sdReturnBtn');
const sdRejectBtn     = document.getElementById('sdRejectBtn');

// Show action buttons only if submitted and workflow status is pending
function updateActionButtons() {
  if (sdActionButtons && faculty.submitted && faculty.workflowStatus === 'pending') {
    sdActionButtons.style.display = 'flex';
  }
}

updateActionButtons();

// ─────────────────────────────────────────────
//  APPROVAL WORKFLOW — Modal Logic
// ─────────────────────────────────────────────
const sdModal          = document.getElementById('sdConfirmModal');
const sdModalBackdrop  = sdModal?.querySelector('.sd-modal__backdrop');
const sdModalIcon      = document.getElementById('sdModalIcon');
const sdModalTitle     = document.getElementById('sdModalTitle');
const sdModalMessage   = document.getElementById('sdModalMessage');
const sdModalFaculty   = document.getElementById('sdModalFacultyName');
const sdModalSubmitDate = document.getElementById('sdModalSubmitDate');
const sdModalCancelBtn = document.getElementById('sdModalCancelBtn');
const sdModalConfirmBtn = document.getElementById('sdModalConfirmBtn');
const sdReasonGroup    = document.getElementById('sdReasonGroup');
const sdReasonInput    = document.getElementById('sdReasonInput');
const sdCharCount      = document.getElementById('sdCharCount');

let currentAction = null; // 'approve', 'return', 'reject'

function openModal(action) {
  if (!sdModal) return;
  currentAction = action;

  // Populate faculty info
  if (sdModalFaculty) sdModalFaculty.textContent = faculty.name;
  if (sdModalSubmitDate) sdModalSubmitDate.textContent = faculty.submittedDate || '—';

  // Reset reason input
  if (sdReasonInput) sdReasonInput.value = '';
  if (sdCharCount) sdCharCount.textContent = '0';

  // Reset icon classes
  if (sdModalIcon) {
    sdModalIcon.className = 'sd-modal__icon';
  }

  // Reset confirm button classes
  if (sdModalConfirmBtn) {
    sdModalConfirmBtn.className = 'sd-modal__btn sd-modal__btn--confirm';
    sdModalConfirmBtn.disabled = false;
  }

  if (action === 'approve') {
    if (sdModalIcon) {
      sdModalIcon.classList.add('sd-modal__icon--approve');
      sdModalIcon.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path d="M6 16L12 22L26 8" stroke="#3A8A00" stroke-width="3" 
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }
    if (sdModalTitle) sdModalTitle.textContent = 'Approve Submission';
    if (sdModalMessage) sdModalMessage.textContent = 
      'Are you sure you want to approve this availability submission? The faculty will be notified.';
    if (sdReasonGroup) sdReasonGroup.style.display = 'none';
    if (sdModalConfirmBtn) {
      sdModalConfirmBtn.textContent = 'Approve Submission';
      sdModalConfirmBtn.classList.add('sd-modal__btn--approve-action');
    }
  } 
  else if (action === 'return') {
    if (sdModalIcon) {
      sdModalIcon.classList.add('sd-modal__icon--return');
      sdModalIcon.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path d="M16 6V26M16 6L8 14M16 6L24 14" stroke="#0066CC" stroke-width="3" 
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }
    if (sdModalTitle) sdModalTitle.textContent = 'Return Submission';
    if (sdModalMessage) sdModalMessage.textContent = 
      'This submission will be returned to the faculty for revision. Please provide a reason.';
    if (sdReasonGroup) sdReasonGroup.style.display = 'block';
    if (sdModalConfirmBtn) {
      sdModalConfirmBtn.textContent = 'Return Submission';
      sdModalConfirmBtn.classList.add('sd-modal__btn--return-action');
      sdModalConfirmBtn.disabled = true; // Enable only when reason is entered
    }
  } 
  else if (action === 'reject') {
    if (sdModalIcon) {
      sdModalIcon.classList.add('sd-modal__icon--reject');
      sdModalIcon.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path d="M6 6L26 26M26 6L6 26" stroke="#C0392B" stroke-width="3" 
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }
    if (sdModalTitle) sdModalTitle.textContent = 'Reject Submission';
    if (sdModalMessage) sdModalMessage.textContent = 
      'Are you sure you want to reject this availability submission? The faculty will be notified and need to resubmit.';
    if (sdReasonGroup) sdReasonGroup.style.display = 'none';
    if (sdModalConfirmBtn) {
      sdModalConfirmBtn.textContent = 'Reject Submission';
      sdModalConfirmBtn.classList.add('sd-modal__btn--reject-action');
    }
  }

  sdModal.style.display = 'flex';
}

function closeModal() {
  if (sdModal) sdModal.style.display = 'none';
  currentAction = null;
}

// Reason input character counter and validation
if (sdReasonInput && sdCharCount && sdModalConfirmBtn) {
  sdReasonInput.addEventListener('input', () => {
    const len = sdReasonInput.value.trim().length;
    sdCharCount.textContent = len.toString();
    
    // Enable confirm button only if reason is provided (for Return action)
    if (currentAction === 'return') {
      sdModalConfirmBtn.disabled = len === 0;
    }
  });
}

// Button click handlers
sdApproveBtn?.addEventListener('click', () => openModal('approve'));
sdReturnBtn?.addEventListener('click', () => openModal('return'));
sdRejectBtn?.addEventListener('click', () => openModal('reject'));

sdModalCancelBtn?.addEventListener('click', closeModal);
sdModalBackdrop?.addEventListener('click', closeModal);

sdModalConfirmBtn?.addEventListener('click', () => {
  if (!currentAction) return;

  const reason = sdReasonInput?.value.trim() || '';

  // Validate reason for return action
  if (currentAction === 'return' && !reason) {
    showToast('Please provide a reason for returning', 'error');
    return;
  }

  // Update faculty workflow status
  faculty.workflowStatus = currentAction === 'approve' ? 'approved' : 
                           currentAction === 'return' ? 'returned' : 
                           'rejected';

  // Save updated data back to sessionStorage
  const allFacultyUpdated = allFaculty.map(f => 
    f.id === faculty.id ? { ...f, workflowStatus: faculty.workflowStatus, returnReason: reason } : f
  );
  
  try {
    sessionStorage.setItem('cp_submissions', JSON.stringify(allFacultyUpdated));
  } catch { /* silent fail */ }

  // Create notification record (simulation)
  const notificationData = {
    facultyId: faculty.id,
    facultyName: faculty.name,
    action: currentAction,
    reason: reason,
    timestamp: new Date().toISOString(),
  };

  // Store notification in sessionStorage (for faculty notification system)
  try {
    const existing = sessionStorage.getItem('faculty_notifications') || '[]';
    const notifications = JSON.parse(existing);
    notifications.push(notificationData);
    sessionStorage.setItem('faculty_notifications', JSON.stringify(notifications));
  } catch { /* silent fail */ }

  // Show success message
  let message = '';
  if (currentAction === 'approve') {
    message = `✓ ${faculty.name}'s submission has been approved`;
  } else if (currentAction === 'return') {
    message = `↑ Submission returned to ${faculty.name}`;
  } else if (currentAction === 'reject') {
    message = `✗ ${faculty.name}'s submission has been rejected`;
  }

  closeModal();
  showToast(message, 'success');

  // Hide action buttons after action is taken
  if (sdActionButtons) sdActionButtons.style.display = 'none';

  // Update status badge
  if (sdStatusBadge) {
    if (currentAction === 'approve') {
      sdStatusBadge.className = 'sd-status-badge sd-status-badge--approved';
      sdStatusBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Approved`;
    } else if (currentAction === 'return') {
      sdStatusBadge.className = 'sd-status-badge sd-status-badge--returned';
      sdStatusBadge.innerHTML = `↑ Returned`;
    } else if (currentAction === 'reject') {
      sdStatusBadge.className = 'sd-status-badge sd-status-badge--rejected';
      sdStatusBadge.innerHTML = `✗ Rejected`;
    }
  }

  // Update page subtitle
  if (sdFacultySub) {
    let statusText = currentAction === 'approve' ? 'Approved' :
                     currentAction === 'return' ? 'Returned for revision' :
                     'Rejected';
    sdFacultySub.textContent =
      `1st Semester · AY 2025–2026 · ${faculty.type} · ${statusText}`;
  }
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'cs-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.background = type === 'error' ? '#C0392B' : 'var(--maroon)';
  toastEl.classList.add('cs-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('cs-toast--show'), 2800);
}
