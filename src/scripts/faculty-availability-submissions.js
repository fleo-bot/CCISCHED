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
//  DATA
//  In production this would come from the API.
//  "submitted" faculty have a submittedOn date;
//  "pending" faculty have submittedOn = null.
// ─────────────────────────────────────────────
const SUBMISSIONS = [
  { id: 'FAC-001', name: 'Dr. Maria Santos',      gender: 'female', dept: 'BSIT', status: 'submitted', submittedOn: 'Aug 28, 2026' },
  { id: 'FAC-002', name: 'Prof. James Reyes',     gender: 'male',   dept: 'BSIT', status: 'submitted', submittedOn: 'Aug 29, 2026' },
  { id: 'FAC-003', name: 'Dr. Ana Cruz',           gender: 'female', dept: 'BSIT', status: 'submitted', submittedOn: 'Aug 27, 2026' },
  { id: 'FAC-004', name: 'Prof. Rico Mendoza',    gender: 'male',   dept: 'BSIT', status: 'submitted', submittedOn: 'Aug 30, 2026' },
  { id: 'FAC-005', name: 'Ms. Laura Bautista',    gender: 'female', dept: 'BSIT', status: 'pending',   submittedOn: null },
  { id: 'FAC-006', name: 'Mr. Carlo Dela Cruz',   gender: 'male',   dept: 'BSIT', status: 'pending',   submittedOn: null },
  { id: 'FAC-007', name: 'Dr. Patricia Lim',      gender: 'female', dept: 'BSIT', status: 'submitted', submittedOn: 'Aug 31, 2026' },
  { id: 'FAC-008', name: 'Prof. Edwin Torres',    gender: 'male',   dept: 'BSIT', status: 'pending',   submittedOn: null },
  { id: 'FAC-009', name: 'Dr. Kevin Aquino',      gender: 'male',   dept: 'BSCS', status: 'submitted', submittedOn: 'Aug 28, 2026' },
  { id: 'FAC-010', name: 'Prof. Janet Garcia',    gender: 'female', dept: 'BSCS', status: 'submitted', submittedOn: 'Sep 1, 2026' },
  { id: 'FAC-011', name: 'Dr. Robert Villanueva', gender: 'male',   dept: 'BSCS', status: 'submitted', submittedOn: 'Aug 29, 2026' },
  { id: 'FAC-012', name: 'Ms. Tricia Ramos',      gender: 'female', dept: 'BSCS', status: 'submitted', submittedOn: 'Aug 30, 2026' },
  { id: 'FAC-013', name: 'Mr. Dennis Ocampo',     gender: 'male',   dept: 'BSCS', status: 'pending',   submittedOn: null },
  { id: 'FAC-014', name: 'Dr. Luz Fernandez',     gender: 'female', dept: 'BSCS', status: 'submitted', submittedOn: 'Sep 1, 2026' },
  { id: 'FAC-015', name: 'Prof. Mark Domingo',    gender: 'male',   dept: 'BSCS', status: 'pending',   submittedOn: null },
];

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';

// ─────────────────────────────────────────────
//  UPDATE SUMMARY STATS
// ─────────────────────────────────────────────
function updateStats() {
  const total     = SUBMISSIONS.length;
  const submitted = SUBMISSIONS.filter(f => f.status === 'submitted').length;
  const pending   = total - submitted;
  const rate      = Math.round((submitted / total) * 100);

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statSubmitted').textContent = submitted;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statRate').textContent      = rate + '%';

  // Also sync dashboard notification badge on the pending stat
  // (For demo purposes only — in production this comes from shared state)
}

// ─────────────────────────────────────────────
//  RENDER TABLE
// ─────────────────────────────────────────────
function renderTable() {
  const tbody      = document.getElementById('submissionsTableBody');
  const emptyState = document.getElementById('emptyState');
  tbody.innerHTML  = '';

  const filtered = SUBMISSIONS.filter(f => {
    const matchesFilter = activeFilter === 'all' || f.status === activeFilter;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  filtered.forEach(f => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <div class="td-faculty">
          <div class="td-avatar">
            <img src="../assets/images/avatar-${f.gender}.svg" alt="${f.name}" />
          </div>
          <div>
            <p class="td-name">${f.name}</p>
            <p class="td-id">${f.id}</p>
          </div>
        </div>
      </td>
      <td>
        <span class="dept-badge dept-badge--${f.dept.toLowerCase()}">${f.dept}</span>
      </td>
      <td style="font-size:0.85rem; color:${f.submittedOn ? '#333' : 'rgba(128,0,0,0.35)'};">
        ${f.submittedOn || '—'}
      </td>
      <td>
        <span class="status-badge status-badge--${f.status}">
          ${f.status === 'submitted' ? 'Submitted' : 'Pending'}
        </span>
      </td>
      <td>
        <button class="view-btn" onclick="window.location.href='submission-detail.html?id=${encodeURIComponent(f.id)}'">
          View
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
//  FILTER TABS
// ─────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
    tab.classList.add('filter-tab--active');
    activeFilter = tab.dataset.filter;
    renderTable();
  });
});

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
document.getElementById('searchInput')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderTable();
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
updateStats();
renderTable();
