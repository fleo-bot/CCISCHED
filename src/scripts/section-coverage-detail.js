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
//  Each course lists every section with whether
//  it has been assigned to a faculty member.
// ─────────────────────────────────────────────
const COVERAGE_DETAIL = [
  {
    code: 'INTE 303',
    name: 'Capstone Project 1',
    totalSections: 9,
    sections: [
      { label: 'IT4-1', assignedTo: 'Dr. Maria Santos' },
      { label: 'IT4-2', assignedTo: 'Dr. Maria Santos' },
      { label: 'IT4-3', assignedTo: 'Prof. James Reyes' },
      { label: 'IT4-4', assignedTo: 'Prof. James Reyes' },
      { label: 'IT4-5', assignedTo: 'Dr. Ana Cruz' },
      { label: 'IT4-6', assignedTo: null },
      { label: 'IT4-7', assignedTo: null },
      { label: 'IT4-8', assignedTo: null },
      { label: 'IT4-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 019',
    name: 'Application Development',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-2', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-3', assignedTo: 'Ms. Laura Bautista' },
      { label: 'IT3-4', assignedTo: 'Ms. Laura Bautista' },
      { label: 'IT3-5', assignedTo: null },
      { label: 'IT3-6', assignedTo: null },
      { label: 'IT3-7', assignedTo: null },
      { label: 'IT3-8', assignedTo: null },
      { label: 'IT3-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 035',
    name: 'Data Mining',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT3-2', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT3-3', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT3-4', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT3-5', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT3-6', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT3-7', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT3-8', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT3-9', assignedTo: 'Dr. Robert Villanueva' },
    ],
  },
  {
    code: 'COMP 050',
    name: 'Programming 1',
    totalSections: 9,
    sections: [
      { label: 'IT1-1', assignedTo: 'Mr. Carlo Dela Cruz' },
      { label: 'IT1-2', assignedTo: 'Mr. Carlo Dela Cruz' },
      { label: 'IT1-3', assignedTo: 'Mr. Carlo Dela Cruz' },
      { label: 'IT1-4', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT1-5', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT1-6', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT1-7', assignedTo: 'Prof. Edwin Torres' },
      { label: 'IT1-8', assignedTo: 'Prof. Edwin Torres' },
      { label: 'IT1-9', assignedTo: 'Prof. Edwin Torres' },
    ],
  },
  {
    code: 'COMP 040',
    name: 'Discrete Mathematics',
    totalSections: 9,
    sections: [
      { label: 'IT2-1', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT2-2', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT2-3', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT2-4', assignedTo: 'Prof. Mark Domingo' },
      { label: 'IT2-5', assignedTo: 'Prof. Mark Domingo' },
      { label: 'IT2-6', assignedTo: null },
      { label: 'IT2-7', assignedTo: null },
      { label: 'IT2-8', assignedTo: null },
      { label: 'IT2-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 033',
    name: 'Database Administration',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Dr. Maria Santos' },
      { label: 'IT3-2', assignedTo: 'Dr. Maria Santos' },
      { label: 'IT3-3', assignedTo: 'Prof. James Reyes' },
      { label: 'IT3-4', assignedTo: 'Prof. James Reyes' },
      { label: 'IT3-5', assignedTo: 'Dr. Ana Cruz' },
      { label: 'IT3-6', assignedTo: 'Dr. Ana Cruz' },
      { label: 'IT3-7', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-8', assignedTo: null },
      { label: 'IT3-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 058',
    name: 'Data Science',
    totalSections: 9,
    sections: [
      { label: 'IT4-1', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT4-2', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT4-3', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT4-4', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT4-5', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT4-6', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT4-7', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT4-8', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT4-9', assignedTo: 'Dr. Robert Villanueva' },
    ],
  },
  {
    code: 'COMP 055',
    name: 'Data Communication',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Ms. Tricia Ramos' },
      { label: 'IT3-2', assignedTo: 'Ms. Tricia Ramos' },
      { label: 'IT3-3', assignedTo: 'Mr. Dennis Ocampo' },
      { label: 'IT3-4', assignedTo: 'Mr. Dennis Ocampo' },
      { label: 'IT3-5', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT3-6', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT3-7', assignedTo: 'Dr. Luz Fernandez' },
      { label: 'IT3-8', assignedTo: 'Prof. Mark Domingo' },
      { label: 'IT3-9', assignedTo: 'Prof. Mark Domingo' },
    ],
  },
  {
    code: 'COMP 016',
    name: 'Web Development',
    totalSections: 9,
    sections: [
      { label: 'IT2-1', assignedTo: 'Mr. Carlo Dela Cruz' },
      { label: 'IT2-2', assignedTo: 'Mr. Carlo Dela Cruz' },
      { label: 'IT2-3', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT2-4', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT2-5', assignedTo: 'Dr. Patricia Lim' },
      { label: 'IT2-6', assignedTo: 'Prof. Edwin Torres' },
      { label: 'IT2-7', assignedTo: 'Prof. Edwin Torres' },
      { label: 'IT2-8', assignedTo: 'Prof. Edwin Torres' },
      { label: 'IT2-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 017',
    name: 'Multimedia',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Ms. Laura Bautista' },
      { label: 'IT3-2', assignedTo: 'Ms. Laura Bautista' },
      { label: 'IT3-3', assignedTo: 'Ms. Laura Bautista' },
      { label: 'IT3-4', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-5', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-6', assignedTo: 'Prof. Rico Mendoza' },
      { label: 'IT3-7', assignedTo: 'Dr. Ana Cruz' },
      { label: 'IT3-8', assignedTo: null },
      { label: 'IT3-9', assignedTo: null },
    ],
  },
  {
    code: 'COMP 028',
    name: 'Network Administration',
    totalSections: 9,
    sections: [
      { label: 'IT3-1', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT3-2', assignedTo: 'Dr. Robert Villanueva' },
      { label: 'IT3-3', assignedTo: 'Ms. Tricia Ramos' },
      { label: 'IT3-4', assignedTo: 'Ms. Tricia Ramos' },
      { label: 'IT3-5', assignedTo: 'Mr. Dennis Ocampo' },
      { label: 'IT3-6', assignedTo: 'Mr. Dennis Ocampo' },
      { label: 'IT3-7', assignedTo: null },
      { label: 'IT3-8', assignedTo: null },
      { label: 'IT3-9', assignedTo: null },
    ],
  },
  {
    code: 'ELEC 101',
    name: 'Mobile Application Dev',
    totalSections: 9,
    sections: [
      { label: 'IT4-1', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT4-2', assignedTo: 'Dr. Kevin Aquino' },
      { label: 'IT4-3', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT4-4', assignedTo: 'Prof. Janet Garcia' },
      { label: 'IT4-5', assignedTo: null },
      { label: 'IT4-6', assignedTo: null },
      { label: 'IT4-7', assignedTo: null },
      { label: 'IT4-8', assignedTo: null },
      { label: 'IT4-9', assignedTo: null },
    ],
  },
];

const OVERALL_PCT = 82;

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';

// ─────────────────────────────────────────────
//  SUMMARY STATS
// ─────────────────────────────────────────────
function updateStats() {
  const totalCourses   = COVERAGE_DETAIL.length;
  const totalSections  = COVERAGE_DETAIL.reduce((s, c) => s + c.totalSections, 0);
  const coveredSections = COVERAGE_DETAIL.reduce((s, c) =>
    s + c.sections.filter(sec => sec.assignedTo).length, 0);
  const uncovered = totalSections - coveredSections;

  document.getElementById('statTotalCourses').textContent  = totalCourses;
  document.getElementById('statTotalSections').textContent = totalSections;
  document.getElementById('statCovered').textContent       = coveredSections;
  document.getElementById('statUncovered').textContent     = uncovered;
  document.getElementById('overallChip').textContent       = `${OVERALL_PCT}% Overall`;
}

// ─────────────────────────────────────────────
//  RENDER COURSE CARDS
// ─────────────────────────────────────────────
function renderCourses() {
  const list  = document.getElementById('scdList');
  const empty = document.getElementById('scdEmpty');
  list.innerHTML = '';

  const filtered = COVERAGE_DETAIL.filter(course => {
    const assignedCount = course.sections.filter(s => s.assignedTo).length;
    const isComplete    = assignedCount === course.totalSections;

    const matchFilter =
      activeFilter === 'all' ||
      (activeFilter === 'complete' && isComplete) ||
      (activeFilter === 'partial'  && !isComplete);

    const matchSearch =
      course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase());

    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(course => {
    const assignedCount = course.sections.filter(s => s.assignedTo).length;
    const pct           = Math.round((assignedCount / course.totalSections) * 100);
    const isComplete    = assignedCount === course.totalSections;

    const card = document.createElement('div');
    card.className = 'scd-course-card';

    // Build section tiles
    const tilesHTML = course.sections.map(sec => {
      const status = sec.assignedTo ? 'assigned' : 'unassigned';
      return `
        <div class="scd-section-tile scd-section-tile--${status}">
          <div class="scd-section-info">
            <p class="scd-section-name">${sec.label}</p>
            ${sec.assignedTo
              ? `<p class="scd-section-faculty">${sec.assignedTo}</p>`
              : `<p class="scd-section-faculty" style="color:rgba(192,57,43,0.55);">Unassigned</p>`}
          </div>
          <span class="scd-section-status"></span>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="scd-course-header">
        <div class="scd-course-meta">
          <p class="scd-course-name">${course.name}</p>
          <p class="scd-course-code">${course.code}</p>
        </div>
        <div class="scd-course-right">
          <div class="scd-mini-progress">
            <div class="scd-mini-track">
              <div class="scd-mini-fill${isComplete ? ' scd-mini-fill--complete' : ''}"
                   data-pct="${pct}"></div>
            </div>
            <span class="scd-mini-label${isComplete ? ' scd-mini-label--complete' : ''}">
              ${assignedCount}/${course.totalSections}
            </span>
          </div>
        </div>
      </div>
      <div class="scd-sections">
        ${tilesHTML}
      </div>
    `;

    list.appendChild(card);
  });

  // Animate progress bars in
  requestAnimationFrame(() => {
    setTimeout(() => {
      list.querySelectorAll('.scd-mini-fill').forEach(fill => {
        fill.style.width = fill.dataset.pct + '%';
      });
    }, 80);
  });
}

// ─────────────────────────────────────────────
//  FILTER TABS
// ─────────────────────────────────────────────
document.querySelectorAll('.scd-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.scd-tab').forEach(t => t.classList.remove('scd-tab--active'));
    tab.classList.add('scd-tab--active');
    activeFilter = tab.dataset.filter;
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
//  INIT
// ─────────────────────────────────────────────
updateStats();
renderCourses();
