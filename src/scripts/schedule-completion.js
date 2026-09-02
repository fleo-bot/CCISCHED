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
//  DATA — courses assigned per faculty
// ─────────────────────────────────────────────
const DATA = {
  bsit: {
    totalCourses: 120,
    assignedCourses: 6,
    faculty: [
      { name: 'Dr. Maria Santos',    id: 'FAC-001', gender: 'female', assigned: 3 },
      { name: 'Prof. James Reyes',   id: 'FAC-002', gender: 'male',   assigned: 2 },
      { name: 'Dr. Ana Cruz',        id: 'FAC-003', gender: 'female', assigned: 1 },
      { name: 'Prof. Rico Mendoza',  id: 'FAC-004', gender: 'male',   assigned: 0 },
      { name: 'Ms. Laura Bautista',  id: 'FAC-005', gender: 'female', assigned: 0 },
      { name: 'Mr. Carlo Dela Cruz', id: 'FAC-006', gender: 'male',   assigned: 0 },
      { name: 'Dr. Patricia Lim',    id: 'FAC-007', gender: 'female', assigned: 0 },
      { name: 'Prof. Edwin Torres',  id: 'FAC-008', gender: 'male',   assigned: 0 },
    ],
  },
  bscs: {
    totalCourses: 100,
    assignedCourses: 12,
    faculty: [
      { name: 'Dr. Kevin Aquino',    id: 'FAC-009', gender: 'male',   assigned: 4 },
      { name: 'Prof. Janet Garcia',  id: 'FAC-010', gender: 'female', assigned: 3 },
      { name: 'Dr. Robert Villanueva', id: 'FAC-011', gender: 'male', assigned: 3 },
      { name: 'Ms. Tricia Ramos',    id: 'FAC-012', gender: 'female', assigned: 2 },
      { name: 'Mr. Dennis Ocampo',   id: 'FAC-013', gender: 'male',   assigned: 0 },
      { name: 'Dr. Luz Fernandez',   id: 'FAC-014', gender: 'female', assigned: 0 },
      { name: 'Prof. Mark Domingo',  id: 'FAC-015', gender: 'male',   assigned: 0 },
    ],
  },
};

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let activeDept = 'bsit';

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
function render(dept) {
  const d = DATA[dept];

  // Summary stats
  document.getElementById('totalFaculty').textContent    = d.faculty.length;
  document.getElementById('totalCourses').textContent    = d.totalCourses;
  document.getElementById('assignedCourses').textContent = d.assignedCourses;
  const pct = Math.round((d.assignedCourses / d.totalCourses) * 100);
  document.getElementById('completionPct').textContent   = pct + '%';

  // Faculty list
  const list = document.getElementById('facultyList');
  list.innerHTML = '';

  d.faculty.forEach(member => {
    const item = document.createElement('div');
    item.className = 'faculty-item';

    item.innerHTML = `
      <div class="faculty-info">
        <div class="faculty-avatar">
          <img src="../assets/images/avatar-${member.gender}.svg" alt="${member.name}" />
        </div>
        <div class="faculty-details">
          <p class="faculty-name">${member.name}</p>
          <p class="faculty-id">${member.id}</p>
        </div>
      </div>
      <div class="faculty-courses">
        <div class="course-count">
          <p class="course-count__number">${member.assigned}</p>
          <p class="course-count__label">Assigned</p>
        </div>
        <button class="view-details-btn" onclick="window.location.href='assign-courses.html?faculty=${encodeURIComponent(member.id)}'">
          View Details
        </button>
      </div>
    `;

    list.appendChild(item);
  });
}

// ─────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────
document.querySelectorAll('.dept-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dept-tab').forEach(t => t.classList.remove('dept-tab--active'));
    tab.classList.add('dept-tab--active');
    activeDept = tab.dataset.dept;
    render(activeDept);
  });
});

// Initial render
render(activeDept);
