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

// ─────────────────────────────────────────────
//  DONUT CHART HELPER
//  circumference = 2π × r = 2π × 38 ≈ 238.76
// ─────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 38; // ≈ 238.76

/**
 * Animate a donut arc to a given percentage.
 * @param {string} fillId  — id of the <circle> fill element
 * @param {string} labelId — id of the label <span>
 * @param {number} pct     — 0–100
 */
function animateDonut(fillId, labelId, pct) {
  const fill  = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!fill || !label) return;

  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  // Trigger CSS transition by setting after a short delay (allows paint first)
  requestAnimationFrame(() => {
    fill.style.strokeDashoffset = offset;
    label.textContent = pct + '%';
  });
}

// ─────────────────────────────────────────────
//  DASHBOARD DATA
// ─────────────────────────────────────────────

const PROGRESS = {
  bsit: 5,   // percent complete
  bscs: 15,
};

const AVAILABILITY = {
  submitted: 15,  // faculty count — all faculty have submitted
  pending:   0,   // no pending submissions - all complete for testing
};

const UNASSIGNED_COURSES = [
  'BSIT 1-1: Capstone',
  'BSIT 2-4: Programming',
  'BSIT 4-4: Data Science',
];

const ROOMS = {
  lecture: 12,
  laboratory: 8,
};

// ─────────────────────────────────────────────
//  RENDER DONUTS
// ─────────────────────────────────────────────
// Delay slightly so CSS transition fires visibly on page load
setTimeout(() => {
  animateDonut('donutBSITFill', 'donutBSITLabel', PROGRESS.bsit);
  animateDonut('donutBSCSFill', 'donutBSCSLabel', PROGRESS.bscs);
}, 120);

// ─────────────────────────────────────────────
//  RENDER AVAILABILITY BAR CHART
// ─────────────────────────────────────────────
const barChart = document.getElementById('availBarChart');

if (barChart) {
  const maxVal    = Math.max(AVAILABILITY.submitted, AVAILABILITY.pending, 1);
  const maxHeight = 100; // px — matches CSS height of .cp-bar-chart

  [AVAILABILITY.submitted, AVAILABILITY.pending].forEach((val, idx) => {
    const bar = document.createElement('div');
    bar.className = 'cp-bar';
    bar.style.height = '4px'; // start at 0 for animation
    bar.setAttribute('title', (idx === 0 ? 'Submitted' : 'Pending') + ': ' + val);
    barChart.appendChild(bar);

    // Animate in
    setTimeout(() => {
      bar.style.height = Math.round((val / maxVal) * maxHeight) + 'px';
    }, 150 + idx * 80);
  });
}

// ─────────────────────────────────────────────
//  RENDER UNASSIGNED COURSES
// ─────────────────────────────────────────────
const list = document.getElementById('unassignedList');

if (list) {
  UNASSIGNED_COURSES.forEach(course => {
    const li = document.createElement('li');
    li.textContent = course;
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────
//  RENDER ROOM COUNTS
// ─────────────────────────────────────────────
const lectureCountEl = document.getElementById('lectureCount');
const labCountEl = document.getElementById('labCount');

if (lectureCountEl) lectureCountEl.textContent = ROOMS.lecture;
if (labCountEl) labCountEl.textContent = ROOMS.laboratory;
