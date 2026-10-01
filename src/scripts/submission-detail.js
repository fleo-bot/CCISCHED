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
// Timetable rows come from the shared helpers (availability-utils.js)
const TIME_SLOTS = AvailabilityUtils.TIME_BLOCKS.map(b => b.label);

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Shifts used for the "Preferred Time" summary (minutes since midnight)
const SHIFTS = [
  { name: 'Morning',   start:    0, end:  720 },
  { name: 'Afternoon', start:  720, end: 1080 },
  { name: 'Evening',   start: 1080, end: 1440 },
];

// Workflow status (availability_submissions.status) → what the page shows
const STATUS_UI = {
  pending: {
    sub: 'No submission yet',
    badgeClass: 'sd-status-badge--pending',
    badgeHTML: '⏳ Pending',
  },
  submitted: {
    sub: 'Availability submitted',
    badgeClass: 'sd-status-badge--submitted',
    badgeHTML: `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Submitted`,
  },
  approved: {
    sub: 'Approved',
    badgeClass: 'sd-status-badge--approved',
    badgeHTML: `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Approved`,
  },
  returned: {
    sub: 'Returned for revision',
    badgeClass: 'sd-status-badge--returned',
    badgeHTML: '↑ Returned',
  },
  rejected: {
    sub: 'Rejected',
    badgeClass: 'sd-status-badge--rejected',
    badgeHTML: '✗ Rejected',
  },
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function initials(name) {
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
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

// There is no "preferred time" column in the database, so summarise which
// parts of the day the faculty's submitted windows fall in.
function summarizePreferredTime(cards) {
  const names = SHIFTS
    .filter(sh => cards.some(c => c.range && c.range.start < sh.end && c.range.end > sh.start))
    .map(sh => sh.name);
  return names.length ? names.join(', ') : '—';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function semesterLabels(sem) {
  if (!sem) return { long: '—', short: '—' };
  const ay = String(sem.academic_year || '').replace('-', '–');
  return {
    long:  `${sem.semester_term} Semester · AY ${ay}`,
    short: `${sem.semester_term} Sem · AY ${ay}`,
  };
}

// ─────────────────────────────────────────────
//  LOAD DATA — from the backend (MySQL via /api/availability/<id>)
//  The ?id= in the URL is availability_submissions.id
// ─────────────────────────────────────────────
const params       = new URLSearchParams(window.location.search);
const submissionId = parseInt(params.get('id'), 10);

let faculty       = null;   // view model for the submission being shown
let navList       = [];     // reviewable submissions, in list order, for prev/next

async function loadSubmission() {
  if (!Number.isFinite(submissionId)) {
    throw new Error('No submission was selected.');
  }

  const [detail, all, facultyList] = await Promise.all([
    API.getSubmission(submissionId),
    API.getAllSubmissions().catch(() => ({ submissions: [] })),
    API.getFacultyList().catch(() => []),
  ]);

  const sub = detail.submission;
  const typeByFacultyId = {};
  facultyList.forEach(f => { typeByFacultyId[f.id] = (f.employment_type || 'Full Time').replace(/ /g, '-'); });

  const cards = AvailabilityUtils.buildSlotCards(sub.slots, { merge: true });
  const sem   = sub.semester;

  faculty = {
    id:            sub.id,
    facultyId:     sub.faculty_id,
    name:          sub.faculty_name || 'Unknown',
    type:          typeByFacultyId[sub.faculty_id] || 'Faculty',
    status:        sub.status,                       // pending | submitted | approved | returned | rejected
    submitted:     sub.status !== 'pending',         // finalized by the faculty
    submittedDate: formatDate(sub.submitted_at),
    remarks:       sub.remarks,
    slots:         cards,
    preference:    summarizePreferredTime(cards),
    semester:      semesterLabels(sem),
    // "Current" = belongs to the active semester
    statusLabel:   sem && sem.is_active === false ? 'Previous Submission' : 'Current Submission',
  };

  // Prev / next walks the same submissions the list shows, in its default (name) order
  navList = (all.submissions || [])
    .filter(s => s.status !== 'pending')
    .sort((a, b) => (a.faculty_name || '').localeCompare(b.faculty_name || ''));
}

// ─────────────────────────────────────────────
//  RENDER BREADCRUMB + PAGE TITLE + STATUS
// ─────────────────────────────────────────────
const sdBreadcrumb  = document.getElementById('sdBreadcrumb');
const sdFacultyName = document.getElementById('sdFacultyName');
const sdFacultySub  = document.getElementById('sdFacultySub');
const sdStatusBadge = document.getElementById('sdStatusBadge');
const sdInfoCard    = document.getElementById('sdInfoCard');
const sdSlotsEl     = document.getElementById('sdSlots');

function renderHeader() {
  const ui = STATUS_UI[faculty.status] || STATUS_UI.pending;

  if (sdBreadcrumb)  sdBreadcrumb.textContent  = faculty.name;
  if (sdFacultyName) sdFacultyName.textContent = faculty.name;
  if (sdFacultySub)  sdFacultySub.textContent  =
    `${faculty.semester.long} · ${faculty.type} · ${ui.sub}`;

  if (sdStatusBadge) {
    sdStatusBadge.className = `sd-status-badge ${ui.badgeClass}`;
    sdStatusBadge.innerHTML = ui.badgeHTML;
  }
}

// ─────────────────────────────────────────────
//  RENDER INFO CARD
// ─────────────────────────────────────────────
function renderInfoCard() {
  if (!sdInfoCard) return;

  const cells     = totalCells(faculty.slots);
  const days      = daysCovered(faculty.slots);
  const slotCount = faculty.slots.length;

  sdInfoCard.style.display = '';
  sdInfoCard.innerHTML = `
    <div class="sd-info-card__header">
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="sd-info-card__avatar">${esc(initials(faculty.name))}</div>
        <div>
          <p class="sd-info-card__title">${esc(faculty.name.toUpperCase())}</p>
          <p class="sd-info-card__semester">${esc(faculty.semester.long)}</p>
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
        <div class="sd-info-value">${esc(faculty.name)}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Faculty Type</span>
        <div class="sd-info-value">${esc(faculty.type)}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Submission Status</span>
        <div class="sd-info-value">${esc(faculty.submitted ? faculty.statusLabel : 'No submission yet')}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Date Submitted</span>
        <div class="sd-info-value">${esc(faculty.submittedDate || '—')}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Preferred Time</span>
        <div class="sd-info-value">${esc(faculty.preference || '—')}</div>
      </div>
      <div class="sd-info-field">
        <span class="sd-info-label">Semester</span>
        <div class="sd-info-value">${esc(faculty.semester.short)}</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
//  RENDER TIMETABLE SLOTS
// ─────────────────────────────────────────────
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
          ${esc(faculty.name)} has not submitted an availability schedule<br>
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
    const slotNum      = idx + 1;
    const dayIndices   = slot.dayIndices || [];
    const checkedTimes = slot.times      || [];
    const timeLabel    = slot.timeLabel  || '—';

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
            ${esc(timeLabel)}
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

// ─────────────────────────────────────────────
//  PREV / NEXT FACULTY NAVIGATION
// ─────────────────────────────────────────────
const prevBtn  = document.getElementById('sdPrevBtn');
const nextBtn  = document.getElementById('sdNextBtn');
const navLabel = document.getElementById('sdNavLabel');

function updateNav() {
  if (!prevBtn || !nextBtn) return;

  const idx     = navList.findIndex(s => s.id === faculty.id);
  const hasPrev = idx > 0;
  const hasNext = idx !== -1 && idx < navList.length - 1;

  prevBtn.disabled = !hasPrev;
  prevBtn.style.opacity = hasPrev ? '1' : '0.35';

  nextBtn.disabled = !hasNext;
  nextBtn.style.opacity = hasNext ? '1' : '0.35';

  if (navLabel) {
    navLabel.textContent = idx === -1
      ? `— / ${navList.length} submitted`
      : `${idx + 1} / ${navList.length} submitted`;
  }

  prevBtn.onclick = () => {
    if (hasPrev) window.location.href = `submission-detail.html?id=${navList[idx - 1].id}`;
  };
  nextBtn.onclick = () => {
    if (hasNext) window.location.href = `submission-detail.html?id=${navList[idx + 1].id}`;
  };
}

// ─────────────────────────────────────────────
//  APPROVAL WORKFLOW — Show/Hide Action Buttons
// ─────────────────────────────────────────────
const sdActionButtons = document.getElementById('sdActionButtons');
const sdApproveBtn    = document.getElementById('sdApproveBtn');
const sdReturnBtn     = document.getElementById('sdReturnBtn');
const sdRejectBtn     = document.getElementById('sdRejectBtn');

// The backend only lets a chairperson review submissions that are 'submitted'
function updateActionButtons() {
  if (!sdActionButtons) return;
  sdActionButtons.style.display = faculty && faculty.status === 'submitted' ? 'flex' : 'none';
}

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

sdModalConfirmBtn?.addEventListener('click', async () => {
  if (!currentAction || !faculty) return;

  const action = currentAction;
  const reason = sdReasonInput?.value.trim() || '';

  // Validate reason for return action
  if (action === 'return' && !reason) {
    showToast('Please provide a reason for returning', 'error');
    return;
  }

  // Persist the decision through the backend (also notifies the faculty)
  sdModalConfirmBtn.disabled = true;
  let result;
  try {
    if (action === 'approve')      result = await API.approveSubmission(faculty.id);
    else if (action === 'return')  result = await API.returnSubmission(faculty.id, reason);
    else                           result = await API.rejectSubmission(faculty.id, reason);
  } catch (err) {
    sdModalConfirmBtn.disabled = false;
    showToast(err.message || 'Something went wrong — please try again.', 'error');
    return;
  }

  const newStatus = result?.submission?.status
    ?? (action === 'approve' ? 'approved' : action === 'return' ? 'returned' : 'rejected');
  faculty.status  = newStatus;
  faculty.remarks = result?.submission?.remarks ?? null;

  // Show success message
  let message = '';
  if (action === 'approve') {
    message = `✓ ${faculty.name}'s submission has been approved`;
  } else if (action === 'return') {
    message = `↑ Submission returned to ${faculty.name}`;
  } else if (action === 'reject') {
    message = `✗ ${faculty.name}'s submission has been rejected`;
  }

  closeModal();
  showToast(message, 'success');

  // Refresh badge, subtitle and action buttons from the new status
  renderHeader();
  updateActionButtons();
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

// ─────────────────────────────────────────────
//  LOAD ERROR STATE
// ─────────────────────────────────────────────
function showLoadError(message) {
  if (sdBreadcrumb)  sdBreadcrumb.textContent  = 'Detail';
  if (sdFacultyName) sdFacultyName.textContent = 'Submission unavailable';
  if (sdFacultySub)  sdFacultySub.textContent  = '—';
  if (sdInfoCard)    sdInfoCard.style.display  = 'none';
  if (navLabel)      navLabel.textContent      = '— / —';
  if (prevBtn)       prevBtn.disabled = true;
  if (nextBtn)       nextBtn.disabled = true;
  if (sdActionButtons) sdActionButtons.style.display = 'none';

  if (sdSlotsEl) {
    sdSlotsEl.innerHTML = `
      <div class="sd-no-submission">
        <div class="sd-no-submission__icon">
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L44 40H4L24 6Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M24 19v10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="33" r="1.8" fill="white"/>
          </svg>
        </div>
        <p class="sd-no-submission__title">COULD NOT LOAD SUBMISSION</p>
        <p class="sd-no-submission__sub">${esc(message)}</p>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
async function init() {
  if (sdInfoCard) sdInfoCard.style.display = 'none';   // nothing to show until data arrives
  if (sdSlotsEl)  sdSlotsEl.innerHTML = '<p class="cs-page-sub">Loading submission…</p>';

  try {
    await loadSubmission();
  } catch (err) {
    console.error('[SubmissionDetail] Failed to load:', err);
    showLoadError(err.message || 'Please try again.');
    return;
  }

  renderHeader();
  renderInfoCard();
  renderSlots();
  updateNav();
  updateActionButtons();
}

init();
