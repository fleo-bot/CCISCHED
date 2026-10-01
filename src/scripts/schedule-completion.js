'use strict';

const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  topbarDate.textContent = `${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

let activeDept = 'bsit';
let FACULTY = [];
let TOTALS = { total_courses: 0, assigned_courses: 0 };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function facultyProgram(member) {
  if (member.program === 'BSIT' || member.program === 'BSCS') return member.program;
  const dept = String(member.department || '').toLowerCase();
  if (dept === 'it' || dept === 'bsit' || dept.includes('information technology')) return 'BSIT';
  if (dept === 'cs' || dept === 'bscs' || dept.includes('computer science')) return 'BSCS';
  return null;
}

function filteredFaculty() {
  return FACULTY.filter(member => facultyProgram(member) === activeDept.toUpperCase());
}

function updateSummary() {
  const visible = filteredFaculty();
  const dept = activeDept.toUpperCase();

  document.getElementById('totalFaculty').textContent = visible.length;

  const deptTotal = Number(TOTALS.by_program?.[dept]?.total_courses ?? 0);
  const deptAssigned = Number(TOTALS.by_program?.[dept]?.assigned_courses ?? 0);

  document.getElementById('totalCourses').textContent = deptTotal;
  document.getElementById('assignedCourses').textContent = deptAssigned;
  document.getElementById('completionPct').textContent =
    deptTotal ? `${Math.round((deptAssigned / deptTotal) * 100)}%` : '0%';
}

function openCourseModal(member) {
  const modal = document.getElementById('courseDetailsModal');
  if (!modal) return;

  document.getElementById('courseDetailsName').textContent = member.name;
  document.getElementById('courseDetailsId').textContent = member.employee_number || '';

  const list = document.getElementById('courseDetailsList');
  // A faculty member's details should show every course assigned to them,
  // including common courses whose offering may span BSIT/BSCS.
  const courses = (member.courses || [])
    .sort((a, b) => a.code.localeCompare(b.code));

  if (!courses.length) {
    list.innerHTML = '<div class="course-details-empty">No courses are currently assigned to this faculty member.</div>';
  } else {
    list.innerHTML = courses.map(course => `
      <div class="course-detail-row">
        <div>
          <p class="course-detail-code">${escapeHtml(course.code)}</p>
          <p class="course-detail-name">${escapeHtml(course.name)}</p>
          <p class="course-detail-sections">Sections: ${escapeHtml((course.sections || []).join(', ') || '—')}</p>
        </div>
        <div class="course-detail-meta">
          <strong>${escapeHtml(course.units)}</strong>
          <span>units</span>
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCourseModal() {
  const modal = document.getElementById('courseDetailsModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function render() {
  const list = document.getElementById('facultyList');
  const visible = filteredFaculty();
  list.innerHTML = '';

  if (!visible.length) {
    list.innerHTML = '<div class="faculty-empty">No faculty members found for this department.</div>';
    updateSummary();
    return;
  }

  visible.forEach(member => {
    const assigned = (member.courses || []).length;
    const item = document.createElement('div');
    item.className = 'faculty-item';
    const gender = member.gender === 'male' ? 'male' : 'female';

    item.innerHTML = `
      <div class="faculty-info">
        <div class="faculty-avatar">
          <img src="../assets/images/avatar-${gender}.svg" alt="${escapeHtml(member.name)}" />
        </div>
        <div class="faculty-details">
          <p class="faculty-name">${escapeHtml(member.name)}</p>
          <p class="faculty-id">${escapeHtml(member.employee_number || `FAC-${String(member.id).padStart(3, '0')}`)}</p>
        </div>
      </div>
      <div class="faculty-courses">
        <div class="course-count">
          <p class="course-count__number">${assigned}</p>
          <p class="course-count__label">Assigned</p>
        </div>
        <button class="view-details-btn" type="button">View Details</button>
      </div>
    `;

    item.querySelector('.view-details-btn').addEventListener('click', () => openCourseModal(member));
    list.appendChild(item);
  });

  updateSummary();
}

async function loadPage() {
  const list = document.getElementById('facultyList');
  list.innerHTML = '<div class="faculty-empty">Loading faculty and assignments...</div>';

  try {
    const data = await API.getFacultyCourseAssignments();
    FACULTY = Array.isArray(data.faculty) ? data.faculty : [];
    TOTALS = data.totals || {};
    render();
  } catch (error) {
    console.error('Unable to load schedule completion data:', error);
    list.innerHTML = '<div class="faculty-empty faculty-empty--error">Unable to load faculty assignments. Please refresh and try again.</div>';
  }
}

document.querySelectorAll('.dept-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dept-tab').forEach(t => t.classList.remove('dept-tab--active'));
    tab.classList.add('dept-tab--active');
    activeDept = tab.dataset.dept;
    render();
  });
});

document.getElementById('courseDetailsClose')?.addEventListener('click', closeCourseModal);
document.getElementById('courseDetailsModal')?.addEventListener('click', event => {
  if (event.target.id === 'courseDetailsModal') closeCourseModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeCourseModal();
});

loadPage();
