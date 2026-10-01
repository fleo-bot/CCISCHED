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
//  DATA — loaded from the real backend
// ─────────────────────────────────────────────
let facultySubmissions = [];

async function loadSubmissions() {
  try {
    const [subsResult, faculty] = await Promise.all([
      API.getAllSubmissions(),
      API.getFacultyList().catch(() => []),
    ]);

    const typeByFacultyId = {};
    faculty.forEach(f => { typeByFacultyId[f.id] = f.employment_type || 'Full Time'; });

    facultySubmissions = (subsResult.submissions || []).map(s => ({
      id:            s.id,
      faculty_id:    s.faculty_id,
      faculty_name:  s.faculty_name || 'Unknown',
      type:          typeByFacultyId[s.faculty_id] || 'Faculty',
      status:        s.status,
      submittedDate: s.submitted_at
        ? new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null,
      submittedAtRaw: s.submitted_at,
      // Same grouping the detail page uses, so the two always agree
      slotCount:     AvailabilityUtils.buildSlotCards(s.slots || [], { merge: true }).length,
    }));

    renderStats();
    renderTable(activeFilter, searchQuery, sortBy);
  } catch (err) {
    console.error('[Submissions] Failed to load:', err);
  }
}

// ─────────────────────────────────────────────
//  SUMMARY CHIPS
// ─────────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('csSummaryChips');
  if (!el) return;

  const total     = facultySubmissions.length;
  const submitted = facultySubmissions.filter(f => f.status === 'submitted').length;
  const approved  = facultySubmissions.filter(f => f.status === 'approved').length;
  const pending   = facultySubmissions.filter(f => f.status === 'pending').length;

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
//  STATUS BADGE
// ─────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    approved:  `<span class="cs-status cs-status--approved">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Approved
                </span>`,
    submitted: `<span class="cs-status cs-status--submitted">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Submitted
                </span>`,
    returned:  `<span class="cs-status cs-status--returned">↑ Returned</span>`,
    rejected:  `<span class="cs-status cs-status--rejected">✗ Rejected</span>`,
    pending:   `<span class="cs-status cs-status--pending">⏳ Pending</span>`,
  };
  return map[status] || map.pending;
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
function renderTable(filter = 'all', query = '', sort = 'name') {
  const body    = document.getElementById('csBody');
  const countEl = document.getElementById('csCount');
  if (!body) return;

  const q = query.trim().toLowerCase();

  let filtered = facultySubmissions.filter(f => {
    const matchStatus = filter === 'all' || f.status === filter;
    const matchQuery  = !q || f.faculty_name.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  filtered = filtered.slice().sort((a, b) => {
    if (sort === 'date') {
      // Undated (never submitted) entries sort last
      if (!a.submittedAtRaw && !b.submittedAtRaw) return a.faculty_name.localeCompare(b.faculty_name);
      if (!a.submittedAtRaw) return 1;
      if (!b.submittedAtRaw) return -1;
      return new Date(b.submittedAtRaw) - new Date(a.submittedAtRaw);   // newest first
    }
    return a.faculty_name.localeCompare(b.faculty_name);
  });

  if (countEl) countEl.textContent = `${filtered.length} faculty`;

  if (!filtered.length) {
    body.innerHTML = `<div class="cs-empty"><p>No submissions match the current filter.</p></div>`;
    return;
  }

  body.innerHTML = filtered.map(f => `
    <div class="cs-row">
      <div class="cs-row__name">
        <div class="cs-row__avatar">${initials(f.faculty_name)}</div>
        <div><p class="cs-row__name-text">${f.faculty_name}</p></div>
      </div>
      <span class="cs-row__type">${f.type}</span>
      <div class="cs-row__slots">
        <span class="cs-slot-count ${f.slotCount === 0 ? 'cs-slot-count--zero' : ''}">${f.slotCount}</span>
      </div>
      <div class="cs-row__status">${statusBadge(f.status)}</div>
      <span class="cs-row__date">${f.submittedDate || '—'}</span>
      <div class="cs-row__actions">
        <button class="cs-view-btn" data-view="${f.id}" title="View details">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          View
        </button>
        <button class="cs-delete-btn" data-delete="${f.id}" data-name="${f.faculty_name}" title="Delete submission">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M6 4V2.7a.7.7 0 01.7-.7h2.6a.7.7 0 01.7.7V4M12.3 4l-.6 9.3a1 1 0 01-1 .9H5.3a1 1 0 01-1-.9L3.7 4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `submission-detail.html?id=${btn.dataset.view}`;
    });
  });

  body.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete, btn.dataset.name));
  });
}

async function handleDelete(submissionId, name) {
  if (!confirm(`Delete ${name}'s availability submission? This cannot be undone.`)) return;

  try {
    await API.deleteSubmission(submissionId);
    facultySubmissions = facultySubmissions.filter(f => String(f.id) !== String(submissionId));
    renderStats();
    renderTable(activeFilter, searchQuery, sortBy);
    showToast(`${name}'s submission deleted.`);
  } catch (err) {
    showToast('Failed to delete submission: ' + err.message);
  }
}

// ─────────────────────────────────────────────
//  FILTER + SEARCH + SORT
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';
let sortBy       = 'name';

document.getElementById('statusFilter')?.addEventListener('change', function () {
  activeFilter = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
});

document.getElementById('sortBy')?.addEventListener('change', function () {
  sortBy = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
});

document.getElementById('searchInput')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
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
