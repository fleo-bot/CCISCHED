'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Notification bell ──
const notifBtn = document.getElementById('notifBtn');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    window.location.href = 'notifications.html';
  });
}

// ─────────────────────────────────────────────
//  STORAGE HELPERS — now backed by API
// ─────────────────────────────────────────────
let availabilityData = null; // { submission, semester }

async function loadAvailability() {
  try {
    availabilityData = await API.getMyAvailability();
    return availabilityData.submission;
  } catch (err) {
    console.error('Failed to load availability:', err);
    return null;
  }
}

function isFinalized() {
  return availabilityData?.submission?.status === 'submitted' || 
         availabilityData?.submission?.status === 'approved';
}

// Convert API slot to localStorage format for backward compat with UI
function apiSlotToLocal(slot) {
  return {
    dayIndices: slot.day_indices || [],
    times: [slot.time_label],
    timeLabel: slot.time_label,
  };
}

// Convert buildSlotData output to API format
function localSlotToApi(slotData, slotNumber) {
  // Extract start/end from "7:00 AM – 5:00 PM"
  const match = slotData.timeLabel.match(/(\d+):(\d+)\s*([AP]M)\s*–\s*(\d+):(\d+)\s*([AP]M)/i);
  let timeStart = '08:00', timeEnd = '17:00';
  
  if (match) {
    const to24 = (h, m, mer) => {
      let hour = parseInt(h);
      if (mer.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (mer.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${String(hour).padStart(2,'0')}:${m}`;
    };
    timeStart = to24(match[1], match[2], match[3]);
    timeEnd = to24(match[4], match[5], match[6]);
  }

  return {
    slot_number: slotNumber,
    day_indices: slotData.dayIndices,
    time_start: timeStart,
    time_end: timeEnd,
    time_label: slotData.timeLabel,
  };
}

// ─────────────────────────────────────────────
//  DETECT MODE: add vs edit
// ─────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const slotNum = parseInt(params.get('slot'), 10) || null;  // 1-based
const isEdit  = window.location.pathname.includes('edit-availability');

// Update dynamic text for edit mode
if (isEdit && slotNum) {
  const slotBadge  = document.getElementById('slotBadge');
  const pageTitle  = document.getElementById('pageTitle');
  const pageSub    = document.getElementById('pageSub');
  const breadcrumb = document.getElementById('breadcrumbCurrent');

  if (slotBadge)  slotBadge.textContent  = `SLOT ${slotNum}`;
  if (pageTitle)  pageTitle.textContent  = `Edit Availability — Slot ${slotNum}`;
  if (pageSub)    pageSub.textContent    = `Modifying Slot ${slotNum} preferences for this semester`;
  if (breadcrumb) breadcrumb.textContent = `Edit Availability — Slot ${slotNum}`;
}

// ─────────────────────────────────────────────
//  TIMETABLE
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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildTable() {
  const tbody = document.getElementById('availTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let savedDayIndices = [];
  let savedTimes      = [];

  if (isEdit && slotNum) {
    const slots = loadSlots();
    const slot  = slots[slotNum - 1];
    if (slot) {
      savedDayIndices = slot.dayIndices || [];
      savedTimes      = slot.times || [];
    }
  }

  TIME_SLOTS.forEach((timeSlot) => {
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td');
    tdTime.textContent = timeSlot;
    tr.appendChild(tdTime);

    DAY_NAMES.forEach((_, colIdx) => {
      const td = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('aria-label', `${timeSlot} ${DAY_NAMES[colIdx]}`);

      if (isEdit && savedDayIndices.includes(colIdx) && savedTimes.includes(timeSlot)) {
        cb.checked = true;
      }

      td.appendChild(cb);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

buildTable();

// ─────────────────────────────────────────────
//  FINALIZATION GUARD — applied after table build
// ─────────────────────────────────────────────
function applyFinalizedLock() {
  if (!isFinalized()) return;

  document.querySelectorAll('#availTableBody input[type="checkbox"]').forEach(cb => {
    cb.disabled = true;
  });

  document.querySelectorAll('.af-select').forEach(sel => {
    sel.disabled = true;
  });

  const footer = document.querySelector('.af-card__footer');
  if (footer) {
    footer.innerHTML = `
      <div class="af-locked-notice">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2.5" y="6" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Availability has been finalized and can no longer be edited.
        <a href="view-submission.html" class="af-locked-link">View submission</a>
      </div>`;
  }

  const cardHeader = document.querySelector('.af-card__header');
  if (cardHeader && !document.getElementById('finalizedBanner')) {
    const banner = document.createElement('div');
    banner.id        = 'finalizedBanner';
    banner.className = 'af-finalized-banner';
    banner.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2.5" y="6" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      This submission has been finalized. No further changes are allowed.`;
    cardHeader.insertAdjacentElement('afterend', banner);
  }
}

applyFinalizedLock();

// ─────────────────────────────────────────────
//  GATHER SELECTIONS
// ─────────────────────────────────────────────
function gatherSelections() {
  const results = [];
  document.querySelectorAll('#availTableBody tr').forEach((tr, rowIdx) => {
    tr.querySelectorAll('input[type="checkbox"]').forEach((cb, colIdx) => {
      if (cb.checked) results.push({ timeIdx: rowIdx, dayIdx: colIdx });
    });
  });
  return results;
}

function buildSlotData(selections) {
  const daySet   = new Set();
  const timeSet  = new Set();
  const timeIdxs = new Set();

  selections.forEach(({ timeIdx, dayIdx }) => {
    daySet.add(dayIdx);
    timeSet.add(TIME_SLOTS[timeIdx]);
    timeIdxs.add(timeIdx);
  });

  const sortedIdxs = [...timeIdxs].sort((a, b) => a - b);

  function toDisplay(token) {
    token = token.trim();
    if (/[AP]M/i.test(token)) return token;
    const [hStr, mStr] = token.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const suffix  = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:${m} ${suffix}`;
  }

  const firstSlot  = TIME_SLOTS[sortedIdxs[0]];
  const lastSlot   = TIME_SLOTS[sortedIdxs[sortedIdxs.length - 1]];
  const startToken = firstSlot.split(' - ')[0];
  const endToken   = lastSlot.split(' - ')[1];

  return {
    dayIndices: [...daySet].sort(),
    times:      [...timeSet],
    timeLabel:  `${toDisplay(startToken)} – ${toDisplay(endToken)}`,
  };
}

// ─────────────────────────────────────────────
//  ADD BUTTON — save new slot via API
// ─────────────────────────────────────────────
const addBtn = document.getElementById('addBtn');
if (addBtn) {
  addBtn.addEventListener('click', async () => {
    if (isFinalized()) {
      alert('Your availability has been finalized and can no longer be changed.');
      return;
    }
    const selections = gatherSelections();
    if (!selections.length) {
      alert('Please select at least one time slot before adding.');
      return;
    }
    const slotData = buildSlotData(selections);
    
    // Load existing slots from API
    const sub = await loadAvailability();
    const existingSlots = sub?.slots || [];
    
    // Add new slot
    const newSlotNumber = existingSlots.length + 1;
    const apiSlots = [
      ...existingSlots.map((s, i) => localSlotToApi(apiSlotToLocal(s), i + 1)),
      localSlotToApi(slotData, newSlotNumber)
    ];
    
    try {
      await API.saveAvailability(apiSlots);
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });
}

// ─────────────────────────────────────────────
//  SAVE BUTTON (edit mode) — update slot via API
// ─────────────────────────────────────────────
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    if (isFinalized()) {
      alert('Your availability has been finalized and can no longer be changed.');
      return;
    }
    const selections = gatherSelections();
    if (!selections.length) {
      alert('Please select at least one time slot.');
      return;
    }
    const slotData = buildSlotData(selections);
    
    // Load existing, replace the one being edited
    const sub = await loadAvailability();
    const existingSlots = sub?.slots || [];
    existingSlots[slotNum - 1] = apiSlotToLocal(localSlotToApi(slotData, slotNum));
    
    const apiSlots = existingSlots.map((s, i) => localSlotToApi(apiSlotToLocal(s), i + 1));
    
    try {
      await API.saveAvailability(apiSlots);
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });
}

// ─────────────────────────────────────────────
//  VIEW HISTORY MODAL
// ─────────────────────────────────────────────
const HISTORY_DATA = [
  {
    semester: '2nd Semester',
    ay: 'AY 2024–2025',
    submittedDate: 'Nov 4, 2024',
    slots: [
      { label: 'Slot 1', days: 'Mon, Wed, Fri', time: '7:30 AM – 12:00 PM' },
      { label: 'Slot 2', days: 'Tue, Thu',       time: '9:00 AM – 3:00 PM'  },
    ],
  },
  {
    semester: '1st Semester',
    ay: 'AY 2024–2025',
    submittedDate: 'Jun 3, 2024',
    slots: [
      { label: 'Slot 1', days: 'Mon, Tue, Wed, Thu, Fri', time: '7:30 AM – 6:00 PM' },
    ],
  },
  {
    semester: '2nd Semester',
    ay: 'AY 2023–2024',
    submittedDate: 'Oct 28, 2023',
    slots: [
      { label: 'Slot 1', days: 'Mon, Wed, Fri', time: '9:00 AM – 3:00 PM'  },
      { label: 'Slot 2', days: 'Sat',            time: '7:30 AM – 12:00 PM' },
    ],
  },
];

function ensureHistoryModal() {
  if (document.getElementById('historyModal')) return;

  const entriesHTML = HISTORY_DATA.map((entry) => {
    const slotsHTML = entry.slots.map(s => `
      <div class="hist-slot">
        <span class="hist-slot__label">${s.label}</span>
        <span class="hist-slot__days">${s.days}</span>
        <span class="hist-slot__time">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M7 4V7L9.5 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          ${s.time}
        </span>
      </div>`).join('');

    return `
      <div class="hist-entry">
        <div class="hist-entry__header">
          <div class="hist-entry__sem">
            <span class="hist-entry__sem-name">${entry.semester}</span>
            <span class="hist-entry__ay">${entry.ay}</span>
          </div>
          <span class="hist-entry__date">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="11" rx="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1 5.5h12" stroke="currentColor" stroke-width="1.3"/>
              <rect x="3.5" y=".5" width="1.5" height="3.5" rx=".75" fill="currentColor"/>
              <rect x="9" y=".5" width="1.5" height="3.5" rx=".75" fill="currentColor"/>
            </svg>
            Submitted ${entry.submittedDate}
          </span>
        </div>
        <div class="hist-entry__slots">${slotsHTML}</div>
      </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id        = 'historyModal';
  modal.className = 'hist-modal-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'histModalTitle');
  modal.innerHTML = `
    <div class="hist-modal">
      <div class="hist-modal__header">
        <div class="hist-modal__title-wrap">
          <div class="hist-modal__icon">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.4"/>
              <path d="M7 4V7L5 9" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M4.5 2.5C5.4 2 6.2 1.8 7 1.8" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="hist-modal__title" id="histModalTitle">Availability History</p>
            <p class="hist-modal__sub">Past semester submissions</p>
          </div>
        </div>
        <button class="hist-modal__close" id="histModalClose" aria-label="Close history">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="hist-modal__body">
        ${entriesHTML}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHistoryModal();
  });

  document.getElementById('histModalClose').addEventListener('click', closeHistoryModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('hist-modal-backdrop--open')) {
      closeHistoryModal();
    }
  });
}

function openHistoryModal() {
  ensureHistoryModal();
  const modal = document.getElementById('historyModal');
  modal.classList.add('hist-modal-backdrop--open');
  document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  modal.classList.remove('hist-modal-backdrop--open');
  document.body.style.overflow = '';
}

const viewHistoryBtn = document.getElementById('viewHistoryBtn');
if (viewHistoryBtn) {
  viewHistoryBtn.addEventListener('click', openHistoryModal);
}
