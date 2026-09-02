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
//  ROOM DATA
//  status: 'available' | 'occupied'
//  type:   'Lecture'   | 'Laboratory'
//  assignedTo: null or a course name (when occupied)
// ─────────────────────────────────────────────
const ROOMS = [
  // ── Lecture Rooms ──────────────────────────
  { id: 'S501', type: 'Lecture',    capacity: 45, status: 'available',  assignedTo: null },
  { id: 'S502', type: 'Lecture',    capacity: 45, status: 'occupied',   assignedTo: 'IT 304 — Programming Languages' },
  { id: 'S503', type: 'Lecture',    capacity: 40, status: 'available',  assignedTo: null },
  { id: 'S504', type: 'Lecture',    capacity: 40, status: 'occupied',   assignedTo: 'CS 401 — Algorithm Design' },
  { id: 'W501', type: 'Lecture',    capacity: 50, status: 'available',  assignedTo: null },
  { id: 'W502', type: 'Lecture',    capacity: 50, status: 'occupied',   assignedTo: 'CS 312 — Machine Learning' },
  { id: 'W503', type: 'Lecture',    capacity: 45, status: 'available',  assignedTo: null },
  { id: 'W504', type: 'Lecture',    capacity: 45, status: 'available',  assignedTo: null },
  { id: 'N301', type: 'Lecture',    capacity: 40, status: 'occupied',   assignedTo: 'IT 322 — Network Security' },
  { id: 'N302', type: 'Lecture',    capacity: 40, status: 'available',  assignedTo: null },
  { id: 'N303', type: 'Lecture',    capacity: 35, status: 'available',  assignedTo: null },
  { id: 'N304', type: 'Lecture',    capacity: 35, status: 'occupied',   assignedTo: 'CS 215 — Operating Systems' },

  // ── Laboratory Rooms ───────────────────────
  { id: 'L101', type: 'Laboratory', capacity: 30, status: 'available',  assignedTo: null },
  { id: 'L102', type: 'Laboratory', capacity: 30, status: 'occupied',   assignedTo: 'IT 211 — Web Development' },
  { id: 'L103', type: 'Laboratory', capacity: 30, status: 'available',  assignedTo: null },
  { id: 'L104', type: 'Laboratory', capacity: 30, status: 'occupied',   assignedTo: 'IT 315 — Database Administration' },
  { id: 'L201', type: 'Laboratory', capacity: 25, status: 'available',  assignedTo: null },
  { id: 'L202', type: 'Laboratory', capacity: 25, status: 'available',  assignedTo: null },
  { id: 'L203', type: 'Laboratory', capacity: 25, status: 'occupied',   assignedTo: 'CS 218 — Computer Architecture Lab' },
  { id: 'L204', type: 'Laboratory', capacity: 25, status: 'available',  assignedTo: null },
];

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let activeFilter = 'all';
let activeType   = 'all';
let searchQuery  = '';

// ─────────────────────────────────────────────
//  STATS
// ─────────────────────────────────────────────
function updateStats() {
  const total     = ROOMS.length;
  const available = ROOMS.filter(r => r.status === 'available').length;
  const occupied  = ROOMS.filter(r => r.status === 'occupied').length;
  const lecture   = ROOMS.filter(r => r.type === 'Lecture').length;
  const lab       = ROOMS.filter(r => r.type === 'Laboratory').length;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statAvailable').textContent = available;
  document.getElementById('statOccupied').textContent  = occupied;
  document.getElementById('statLecture').textContent   = lecture;
  document.getElementById('statLab').textContent       = lab;
}

// ─────────────────────────────────────────────
//  RENDER ROOMS GRID
// ─────────────────────────────────────────────
function renderRooms() {
  const grid  = document.getElementById('roomsGrid');
  const empty = document.getElementById('roomsEmpty');
  grid.innerHTML = '';

  const filtered = ROOMS.filter(r => {
    const matchStatus = activeFilter === 'all' || r.status === activeFilter;
    const matchType   = activeType   === 'all' || r.type   === activeType;
    const matchSearch = r.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(room => {
    const card = document.createElement('div');
    card.className = `room-card room-card--${room.status}`;

    const typeSlug  = room.type.toLowerCase();
    const typeIcon  = room.type === 'Lecture'
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
           <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
           <path d="M7 9h10M7 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
         </svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
           <path d="M9 3v7l-4 8h14l-4-8V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           <path d="M9 3h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
         </svg>`;

    const statusLabel  = room.status === 'available' ? 'Available' : 'Occupied';
    const toggleLabel  = room.status === 'available' ? 'Mark as Occupied' : 'Mark as Available';
    const toggleMod    = room.status === 'available' ? 'room-toggle--occupy' : 'room-toggle--free';

    card.innerHTML = `
      <div class="room-card__header">
        <p class="room-card__number">${room.id}</p>
        <span class="status-dot status-dot--${room.status}"></span>
      </div>
      <span class="type-badge type-badge--${typeSlug}">
        ${typeIcon}
        ${room.type}
      </span>
      <p class="room-card__capacity">Capacity: ${room.capacity} seats</p>
      ${room.assignedTo
        ? `<p class="room-card__assigned">${room.assignedTo}</p>`
        : ''}
      <div class="room-card__status">${statusLabel}</div>
      <button class="room-toggle ${toggleMod}" data-id="${room.id}">${toggleLabel}</button>
    `;

    grid.appendChild(card);
  });

  // ── Toggle button handlers ──
  grid.querySelectorAll('.room-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const room = ROOMS.find(r => r.id === btn.dataset.id);
      if (!room) return;

      // Flip status
      room.status = room.status === 'available' ? 'occupied' : 'available';
      // Clear assignedTo when freeing a room
      if (room.status === 'available') room.assignedTo = null;

      updateStats();
      renderRooms();
    });
  });
}

// ─────────────────────────────────────────────
//  FILTER TABS (status)
// ─────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
    tab.classList.add('filter-tab--active');
    activeFilter = tab.dataset.filter;
    renderRooms();
  });
});

// ─────────────────────────────────────────────
//  TYPE TABS (lecture / laboratory)
// ─────────────────────────────────────────────
document.querySelectorAll('.type-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('type-tab--active'));
    tab.classList.add('type-tab--active');
    activeType = tab.dataset.type;
    renderRooms();
  });
});

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
document.getElementById('searchInput')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderRooms();
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
updateStats();
renderRooms();
