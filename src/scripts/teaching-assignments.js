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
//  ASSIGNMENT DATA
//  Mirrors the schedule data from faculty-schedule.js
//  Each section lists the subject + its meeting days/times
// ─────────────────────────────────────────────
const ASSIGNMENTS = [
  {
    section:  'BSIT 3-1',
    program:  'BS Information Technology',
    year:     '3rd Year · Section 1',
    colorKey: 'maroon',
    subjects: [
      {
        code:     'INTE 303',
        name:     'Capstone Project 1',
        type:     'Lecture',
        units:    3,
        schedule: [
          { day: 'Tuesday',  time: '10:30 AM – 12:00 PM' },
          { day: 'Thursday', time: '10:30 AM – 12:00 PM' },
        ],
        room: 'CCS Lab 301',
      },
    ],
  },
  {
    section:  'BSIT 3-2',
    program:  'BS Information Technology',
    year:     '3rd Year · Section 2',
    colorKey: 'blue',
    subjects: [
      {
        code:     'COMP 016',
        name:     'Web Development',
        type:     'Laboratory',
        units:    3,
        schedule: [
          { day: 'Monday',    time: '3:00 PM – 4:30 PM' },
          { day: 'Wednesday', time: '3:00 PM – 4:30 PM' },
        ],
        room: 'CCS Lab 201',
      },
      {
        code:     'COMP 017',
        name:     'Multimedia Systems',
        type:     'Lecture',
        units:    3,
        schedule: [
          { day: 'Friday', time: '3:00 PM – 4:30 PM' },
        ],
        room: 'Room 102',
      },
    ],
  },
  {
    section:  'BSIT 3-3',
    program:  'BS Information Technology',
    year:     '3rd Year · Section 3',
    colorKey: 'gold',
    subjects: [
      {
        code:     'COMP 016',
        name:     'Web Development',
        type:     'Laboratory',
        units:    3,
        schedule: [
          { day: 'Monday',    time: '7:30 AM – 9:00 AM' },
          { day: 'Wednesday', time: '7:30 AM – 9:00 AM' },
        ],
        room: 'CCS Lab 202',
      },
      {
        code:     'COMP 017',
        name:     'Multimedia Systems',
        type:     'Lecture',
        units:    3,
        schedule: [
          { day: 'Friday', time: '7:30 AM – 9:00 AM' },
        ],
        room: 'Room 101',
      },
    ],
  },
];

// ─────────────────────────────────────────────
//  RENDER SECTION CARDS
// ─────────────────────────────────────────────
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

function buildSubjectRows(subjects) {
  return subjects.map(subj => {
    const schedRows = subj.schedule.map(s =>
      `<div class="ta-sched-row">
        <span class="ta-sched-row__day">${DAY_SHORT[s.day] ?? s.day}</span>
        <span class="ta-sched-row__time">${s.time}</span>
      </div>`
    ).join('');

    return `
      <div class="ta-subject">
        <div class="ta-subject__top">
          <div class="ta-subject__info">
            <p class="ta-subject__code">${subj.code}</p>
            <p class="ta-subject__name">${subj.name}</p>
            <div class="ta-subject__meta">
              <span class="ta-subject__type-badge">${subj.type}</span>
              <span class="ta-subject__units">${subj.units} units</span>
            </div>
          </div>
          <div class="ta-subject__room">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="4" width="11" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/>
              <path d="M5 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            ${subj.room}
          </div>
        </div>
        <div class="ta-subject__schedule">
          ${schedRows}
        </div>
      </div>`;
  }).join('');
}

function renderSections() {
  const container = document.getElementById('taSections');
  if (!container) return;

  container.innerHTML = ASSIGNMENTS.map((asgn, idx) => `
    <div class="ta-card ta-card--${asgn.colorKey}">
      <div class="ta-card__header">
        <div class="ta-card__header-left">
          <div class="ta-card__num">${idx + 1}</div>
          <div>
            <p class="ta-card__section">${asgn.section}</p>
            <p class="ta-card__program">${asgn.year}</p>
          </div>
        </div>
        <div class="ta-card__header-right">
          <span class="ta-card__count">${asgn.subjects.length} subject${asgn.subjects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <p class="ta-card__prog-full">${asgn.program}</p>
      <div class="ta-card__subjects">
        ${buildSubjectRows(asgn.subjects)}
      </div>
    </div>
  `).join('');
}

renderSections();
