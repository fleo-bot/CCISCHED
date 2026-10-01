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

// Display the logged-in user's name/role wherever the page shows a static
// placeholder. Runs on the authReady event (fired by auth-check.js once the
// current-user fetch resolves) rather than immediately — this script loads
// right after auth-check.js and would otherwise run before that fetch
// finishes, seeing currentUser as still null.
function applyCurrentUserToPage(user) {
  if (!user) return;
  const fullName = `${user.first_name} ${user.last_name}`;

  const greetingStrong = document.querySelector('.welcome-banner__greeting strong');
  if (greetingStrong) greetingStrong.textContent = fullName;

  const panelName = document.querySelector('.profile-panel__name');
  if (panelName) panelName.textContent = fullName;

  const panelRole = document.querySelector('.profile-panel__role');
  if (panelRole) panelRole.textContent = user.role === 'chairperson' ? 'Chairperson' : 'Faculty';

  // Avatar follows the gender saved on the profile (was hardcoded to female).
  const avatarImg = document.querySelector('.profile-panel__avatar-img');
  if (avatarImg && (user.gender === 'male' || user.gender === 'female')) {
    avatarImg.src = `../assets/images/avatar-${user.gender}.svg`;
  }
}

document.addEventListener('authReady', (e) => applyCurrentUserToPage(e.detail));
// In case this script ever loads after auth-check.js has already fired
// (e.g. script reordering later), currentUser may already be populated.
if (typeof currentUser !== 'undefined' && currentUser) applyCurrentUserToPage(currentUser);

// Bell badge: handled by notif-badge.js (shared across every page)

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

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
  const canDeleteSlots = ['pending', 'returned'].includes(sub?.status);
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
           </svg>Edit</button>
         ${canDeleteSlots ? `<button class="slot__delete-btn" type="button" data-slot-id="${slot.id}" aria-label="Delete slot ${slotNum}" title="Delete slot">
           <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
             <path d="M2.5 4h9M5 4V2.5h4V4M4 4.5l.5 7h5l.5-7M5.8 6.2v3.5M8.2 6.2v3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>Delete</button>` : ''}`;
// Render slot card
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
          <span class="slot__time-text">${AvailabilityUtils.slotLabel(slot) || 'Select time'}</span>
        </button>
      </div>`;

    container.appendChild(div);
  });

  // Delete only draft/returned slots. The backend also checks ownership and status.
  container.querySelectorAll('.slot__delete-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const slotId = Number(button.dataset.slotId);
      if (!Number.isInteger(slotId) || slotId <= 0) {
        alert('This slot could not be identified. Please refresh and try again.');
        return;
      }
      if (!window.confirm('Delete this availability slot? This cannot be undone.')) return;

      button.disabled = true;
      try {
        await API.deleteSlot(slotId);
        availabilityData = await API.getMyAvailability();
        renderSlots();
        renderAvailStatBadge();
      } catch (err) {
        console.error('Failed to delete availability slot:', err);
        alert(err.message || 'Could not delete this slot. Please try again.');
        button.disabled = false;
      }
    });
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
//  SEMESTER / ASSIGNMENT / SLOT LIST  (all from the API)
// ─────────────────────────────────────────────
const TERM_LABEL = { '1st': '1st Sem', '2nd': '2nd Sem', 'summer': 'Summer' };
const TERM_LONG  = { '1st': '1st Semester', '2nd': '2nd Semester', 'summer': 'Summer' };
const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

function renderSemester() {
  const sem = availabilityData?.semester;
  if (!sem) {
    setText('welcomeSub',   'No active semester · Here\'s your dashboard overview.');
    setText('availCardSub', 'No active semester');
    setText('semStatValue', '—');
    setText('semStatBadge', '—');
    setText('termStat',     '—');
    return;
  }
  const term  = String(sem.semester_term || '').toLowerCase();
  const short = TERM_LABEL[term] || `${sem.semester_term} Sem`;
  const long  = TERM_LONG[term]  || `${sem.semester_term} Semester`;
  const ay    = sem.academic_year || '';
  const ayShort = /^\d{4}-\d{4}$/.test(ay) ? `${ay.slice(2, 4)}–${ay.slice(-2)}` : ay;

  setText('welcomeSub',   `${long} · AY ${ay.replace('-', '–')} · Here's your dashboard overview.`);
  setText('availCardSub', `${short} · AY ${ay.replace('-', '–')}`);
  setText('semStatValue', short);
  setText('semStatBadge', `AY ${ayShort}`);
  setText('termStat',     term === '1st' || term === '2nd' ? term : short);
}

// Same counting rules as teaching-assignments.js so both pages always agree:
// distinct section names across the faculty member's assigned courses.
async function renderAssignments() {
  try {
    const user = (typeof currentUser !== 'undefined' && currentUser)
      ? currentUser
      : (await API.getCurrentUser()).user;
    const data = await API.getFacultyCourseAssignments();
    const mine = (data?.faculty || []).find(f => Number(f.id) === Number(user?.id)) ||
      (data?.faculty || []).find(f => String(f.employee_number || '').toLowerCase() ===
                                       String(user?.employee_number || '').toLowerCase());
    const sections = new Set();
    (mine?.courses || []).forEach(c => (c.sections || []).forEach(sec => sections.add(sec)));
    const n = sections.size;

    setText('assignStatValue', `${n} Section${n === 1 ? '' : 's'}`);
    setText('assignStatBadge', n > 0 ? 'Active' : 'None yet');
    setText('sectionCountStat', String(n));
  } catch (err) {
    console.error('Failed to load teaching assignments:', err);
    setText('assignStatValue', '—');
    setText('assignStatBadge', '—');
    setText('sectionCountStat', '—');
  }
}

function renderSlotList() {
  const box = document.getElementById('upcomingSlots');
  if (!box) return;
  const slots = AvailabilityUtils.sortSlots
    ? AvailabilityUtils.sortSlots(availabilityData?.submission?.slots || [])
    : (availabilityData?.submission?.slots || []);
  if (!slots.length) {
    box.innerHTML = '<p class="upcoming__empty" style="font-size:.72rem;opacity:.7;">No availability added yet.</p>';
    return;
  }
  const dots = ['maroon', 'light', 'gold'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  box.innerHTML = slots.map((slot, i) => `
    <div class="upcoming__item">
      <div class="upcoming__dot upcoming__dot--${dots[i % dots.length]}"></div>
      <div class="upcoming__info">
        <p class="upcoming__label">Slot ${esc(slot.slot_number || i + 1)}</p>
        <p class="upcoming__time">${esc(AvailabilityUtils.slotLabel(slot) || '—')}</p>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
(async function init() {
  await loadAvailability();
  renderAvailStatBadge();
  renderStatusBadge();
  renderSlots();
  renderSlotList();
  renderSemester();
  renderAssignments();
})();
