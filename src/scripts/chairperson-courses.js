'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Notification bell ──
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ── Manage button → navigate to manage page ──
document.getElementById('manageBtn')?.addEventListener('click', () => {
  window.location.href = 'manage-courses.html';
});

// ─────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  DATA — loaded from the real backend
// ─────────────────────────────────────────────
let COURSES = [];
let activeFilter = 'all';
let activeOffer  = 'all';     // all | offered | not_offered
let searchQuery  = '';
// course code -> number of sections in the active semester (from /coverage).
// A course counts as "offered" when it has at least one section.
let SECTIONS_BY_CODE = null;   // null until coverage has loaded

async function loadCourses() {
  try {
    const data = await API.getCourses();
    COURSES = data.map(c => ({
      code:           c.code,
      title:          c.title,
      classification: c.classification || 'IT COMMON & PROFESSIONAL COURSE',
    }));
    renderTable(activeFilter, searchQuery);
    animateCount('statCourses', COURSES.length);
    updateOfferedLabel();
  } catch (err) {
    console.error('[Courses] Failed to load:', err);
  }
}

// Section assignment coverage per course — loaded live in loadCoverage()

// ─────────────────────────────────────────────
//  BUILD COURSES TABLE
// ─────────────────────────────────────────────
const tbody = document.getElementById('crsTableBody');

function badgeClass(classification) {
  return classification.includes('ELECTIVE') ? 'crs-badge--elective' : 'crs-badge--common';
}

function sectionCount(code) {
  if (!SECTIONS_BY_CODE) return null;          // coverage not loaded yet
  return SECTIONS_BY_CODE.get(code) || 0;
}

function updateOfferedLabel() {
  const lbl = document.getElementById('statCoursesLbl');
  if (!lbl || !SECTIONS_BY_CODE || !COURSES.length) return;
  const offered = COURSES.filter(c => sectionCount(c.code) > 0).length;
  lbl.textContent = `COURSES · ${offered} OFFERED`;
}

function renderTable(filter = 'all', query = '') {
  if (!tbody) return;
  tbody.innerHTML = '';

  COURSES.forEach(course => {
    const isElective = course.classification.toLowerCase().includes('elective');
    const matchFilter = filter === 'all' ||
      (filter === 'elective' && isElective) ||
      (filter === 'common'   && !isElective);

    const n = sectionCount(course.code);
    const matchOffer = activeOffer === 'all' || n === null ||
      (activeOffer === 'offered' ? n > 0 : n === 0);

    const matchQuery  = query === '' ||
      course.code.toLowerCase().includes(query) ||
      course.title.toLowerCase().includes(query) ||
      course.classification.toLowerCase().includes(query);

    if (!matchFilter || !matchOffer || !matchQuery) return;

    let offeringCell = '<span class="crs-badge crs-badge--not-offered">…</span>';
    if (n !== null) {
      offeringCell = n > 0
        ? `<span class="crs-badge crs-badge--offered">Offered · ${n} section${n === 1 ? '' : 's'}</span>`
        : '<span class="crs-badge crs-badge--not-offered">Not offered</span>';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${course.code}</td>
      <td>${course.title}</td>
      <td><span class="crs-badge ${badgeClass(course.classification)}">${course.classification}</span></td>
      <td>${offeringCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

renderTable();
loadCourses();

// ─────────────────────────────────────────────
//  FILTER PILLS
// ─────────────────────────────────────────────

document.querySelectorAll('.crs-offer-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.crs-offer-pill').forEach(p => p.classList.remove('crs-offer-pill--active'));
    pill.classList.add('crs-offer-pill--active');
    activeOffer = pill.dataset.offer;
    renderTable(activeFilter, searchQuery);
  });
});

document.querySelectorAll('.crs-filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.crs-filter-pill').forEach(p => p.classList.remove('crs-filter-pill--active'));
    pill.classList.add('crs-filter-pill--active');
    activeFilter = pill.dataset.filter;
    renderTable(activeFilter, searchQuery);
  });
});

// ─────────────────────────────────────────────
//  INLINE TABLE SEARCH
// ─────────────────────────────────────────────
document.getElementById('crsSearch')?.addEventListener('input', function () {
  searchQuery = this.value.trim().toLowerCase();
  renderTable(activeFilter, searchQuery);
});

// ─────────────────────────────────────────────
//  COVERAGE BARS — loaded from the real backend
// ─────────────────────────────────────────────
const coverageList  = document.getElementById('coverageList');
const overallBadge  = document.getElementById('overallBadge');

async function loadCoverage() {
  try {
    const data = await API.getCoverage();
    const { total_sections, sections_covered } = data.totals;
    const overallPct = total_sections > 0 ? Math.round((sections_covered / total_sections) * 100) : 0;

    SECTIONS_BY_CODE = new Map(data.courses.map(c => [c.code, c.totalSections]));
    renderTable(activeFilter, searchQuery);
    updateOfferedLabel();

    if (overallBadge) overallBadge.textContent = `${overallPct}% Overall`;
    animateCount('statSections', total_sections);
    animateCount('statAssigned', sections_covered);

    if (coverageList) {
      coverageList.innerHTML = '';
      // Only courses actually offered this semester (have >= 1 section).
      // Courses with 0 sections (e.g. other-term courses) are not "unassigned",
      // they just aren't being offered, so they're left out of the coverage bars.
      data.courses.filter(c => c.totalSections > 0).forEach(course => {
        const row = document.createElement('div');
        row.className = 'crs-cov-row';
        row.innerHTML = `
          <span class="crs-cov-name" title="${course.name}">${course.name}</span>
          <div class="crs-cov-track">
            <div class="crs-cov-fill" data-covered="${course.coveredSections}" data-total="${course.totalSections}"></div>
          </div>
          <span class="crs-cov-pct">${course.coveredSections}/${course.totalSections}</span>
        `;
        coverageList.appendChild(row);
      });

      // Animate bars in after paint
      requestAnimationFrame(() => {
        setTimeout(() => {
          coverageList.querySelectorAll('.crs-cov-fill').forEach(fill => {
            const covered = parseInt(fill.dataset.covered, 10);
            const total   = parseInt(fill.dataset.total, 10) || 1;
            fill.style.width = ((covered / total) * 100).toFixed(1) + '%';
          });
        }, 120);
      });
    }
  } catch (err) {
    console.error('[Courses] Failed to load coverage:', err);
  }
}

// ─────────────────────────────────────────────
//  SUMMARY STAT COUNTER ANIMATION
// ─────────────────────────────────────────────
function animateCount(id, target, duration = 800) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

loadCoverage();
