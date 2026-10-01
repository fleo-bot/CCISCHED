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
//  DATA — loaded from the real backend, joined against
//  published Schedule entries to determine what's assigned
// ─────────────────────────────────────────────
let COVERAGE_DETAIL = [];
let OVERALL_PCT     = 0;

async function loadCoverage() {
  try {
    const data = await API.getCoverage();
    // Skip courses with no sections this semester — they aren't offered, so
    // they have nothing to be covered (previously shown as a bogus 0/0 "complete").
    COVERAGE_DETAIL = data.courses.filter(c => c.totalSections > 0);
    const { total_sections, sections_covered } = data.totals;
    OVERALL_PCT = total_sections > 0 ? Math.round((sections_covered / total_sections) * 100) : 0;
    updateStats();
    renderCourses();
  } catch (err) {
    console.error('[Section Coverage] Failed to load:', err);
  }
}


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
loadCoverage();
