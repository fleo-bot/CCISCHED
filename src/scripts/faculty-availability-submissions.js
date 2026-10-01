'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  DATA
//  This page used to contain a hard-coded SUBMISSIONS array.  That meant
//  the table could never reflect the MySQL database.
//
//  We now load:
//    1. /api/manage/faculty       -> every faculty account
//    2. /api/availability/all     -> submissions + availability_slots
//
//  The two responses are merged by faculty_id so faculty with no submission
//  still appear as Pending.
// ─────────────────────────────────────────────
let SUBMISSIONS = [];
let activeFilter = 'all';
let searchQuery  = '';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function departmentCode(faculty) {
  const raw = String(faculty?.department || '').trim();
  const value = raw.toLowerCase();

  // Supports both the seeded values (IT/CS) and full department names.
  if (value === 'it' || value.includes('information technology')) return 'BSIT';
  if (value === 'cs' || value.includes('computer science')) return 'BSCS';
  if (value === 'is' || value.includes('information systems')) return 'BSIS';

  // If your database already stores BSIT/BSCS, keep that value.
  if (/^bs(it|cs|is)$/i.test(raw)) return raw.toUpperCase();

  return raw || 'CCIS';
}

function normalizeStatus(submission) {
  // The list page has only two filters: Submitted and Pending.
  // A faculty is considered submitted once they have a non-pending
  // submission (submitted/approved/rejected/returned).
  return submission && submission.status && submission.status !== 'pending'
    ? 'submitted'
    : 'pending';
}

function formatSubmittedDate(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

async function loadSubmissions() {
  const [facultyList, submissionResponse] = await Promise.all([
    API.getFacultyList(),
    API.getAllSubmissions(),
  ]);

  const submissions = submissionResponse?.submissions || [];
  const byFacultyId = new Map(
    submissions.map(submission => [Number(submission.faculty_id), submission])
  );

  // Build one row per faculty, not one row per submission.
  // This is important because a faculty member without an
  // availability_submissions row must still appear as Pending.
  SUBMISSIONS = (Array.isArray(facultyList) ? facultyList : []).map(faculty => {
    const submission = byFacultyId.get(Number(faculty.id)) || null;
    const displayStatus = normalizeStatus(submission);

    return {
      id: faculty.id,
      submissionId: submission?.id ?? null,
      employeeNumber: faculty.employee_number || '',
      name: faculty.full_name || `${faculty.first_name || ''} ${faculty.last_name || ''}`.trim(),
      gender: (faculty.gender || 'male').toLowerCase(),
      dept: departmentCode(faculty),
      status: displayStatus,
      backendStatus: submission?.status || 'pending',
      submittedOn: formatSubmittedDate(submission?.submitted_at),
    };
  });

  updateStats();
  renderTable();
}

// ─────────────────────────────────────────────
//  UPDATE SUMMARY STATS
// ─────────────────────────────────────────────
function updateStats() {
  const total     = SUBMISSIONS.length;
  const submitted = SUBMISSIONS.filter(f => f.status === 'submitted').length;
  const pending   = SUBMISSIONS.filter(f => f.status === 'pending').length;
  const rate      = total ? Math.round((submitted / total) * 100) : 0;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statSubmitted').textContent = submitted;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statRate').textContent      = rate + '%';
}

// ─────────────────────────────────────────────
//  RENDER TABLE
// ─────────────────────────────────────────────
function renderTable() {
  const tbody      = document.getElementById('submissionsTableBody');
  const emptyState = document.getElementById('emptyState');

  if (!tbody || !emptyState) return;
  tbody.innerHTML = '';

  const query = searchQuery.trim().toLowerCase();

  const filtered = SUBMISSIONS.filter(f => {
    const matchesFilter = activeFilter === 'all' || f.status === activeFilter;
    const matchesSearch =
      f.name.toLowerCase().includes(query) ||
      String(f.employeeNumber).toLowerCase().includes(query) ||
      String(f.id).toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  filtered.forEach(f => {
    const tr = document.createElement('tr');
    const avatarGender = f.gender === 'female' ? 'female' : 'male';
    const hasSubmission = Number.isFinite(Number(f.submissionId));

    const actionHTML = hasSubmission
      ? `<button class="view-btn" onclick="window.location.href='submission-detail.html?id=${encodeURIComponent(f.submissionId)}'">View</button>`
      : `<button class="view-btn" disabled title="No availability submission yet">View</button>`;

    tr.innerHTML = `
      <td>
        <div class="td-faculty">
          <div class="td-avatar">
            <img src="../assets/images/avatar-${avatarGender}.svg" alt="${esc(f.name)}" />
          </div>
          <div>
            <p class="td-name">${esc(f.name)}</p>
            <p class="td-id">${esc(f.employeeNumber || `FAC-${String(f.id).padStart(3, '0')}`)}</p>
          </div>
        </div>
      </td>
      <td>
        <span class="dept-badge dept-badge--${esc(f.dept.toLowerCase())}">${esc(f.dept)}</span>
      </td>
      <td style="font-size:0.85rem; color:${f.submittedOn ? '#333' : 'rgba(128,0,0,0.35)'};">
        ${esc(f.submittedOn || '—')}
      </td>
      <td>
        <span class="status-badge status-badge--${f.status}">
          ${f.status === 'submitted' ? 'Submitted' : 'Pending'}
        </span>
      </td>
      <td>${actionHTML}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
//  FILTER TABS
// ─────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t =>
      t.classList.remove('filter-tab--active')
    );

    tab.classList.add('filter-tab--active');
    activeFilter = tab.dataset.filter;
    renderTable();
  });
});

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
document.getElementById('searchInput')?.addEventListener('input', event => {
  searchQuery = event.target.value;
  renderTable();
});

// ─────────────────────────────────────────────
//  INIT — wait for auth-check.js, then load real data
// ─────────────────────────────────────────────
let _submissionsLoaded = false;
async function initSubmissions() {
  if (_submissionsLoaded) return;
  _submissionsLoaded = true;
  try {
    await loadSubmissions();
  } catch (err) {
    console.error('Failed to load faculty submissions:', err);
    const empty = document.getElementById('emptyState');
    if (empty) {
      empty.textContent = 'Could not load submissions. Please refresh the page.';
      empty.style.display = 'block';
    }
  }
}
document.addEventListener('authReady', initSubmissions);
