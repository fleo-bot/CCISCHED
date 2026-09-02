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
// ─────────────────────────────────────────────
const FACULTY = [
  { id: 'FAC-001', name: 'Dr. Maria Santos',      gender: 'female', dept: 'BSIT', currentLoad: 3 },
  { id: 'FAC-002', name: 'Prof. James Reyes',     gender: 'male',   dept: 'BSIT', currentLoad: 2 },
  { id: 'FAC-003', name: 'Dr. Ana Cruz',           gender: 'female', dept: 'BSIT', currentLoad: 1 },
  { id: 'FAC-004', name: 'Prof. Rico Mendoza',    gender: 'male',   dept: 'BSIT', currentLoad: 0 },
  { id: 'FAC-005', name: 'Ms. Laura Bautista',    gender: 'female', dept: 'BSIT', currentLoad: 0 },
  { id: 'FAC-006', name: 'Mr. Carlo Dela Cruz',   gender: 'male',   dept: 'BSIT', currentLoad: 0 },
  { id: 'FAC-007', name: 'Dr. Patricia Lim',      gender: 'female', dept: 'BSIT', currentLoad: 0 },
  { id: 'FAC-008', name: 'Prof. Edwin Torres',    gender: 'male',   dept: 'BSIT', currentLoad: 0 },
  { id: 'FAC-009', name: 'Dr. Kevin Aquino',      gender: 'male',   dept: 'BSCS', currentLoad: 4 },
  { id: 'FAC-010', name: 'Prof. Janet Garcia',    gender: 'female', dept: 'BSCS', currentLoad: 3 },
  { id: 'FAC-011', name: 'Dr. Robert Villanueva', gender: 'male',   dept: 'BSCS', currentLoad: 3 },
  { id: 'FAC-012', name: 'Ms. Tricia Ramos',      gender: 'female', dept: 'BSCS', currentLoad: 2 },
  { id: 'FAC-013', name: 'Mr. Dennis Ocampo',     gender: 'male',   dept: 'BSCS', currentLoad: 0 },
  { id: 'FAC-014', name: 'Dr. Luz Fernandez',     gender: 'female', dept: 'BSCS', currentLoad: 0 },
  { id: 'FAC-015', name: 'Prof. Mark Domingo',    gender: 'male',   dept: 'BSCS', currentLoad: 0 },
];

// Courses start unassigned; assignedTo tracks the faculty ID once assigned
const COURSES = [
  { id: 'CRS-001', code: 'IT 401', name: 'Capstone Project 1',        dept: 'BSIT', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-002', code: 'IT 304', name: 'Programming Languages',     dept: 'BSIT', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-003', code: 'IT 412', name: 'Data Science & Analytics',  dept: 'BSIT', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-004', code: 'IT 211', name: 'Web Development',           dept: 'BSIT', units: 3, type: 'Laboratory', assignedTo: null },
  { id: 'CRS-005', code: 'IT 315', name: 'Database Administration',   dept: 'BSIT', units: 3, type: 'Laboratory', assignedTo: null },
  { id: 'CRS-006', code: 'IT 322', name: 'Network Security',          dept: 'BSIT', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-007', code: 'CS 401', name: 'Algorithm Design',          dept: 'BSCS', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-008', code: 'CS 312', name: 'Machine Learning',          dept: 'BSCS', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-009', code: 'CS 215', name: 'Operating Systems',         dept: 'BSCS', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-010', code: 'CS 408', name: 'Compiler Design',           dept: 'BSCS', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-011', code: 'CS 320', name: 'Software Engineering',      dept: 'BSCS', units: 3, type: 'Lecture', assignedTo: null },
  { id: 'CRS-012', code: 'CS 218', name: 'Computer Architecture Lab', dept: 'BSCS', units: 1, type: 'Laboratory', assignedTo: null },
];

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let activeDept      = 'all';
let selectedCourse  = null;
let searchQuery     = '';
let assignedCount   = 0; // tracks session assignments

// ─────────────────────────────────────────────
//  STATS
// ─────────────────────────────────────────────
function updateStats() {
  const unassigned = COURSES.filter(c => !c.assignedTo).length;
  document.getElementById('statUnassigned').textContent = unassigned;
  document.getElementById('statAssigned').textContent   = assignedCount;
  document.getElementById('statFaculty').textContent    = FACULTY.length;
}

// ─────────────────────────────────────────────
//  RENDER COURSES LIST
// ─────────────────────────────────────────────
function renderCourses() {
  const list = document.getElementById('coursesList');
  list.innerHTML = '';

  const filtered = COURSES.filter(c => {
    const matchDept   = activeDept === 'all' || c.dept === activeDept;
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align:center;padding:32px;color:rgba(128,0,0,0.40);font-weight:600;font-size:0.88rem;">No courses found.</p>';
    return;
  }

  filtered.forEach(course => {
    const isAssigned = !!course.assignedTo;
    const isSelected = selectedCourse?.id === course.id;

    const card = document.createElement('div');
    card.className = `course-card${isAssigned ? ' course-card--assigned' : ''}${isSelected ? ' course-card--selected' : ''}`;
    card.dataset.id = course.id;

    const assignedFaculty = isAssigned ? FACULTY.find(f => f.id === course.assignedTo) : null;

    card.innerHTML = `
      <div class="course-info">
        <p class="course-code">${course.code}</p>
        <p class="course-name">${course.name}</p>
        <p class="course-meta">${course.units} units · ${course.type}</p>
      </div>
      <div class="course-right">
        <span class="dept-tag dept-tag--${course.dept.toLowerCase()}">${course.dept}</span>
        ${isAssigned
          ? `<span class="assigned-tag">Assigned${assignedFaculty ? ` · ${assignedFaculty.name.split(' ').slice(-1)[0]}` : ''}</span>`
          : ''}
      </div>
    `;

    if (!isAssigned) {
      card.addEventListener('click', () => selectCourse(course));
    }

    list.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  SELECT COURSE → open assignment panel
// ─────────────────────────────────────────────
function selectCourse(course) {
  selectedCourse = course;
  renderCourses(); // re-render to apply selected style

  document.getElementById('assignEmpty').style.display = 'none';
  document.getElementById('assignForm').style.display  = 'flex';

  // Fill course info
  document.getElementById('selectedCourseInfo').innerHTML = `
    <p class="selected-course__label">Selected Course</p>
    <p class="selected-course__name">${course.name}</p>
    <p class="selected-course__meta">${course.code} · ${course.units} units · ${course.type} · ${course.dept}</p>
  `;

  // Populate faculty select — show all faculty (dept match first)
  const select = document.getElementById('facultySelect');
  select.innerHTML = '<option value="">— Select faculty member —</option>';

  const sorted = [...FACULTY].sort((a, b) => {
    if (a.dept === course.dept && b.dept !== course.dept) return -1;
    if (b.dept === course.dept && a.dept !== course.dept) return 1;
    return a.currentLoad - b.currentLoad;
  });

  sorted.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.name} (${f.dept} · ${f.currentLoad} course${f.currentLoad !== 1 ? 's' : ''})`;
    select.appendChild(opt);
  });

  // Reset state
  document.getElementById('facultyPreview').style.display = 'none';
  document.getElementById('confirmAssignBtn').disabled     = true;
}

// ─────────────────────────────────────────────
//  FACULTY SELECT CHANGE
// ─────────────────────────────────────────────
document.getElementById('facultySelect')?.addEventListener('change', e => {
  const facultyId = e.target.value;
  const preview   = document.getElementById('facultyPreview');
  const btn       = document.getElementById('confirmAssignBtn');

  if (!facultyId) {
    preview.style.display = 'none';
    btn.disabled = true;
    return;
  }

  const faculty = FACULTY.find(f => f.id === facultyId);
  if (!faculty) return;

  preview.style.display = 'flex';
  preview.innerHTML = `
    <div class="faculty-preview__avatar">
      <img src="../assets/images/avatar-${faculty.gender}.svg" alt="${faculty.name}" />
    </div>
    <div>
      <p class="faculty-preview__name">${faculty.name}</p>
      <p class="faculty-preview__load">${faculty.dept} · Current load: ${faculty.currentLoad} course${faculty.currentLoad !== 1 ? 's' : ''}</p>
    </div>
  `;

  btn.disabled = false;
});

// ─────────────────────────────────────────────
//  CONFIRM ASSIGNMENT
// ─────────────────────────────────────────────
document.getElementById('confirmAssignBtn')?.addEventListener('click', () => {
  const facultyId = document.getElementById('facultySelect').value;
  if (!facultyId || !selectedCourse) return;

  const course  = COURSES.find(c => c.id === selectedCourse.id);
  const faculty = FACULTY.find(f => f.id === facultyId);
  if (!course || !faculty) return;

  // Apply assignment
  course.assignedTo  = facultyId;
  faculty.currentLoad += 1;
  assignedCount       += 1;

  // Reset panel
  selectedCourse = null;
  document.getElementById('assignForm').style.display  = 'none';
  document.getElementById('assignEmpty').style.display = 'flex';

  // Refresh
  updateStats();
  renderCourses();

  showToast(`✓ ${course.name} assigned to ${faculty.name}`);
});

// ─────────────────────────────────────────────
//  CANCEL
// ─────────────────────────────────────────────
document.getElementById('cancelBtn')?.addEventListener('click', () => {
  selectedCourse = null;
  document.getElementById('assignForm').style.display  = 'none';
  document.getElementById('assignEmpty').style.display = 'flex';
  renderCourses();
});

// ─────────────────────────────────────────────
//  DEPARTMENT FILTER CHIPS
// ─────────────────────────────────────────────
document.querySelectorAll('.dept-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.dept-chip').forEach(c => c.classList.remove('dept-chip--active'));
    chip.classList.add('dept-chip--active');
    activeDept = chip.dataset.dept;
    renderCourses();
  });
});

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
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
  // Force reflow
  void toast.offsetWidth;
  toast.classList.add('toast--show');
  setTimeout(() => toast.classList.remove('toast--show'), 3000);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
updateStats();
renderCourses();
