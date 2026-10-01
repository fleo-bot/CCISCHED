'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  LIVE DATABASE STATE
// ─────────────────────────────────────────────
let FACULTY = [];
let COURSES = [];
let activeDept = 'all';
let activeStatus = 'all';   // all | unassigned | assigned
let selectedCourse = null;
let searchQuery = '';

function getCourseType(course) {
  return course.type || 'Lecture';
}

function getFacultyById(id) {
  return FACULTY.find(f => Number(f.id) === Number(id));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

// ─────────────────────────────────────────────
//  STATS — calculated from the backend response
// ─────────────────────────────────────────────
function updateStats() {
  const unassigned = COURSES.filter(c => c.status !== 'assigned').length;
  const assigned = COURSES.filter(c => c.status === 'assigned').length;

  document.getElementById('statUnassigned').textContent = unassigned;
  document.getElementById('statAssigned').textContent = assigned;
  document.getElementById('statFaculty').textContent = FACULTY.length;
}

// ─────────────────────────────────────────────
//  RENDER COURSES
// ─────────────────────────────────────────────
function renderCourses() {
  const list = document.getElementById('coursesList');
  if (!list) return;

  list.innerHTML = '';

  const query = searchQuery.trim().toLowerCase();
  const filtered = COURSES.filter(course => {
    const matchDept = activeDept === 'all' || course.dept === activeDept;
    const matchSearch = !query ||
      String(course.name || '').toLowerCase().includes(query) ||
      String(course.code || '').toLowerCase().includes(query);
    const isAssigned = course.status === 'assigned';
    const matchStatus = activeStatus === 'all' ||
      (activeStatus === 'assigned' ? isAssigned : !isAssigned);
    return matchDept && matchSearch && matchStatus;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <p style="text-align:center;padding:32px;color:rgba(128,0,0,0.40);font-weight:600;font-size:0.88rem;">
        No courses found.
      </p>`;
    return;
  }

  filtered.forEach(course => {
    const isAssigned = course.status === 'assigned';
    const isSelected = selectedCourse?.id === course.id;
    const assignedFaculty = course.assignedTo ? getFacultyById(course.assignedTo) : null;

    const card = document.createElement('div');
    card.className = `course-card${isAssigned ? ' course-card--assigned' : ''}${isSelected ? ' course-card--selected' : ''}`;
    card.dataset.id = course.id;

    const assignmentLabel = isAssigned
      ? `Assigned${assignedFaculty ? ` · ${escapeHtml(assignedFaculty.name.split(' ').slice(-1)[0])}` : ''}`
      : '';


    card.innerHTML = `
      <div class="course-info">
        <p class="course-code">${escapeHtml(course.code)}</p>
        <p class="course-name">${escapeHtml(course.name)}</p>
        <p class="course-meta">${escapeHtml(course.units)} units · ${escapeHtml(getCourseType(course))}</p>
      </div>
      <div class="course-right">
        <span class="dept-tag dept-tag--${escapeHtml(String(course.dept).toLowerCase())}">${escapeHtml(course.dept)}</span>
        ${assignmentLabel ? `<span class="assigned-tag">${assignmentLabel}</span>` : ''}
      </div>
    `;

    // Assigned courses remain selectable so the chairperson can edit/reassign them.
    card.addEventListener('click', () => selectCourse(course));
    list.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  SELECT COURSE
// ─────────────────────────────────────────────
function selectCourse(course) {
  selectedCourse = course;
  renderCourses();

  document.getElementById('assignEmpty').style.display = 'none';
  document.getElementById('assignForm').style.display = 'flex';

  document.getElementById('selectedCourseInfo').innerHTML = `
    <p class="selected-course__label">Selected Course</p>
    <p class="selected-course__name">${escapeHtml(course.name)}</p>
    <p class="selected-course__meta">
      ${escapeHtml(course.code)} · ${escapeHtml(course.units)} units ·
      ${escapeHtml(getCourseType(course))} · ${escapeHtml(course.dept)}
    </p>
  `;

  const select = document.getElementById('facultySelect');
  select.innerHTML = '<option value="">— Select faculty member —</option>';

  const sorted = [...FACULTY].sort((a, b) => {
    if (a.dept === course.dept && b.dept !== course.dept) return -1;
    if (b.dept === course.dept && a.dept !== course.dept) return 1;
    return (a.currentLoad || 0) - (b.currentLoad || 0) || a.name.localeCompare(b.name);
  });

  sorted.forEach(faculty => {
    const opt = document.createElement('option');
    opt.value = faculty.id;
    opt.textContent = `${faculty.name} (${faculty.dept} · ${faculty.currentLoad} course${faculty.currentLoad !== 1 ? 's' : ''})`;
    if (Number(course.assignedTo) === Number(faculty.id)) opt.selected = true;
    select.appendChild(opt);
  });

  // Show the existing assignment immediately when editing an assigned course.
  if (course.assignedTo) {
    showFacultyPreview(String(course.assignedTo));
  } else {
    document.getElementById('facultyPreview').style.display = 'none';
    document.getElementById('confirmAssignBtn').disabled = true;
  }
}

// ─────────────────────────────────────────────
//  FACULTY PREVIEW
// ─────────────────────────────────────────────
function showFacultyPreview(facultyId) {
  const preview = document.getElementById('facultyPreview');
  const btn = document.getElementById('confirmAssignBtn');
  const faculty = getFacultyById(facultyId);

  if (!faculty) {
    preview.style.display = 'none';
    btn.disabled = true;
    return;
  }

  preview.style.display = 'flex';
  preview.innerHTML = `
    <div class="faculty-preview__avatar">
      <img src="../assets/images/avatar-${escapeHtml(faculty.gender || 'female')}.svg" alt="${escapeHtml(faculty.name)}" />
    </div>
    <div>
      <p class="faculty-preview__name">${escapeHtml(faculty.name)}</p>
      <p class="faculty-preview__load">
        ${escapeHtml(faculty.dept)} · Current load: ${faculty.currentLoad || 0} course${faculty.currentLoad !== 1 ? 's' : ''}
      </p>
    </div>
  `;
  btn.disabled = false;
}

document.getElementById('facultySelect')?.addEventListener('change', e => {
  showFacultyPreview(e.target.value);
});

// ─────────────────────────────────────────────
//  SAVE ASSIGNMENT TO DATABASE
// ─────────────────────────────────────────────
document.getElementById('confirmAssignBtn')?.addEventListener('click', async () => {
  const facultyId = document.getElementById('facultySelect').value;
  if (!facultyId || !selectedCourse) return;

  const course = selectedCourse;
  const faculty = getFacultyById(facultyId);
  const btn = document.getElementById('confirmAssignBtn');

  if (!faculty) return;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await API.assignCourseToFaculty(course.id, Number(facultyId));

    showToast(`✓ ${course.name} assigned to ${faculty.name}`);
    await loadAssignmentData();

    selectedCourse = null;
    document.getElementById('assignForm').style.display = 'none';
    document.getElementById('assignEmpty').style.display = 'flex';
  } catch (err) {
    showToast(`Failed to assign course: ${err.message}`, true);
  } finally {
    btn.disabled = !document.getElementById('facultySelect').value;
    btn.textContent = 'Assign Course';
  }
});

// ─────────────────────────────────────────────
//  CANCEL
// ─────────────────────────────────────────────
document.getElementById('cancelBtn')?.addEventListener('click', () => {
  selectedCourse = null;
  document.getElementById('assignForm').style.display = 'none';
  document.getElementById('assignEmpty').style.display = 'flex';
  renderCourses();
});

// ─────────────────────────────────────────────
//  FILTERS + SEARCH
// ─────────────────────────────────────────────
document.querySelectorAll('#deptFilter .dept-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#deptFilter .dept-chip').forEach(c => c.classList.remove('dept-chip--active'));
    chip.classList.add('dept-chip--active');
    activeDept = chip.dataset.dept;
    renderCourses();
  });
});

document.querySelectorAll('#statusFilter .status-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#statusFilter .status-chip').forEach(c => c.classList.remove('dept-chip--active'));
    chip.classList.add('dept-chip--active');
    activeStatus = chip.dataset.status;
    renderCourses();
  });
});

document.getElementById('searchInput')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderCourses();
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast--error' : '');
  void toast.offsetWidth;
  toast.classList.add('toast--show');
  setTimeout(() => toast.classList.remove('toast--show'), 3000);
}

// ─────────────────────────────────────────────
//  LOAD LIVE DATA
// ─────────────────────────────────────────────
async function loadAssignmentData() {
  const list = document.getElementById('coursesList');
  if (list) {
    list.innerHTML = '<p style="text-align:center;padding:32px;color:rgba(128,0,0,0.40);font-weight:600;font-size:0.88rem;">Loading courses...</p>';
  }

  try {
    const data = await API.getCourseAssignments();
    FACULTY = Array.isArray(data.faculty) ? data.faculty : [];
    COURSES = Array.isArray(data.courses) ? data.courses : [];

    updateStats();
    renderCourses();
  } catch (err) {
    console.error('[Assign Courses] Failed to load:', err);
    if (list) {
      list.innerHTML = `
        <p style="text-align:center;padding:32px;color:#a00000;font-weight:600;font-size:0.88rem;">
          Failed to load courses from the backend.<br>
          <small>${escapeHtml(err.message)}</small>
        </p>`;
    }
    document.getElementById('statUnassigned').textContent = '—';
    document.getElementById('statAssigned').textContent = '—';
    document.getElementById('statFaculty').textContent = '—';
  }
}

loadAssignmentData();
