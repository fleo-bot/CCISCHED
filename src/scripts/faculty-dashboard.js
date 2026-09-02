'use strict';

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

// ─────────────────────────────────────────────
//  STATUS BADGE  (header of avail card)
// ─────────────────────────────────────────────
function renderStatusBadge() {
  const badge = document.getElementById('dashStatusBadge');
  if (!badge) return;
  
  const sub = availabilityData?.submission;
  if (!sub || sub.status === 'pending') {
    badge.className = 'badge badge--pending';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Pending Request`;
  } else if (sub.status === 'submitted') {
    badge.className = 'badge badge--submitted';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Submitted`;
  } else if (sub.status === 'approved') {
    badge.className = 'badge badge--approved';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Approved`;
  } else if (sub.status === 'returned') {
    badge.className = 'badge badge--returned';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M6 2V6L9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Returned`;
  } else if (sub.status === 'rejected') {
    badge.className = 'badge badge--rejected';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Rejected`;
  }
}
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// Display user name in greeting
if (currentUser) {
  const greeting = document.getElementById('userGreeting');
  if (greeting) {
    greeting.textContent = `Hello, ${currentUser.first_name} ${currentUser.last_name}`;
  }
}

// ─────────────────────────────────────────────
//  NOTIFICATION BELL — fetch unread count from API
// ─────────────────────────────────────────────
async function updateNotificationCount() {
  try {
    const response = await API.getUnreadCount();
    const badge = document.querySelector('.notif-badge');
    if (badge) {
      badge.textContent = response.unread_count || 0;
      badge.style.display = response.unread_count > 0 ? '' : 'none';
    }
  } catch (err) {
    console.error('Failed to fetch notification count:', err);
  }
}

updateNotificationCount();

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  STATUS BADGE  (header of avail card)
// ─────────────────────────────────────────────
function renderStatusBadge() {
  const badge = document.getElementById('dashStatusBadge');
  if (!badge) return;
  if (isFinalized()) {
    badge.className = 'badge badge--submitted';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Submitted`;
  } else {
    badge.className = 'badge badge--pending';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Pending Request`;
  }
}

// ─────────────────────────────────────────────
//  RENDER SLOTS
// ─────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S'];

function renderSlots() {
  const container = document.getElementById('slotsContainer');
  if (!container) return;

  const sub       = availabilityData?.submission;
  const slots     = sub?.slots || [];
  const finalized = isFinalized();
  container.innerHTML = '';

  // Empty state
  if (!slots.length) {
    container.innerHTML = `
      <div class="slots-empty">
        <p class="slots-empty__text">No availability added yet.</p>
      </div>`;
    const stat = document.getElementById('slotCountStat');
    if (stat) stat.textContent = '0';
    return;
  }

  slots.forEach((slot, idx) => {
    const slotNum = slot.slot_number || (idx + 1);
    const isFirst = idx === 0;

    const daysHTML = DAY_LABELS.map((lbl, i) => {
      const active = slot.day_indices && slot.day_indices.includes(i) ? 'day--active' : '';
      return `<span class="day ${active}" tabindex="0">${lbl}</span>`;
    }).join('');

    const statusChipHTML = finalized
      ? `<span class="slot__status slot__status--submitted">
           <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
             <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>Submitted</span>`
      : `<span class="slot__status slot__status--pending">
           <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
             <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.6"/>
             <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
           </svg>Pending</span>`;

    const editOrLockHTML = finalized
      ? `<span class="slot__locked-tag">
           <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
             <rect x="2.5" y="6" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/>
             <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           </svg>Locked</span>`
      : `<button class="slot__edit-btn" onclick="window.location.href='edit-availability.html?slot=${slotNum}'">
           <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
             <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
           </svg>Edit</button>`;

    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `
      <div class="slot__label">
        SLOT ${slotNum}
        ${isFirst ? `<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 7L5.5 10.5L12 4" stroke="#800000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>` : ''}
        ${editOrLockHTML}
      </div>
      <div class="slot__row">
        <div class="slot__days">${daysHTML}</div>
        <button class="slot__time" type="button"${finalized ? ' disabled style="cursor:default;opacity:0.85;"' : ''}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.4"/>
            <path d="M7 4V7L9.5 9" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="slot__time-text">${slot.time_label || 'Select time'}</span>
        </button>
      </div>`;

    container.appendChild(div);
  });

  // Day toggles — disabled if finalized
  container.querySelectorAll('.day').forEach(dayEl => {
    if (finalized) { dayEl.style.cursor = 'default'; dayEl.removeAttribute('tabindex'); return; }
    // Day editing not implemented here, edit-availability.html handles it
  });

  // Slot count stat
  const stat = document.getElementById('slotCountStat');
  if (stat) stat.textContent = slots.length;

  // Add availability button lock
  const addSlotBtn = document.getElementById('addSlotBtn');
  if (addSlotBtn) {
    if (finalized) {
      addSlotBtn.disabled = true;
      addSlotBtn.classList.add('btn-add-avail--locked');
      addSlotBtn.title   = 'Submission has been finalized';
      addSlotBtn.onclick = null;
    } else {
      addSlotBtn.disabled = false;
      addSlotBtn.classList.remove('btn-add-avail--locked');
      addSlotBtn.onclick = () => { window.location.href = 'add-availability.html'; };
    }
  }
}

// ─────────────────────────────────────────────
//  STAT CARD — Availability badge (Done / Pending)
// ─────────────────────────────────────────────
function renderAvailStatBadge() {
  const badge = document.getElementById('availStatBadge');
  if (!badge) return;
  
  const sub = availabilityData?.submission;
  if (!sub || sub.status === 'pending') {
    badge.className = 'stat-card__badge stat-card__badge--pending';
    badge.textContent = 'Pending';
  } else if (sub.status === 'submitted') {
    badge.className = 'stat-card__badge stat-card__badge--green';
    badge.textContent = 'Submitted';
  } else if (sub.status === 'approved') {
    badge.className = 'stat-card__badge stat-card__badge--green';
    badge.textContent = 'Approved';
  } else if (sub.status === 'returned') {
    badge.className = 'stat-card__badge stat-card__badge--pending';
    badge.textContent = 'Returned';
  } else if (sub.status === 'rejected') {
    badge.className = 'stat-card__badge stat-card__badge--rejected';
    badge.textContent = 'Rejected';
  }
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
(async function init() {
  await loadAvailability();
  renderAvailStatBadge();
  renderStatusBadge();
  renderSlots();
})();
