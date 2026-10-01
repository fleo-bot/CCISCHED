'use strict';

// Room Availability is backed by the real rooms table and the published
// schedules for the active semester. There is intentionally no local/mock
// room array and no client-only occupancy toggle.

const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

let rooms = [];
let activeFilter = 'all';
let activeType = 'all';
let searchQuery = '';
let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function roomType(value) {
  const raw = String(value || '').toLowerCase();
  return raw.includes('lab') ? 'Laboratory' : 'Lecture';
}

function updateStats() {
  const total = rooms.length;
  const available = rooms.filter(r => r.status === 'available').length;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const lecture = rooms.filter(r => roomType(r.room_type) === 'Lecture').length;
  const lab = rooms.filter(r => roomType(r.room_type) === 'Laboratory').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAvailable').textContent = available;
  document.getElementById('statOccupied').textContent = occupied;
  document.getElementById('statLecture').textContent = lecture;
  document.getElementById('statLab').textContent = lab;
}

function renderRooms() {
  const grid = document.getElementById('roomsGrid');
  const empty = document.getElementById('roomsEmpty');
  if (!grid || !empty) return;
  grid.innerHTML = '';

  const filtered = rooms.filter(room => {
    const type = roomType(room.room_type);
    const code = String(room.room_code || '').toLowerCase();
    const building = String(room.building || '').toLowerCase();
    const matchStatus = activeFilter === 'all' || room.status === activeFilter;
    const matchType = activeType === 'all' || type === activeType;
    const matchSearch = !searchQuery || code.includes(searchQuery.toLowerCase()) || building.includes(searchQuery.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  empty.style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(room => {
    const type = roomType(room.room_type);
    const typeSlug = type.toLowerCase();
    const occupied = room.status === 'occupied';
    const assignments = Array.isArray(room.assigned_to) ? room.assigned_to : [];

    const typeIcon = type === 'Lecture'
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3v7l-4 8h14l-4-8V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

    const assignmentHtml = assignments.length
      ? assignments.map(a => `<p class="room-card__assigned">${escapeHtml(a.course_code)} — ${escapeHtml(a.course_title)}${a.section_name ? ` <span>(${escapeHtml(a.section_name)})</span>` : ''}${a.time_start && a.time_end ? ` <span>${escapeHtml(String(a.time_start).slice(0, 5))}–${escapeHtml(String(a.time_end).slice(0, 5))}</span>` : ''}</p>`).join('')
      : '';

    const card = document.createElement('div');
    card.className = `room-card room-card--${occupied ? 'occupied' : 'available'}`;
    card.innerHTML = `
      <div class="room-card__header">
        <p class="room-card__number">${escapeHtml(room.room_code)}</p>
        <span class="status-dot status-dot--${occupied ? 'occupied' : 'available'}"></span>
      </div>
      <span class="type-badge type-badge--${typeSlug}">${typeIcon}${escapeHtml(type)}</span>
      <p class="room-card__capacity">Capacity: ${escapeHtml(room.capacity)} seats</p>
      ${assignmentHtml}
      <div class="room-card__status">${occupied ? 'Occupied' : 'Available'}</div>
      <p class="room-card__source">${occupied ? 'Currently scheduled' : 'No class scheduled now'}</p>
    `;
    grid.appendChild(card);
  });
}

async function loadRooms() {
  const grid = document.getElementById('roomsGrid');
  const empty = document.getElementById('roomsEmpty');
  if (grid && rooms.length === 0) {
    grid.innerHTML = '<p style="padding:24px;">Loading room availability…</p>';
  }

  try {
    const data = await API.getRoomAvailability();
    rooms = Array.isArray(data) ? data : (data.rooms || []);
    updateStats();
    renderRooms();
  } catch (error) {
    console.error('[Room Availability]', error);
    rooms = [];
    updateStats();
    if (grid) grid.innerHTML = '<p style="padding:24px;">Unable to load live room availability.</p>';
    if (empty) empty.style.display = 'none';
  }
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
    tab.classList.add('filter-tab--active');
    activeFilter = tab.dataset.filter;
    renderRooms();
  });
});

document.querySelectorAll('.type-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('type-tab--active'));
    tab.classList.add('type-tab--active');
    activeType = tab.dataset.type;
    renderRooms();
  });
});

document.getElementById('searchInput')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderRooms();
});

loadRooms();
refreshTimer = window.setInterval(loadRooms, 60000);

window.addEventListener('beforeunload', () => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});
