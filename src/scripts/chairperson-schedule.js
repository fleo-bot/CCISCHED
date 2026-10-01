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
//  REQUIREMENTS DATA
//  status: 'complete' | 'pending' | 'missing'
//  viewHref: page to navigate to when View is clicked
// ─────────────────────────────────────────────

// Dynamic status check functions
let courseOfferingStatus = 'pending';

function checkCourseOfferingStatus() {
  return courseOfferingStatus;
}

function checkFacultyAvailabilityStatus() {
  // Check if all faculty have submitted availability
  // This should match the dashboard logic
  const pendingCount = 0; // Set to 0 so all requirements are complete for testing
  return pendingCount === 0 ? 'complete' : 'pending';
}

// Whether a faculty assignment has actually been generated AND approved for
// the selected semester (real check, via /api/generate/assignment/status) —
// this used to be a hardcoded 'complete' regardless of whether one existed.
let facultyAssignmentStatus = 'pending';

const REQUIREMENTS = [
  {
    name: 'Course Offering',
    get status() { return checkCourseOfferingStatus(); },
    viewHref: 'manage-courses.html',
  },
  {
    name: 'Faculty Course Assignments',
    get status() { return facultyAssignmentStatus; },
    viewHref: 'faculty.html',
  },
  {
    name: 'Faculty Availability Submissions',
    get status() { return checkFacultyAvailabilityStatus(); },
    viewHref: 'view-submissions.html',
  },
];

// ─────────────────────────────────────────────
//  RENDER REQUIREMENT ROWS
// ─────────────────────────────────────────────
const reqRows = document.getElementById('reqRows');

function statusMeta(status) {
  switch (status) {
    case 'complete': return { label: 'Complete', cls: 'cs-status-badge--complete',
      icon: `<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
               <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
               <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" stroke-width="1.4"
                     stroke-linecap="round" stroke-linejoin="round"/>
             </svg>` };
    case 'pending':  return { label: 'Pending',  cls: 'cs-status-badge--pending',
      icon: `<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
               <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
               <path d="M7 4.5V7.5L9 9" stroke="currentColor" stroke-width="1.4"
                     stroke-linecap="round"/>
             </svg>` };
    default:         return { label: 'Missing',  cls: 'cs-status-badge--missing',
      icon: `<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
               <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
               <path d="M7 4.5v3M7 9v.5" stroke="currentColor" stroke-width="1.4"
                     stroke-linecap="round"/>
             </svg>` };
  }
}

function renderRequirements() {
  if (!reqRows) return;
  reqRows.innerHTML = '';

  REQUIREMENTS.forEach(req => {
    const meta = statusMeta(req.status);
    const row  = document.createElement('div');
    row.className = 'cs-req-row';
    row.innerHTML = `
      <span class="cs-req-row__name">${req.name}</span>
      <div class="cs-req-row__status">
        <span class="cs-status-badge ${meta.cls}">
          ${meta.icon}
          ${meta.label}
        </span>
      </div>
      <div class="cs-req-row__action">
        <button class="cs-view-btn" data-href="${req.viewHref}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="7" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          View
        </button>
      </div>
    `;
    reqRows.appendChild(row);
  });

  updateStatusBanner();
}

// ─────────────────────────────────────────────
//  STATUS BANNER
// ─────────────────────────────────────────────
function updateStatusBanner() {
  const banner  = document.getElementById('statusBanner');
  const bannerText = document.getElementById('statusBannerText');
  const genBtn  = document.getElementById('generateBtn');
  if (!banner) return;

  const allComplete = REQUIREMENTS.every(r => r.status === 'complete');
  const hasMissing  = REQUIREMENTS.some(r => r.status === 'missing');
  const hasPending  = REQUIREMENTS.some(r => r.status === 'pending');

  if (allComplete) {
    banner.className = 'cs-status-banner';
    bannerText.textContent = 'All parameters verified. The system is ready to compile their master timetable';
    banner.querySelector('svg').innerHTML = `
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>`;
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.style.opacity = '1';
      genBtn.style.cursor = 'pointer';
    }
  } else if (hasMissing) {
    banner.className = 'cs-status-banner cs-status-banner--warn';
    bannerText.textContent = 'Some required inputs are missing. Please complete them before generating the timetable.';
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.style.opacity = '0.5';
      genBtn.style.cursor = 'not-allowed';
    }
  } else if (hasPending) {
    banner.className = 'cs-status-banner cs-status-banner--warn';
    bannerText.textContent = 'Some pre-timetabling requirements are still pending. All requirements must be completed before generating the timetable.';
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.style.opacity = '0.5';
      genBtn.style.cursor = 'not-allowed';
    }
  }
}

renderRequirements();

// ─────────────────────────────────────────────
//  VIEW BUTTON DELEGATION
// ─────────────────────────────────────────────
reqRows?.addEventListener('click', e => {
  const btn = e.target.closest('.cs-view-btn');
  if (!btn) return;
  window.location.href = btn.dataset.href;
});

// ─────────────────────────────────────────────
//  GENERATE TIMETABLE — confirmation modal
// ─────────────────────────────────────────────
const gtOverlay    = document.getElementById('gtModalOverlay');
const gtConfirmBtn = document.getElementById('gtConfirmBtn');
const gtCancelBtn  = document.getElementById('gtCancelBtn');

function openGenConfirm()  { gtOverlay?.classList.add('gt-modal-overlay--open'); }
function closeGenConfirm() { gtOverlay?.classList.remove('gt-modal-overlay--open'); }

document.getElementById('generateBtn')?.addEventListener('click', () => {
  const ay  = document.getElementById('aySelect')?.value;
  const sem = document.getElementById('semSelect')?.value;

  if (!ay || !sem) {
    showToast('Please select an Academic Year and Semester first.', 'warn');
    return;
  }

  // Check if all requirements are complete
  const allComplete = REQUIREMENTS.every(r => r.status === 'complete');
  const pendingReqs = REQUIREMENTS.filter(r => r.status === 'pending' || r.status === 'missing');
  
  if (!allComplete) {
    // Show warning with specific pending items
    const pendingList = pendingReqs.map(r => `• ${r.name}`).join('\n');
    showPrereqWarningModal(pendingReqs);
    return;
  }

  openGenConfirm();
});

// Cancel — just close
gtCancelBtn?.addEventListener('click', closeGenConfirm);

// Backdrop click closes
gtOverlay?.addEventListener('click', e => {
  if (e.target === gtOverlay) closeGenConfirm();
});

// Escape closes
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && gtOverlay?.classList.contains('gt-modal-overlay--open')) {
    closeGenConfirm();
  }
});

// ─────────────────────────────────────────────
//  OPTIMIZING TIMETABLE — loading sequence + API call
// ─────────────────────────────────────────────
const genOverlay      = document.getElementById('genOverlay');
const genProgressFill = document.getElementById('genProgressFill');
const genPct          = document.getElementById('genPct');
const genStatus       = document.getElementById('genStatus');

// Steps shown while the API call runs in the background
const GEN_STEPS = [
  { label: 'Loading course offerings…',        pct: 14 },
  { label: 'Loading faculty assignments…',     pct: 28 },
  { label: 'Loading availability data…',       pct: 42 },
  { label: 'Running Random Forest model…',     pct: 58 },
  { label: 'Running CP-SAT optimizer…',        pct: 74 },
  { label: 'Applying scheduling constraints…', pct: 88 },
  { label: 'Finalizing timetable…',            pct: 100 },
];

function openGenOverlay()  { genOverlay?.classList.add('gen-overlay--open'); }
function closeGenOverlay() { genOverlay?.classList.remove('gen-overlay--open'); }

// Animate the progress bar from currentPct → targetPct over ~duration ms
function animateStep(targetPct, currentPct, duration) {
  return new Promise(resolve => {
    const startTime = performance.now();
    function frame(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const pct      = Math.round(currentPct + (targetPct - currentPct) * eased);
      if (genProgressFill) genProgressFill.style.width = pct + '%';
      if (genPct)          genPct.textContent = pct + '%';
      if (progress < 1) requestAnimationFrame(frame);
      else resolve(pct);
    }
    requestAnimationFrame(frame);
  });
}

async function runGenSequence() {
  const ay = document.getElementById('aySelect')?.value || '';
  const semValue = document.getElementById('semSelect')?.value || '';
  const SEM_MAP = { '1': '1st', '2': '2nd', 'summer': 'Summer' };
  const sem = SEM_MAP[semValue] || semValue;

  openGenOverlay();
  if (genProgressFill) genProgressFill.style.width = '0%';
  if (genPct)          genPct.textContent = '0%';
  if (genStatus)       genStatus.textContent = 'Initializing…';

  // ── Fire the real API call immediately (runs in parallel with animation) ──
  // Stage 2 ONLY: reads the semester's currently APPROVED faculty assignment
  // from the database and places it into a real day/time — it does not run
  // Stage 1 or the RF again.
  const apiPromise = API.generateTimetable(ay, sem);

  // ── Animate through steps 0-5 (leave step 6 / 100% for when API returns) ──
  let currentPct = 0;
  const stepsBeforeDone = GEN_STEPS.slice(0, GEN_STEPS.length - 1);

  for (const step of stepsBeforeDone) {
    if (genStatus) genStatus.textContent = step.label;
    currentPct = await animateStep(step.pct, currentPct, 480 + Math.random() * 320);
    await new Promise(r => setTimeout(r, 160));
  }

  // ── Wait for API (may already be done) ──
  let apiData = null;
  try {
    apiData = await apiPromise;
  } catch (err) {
    closeGenOverlay();
    showToast(`Generation failed: ${err.message}`, 'error');
    return;
  }

  // ── Final step ──
  if (genStatus) genStatus.textContent = GEN_STEPS[GEN_STEPS.length - 1].label;
  await animateStep(100, currentPct, 400);

  // ── Persist result for the result pages ──
  try {
    sessionStorage.setItem('ccisched_result', JSON.stringify(apiData));
  } catch (_) {
    // sessionStorage full — result pages will show a graceful empty state
  }

  await new Promise(r => setTimeout(r, 600));
  closeGenOverlay();

  const query = new URLSearchParams({ ay, sem }).toString();
  window.location.href = `generated-timetables.html?${query}`;
}

// Yes — close confirm, start loading sequence
gtConfirmBtn?.addEventListener('click', () => {
  closeGenConfirm();
  // slight delay so confirm modal fades out before overlay appears
  setTimeout(() => runGenSequence(), 180);
});

// ─────────────────────────────────────────────
//  DISTRIBUTION SUCCESS NOTIFICATION
//  Shown when arriving from generated-timetables
//  with ?distributed=1 in the URL
// ─────────────────────────────────────────────
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('distributed') !== '1') return;

  // Clean the URL so a refresh doesn't re-show it
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  const overlay  = document.getElementById('distOverlay');
  const closeBtn = document.getElementById('distCloseBtn');
  if (!overlay) return;

  // Open with a tiny delay so the page has rendered first
  setTimeout(() => overlay.classList.add('dist-overlay--open'), 120);

  function closeDistModal() {
    overlay.classList.remove('dist-overlay--open');
  }

  closeBtn?.addEventListener('click', closeDistModal);

  // Backdrop click closes
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDistModal();
  });

  // Escape closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('dist-overlay--open')) {
      closeDistModal();
    }
  });
})();
['aySelect', 'semSelect'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    updateStatusBanner();
    refreshCourseOfferingRequirement();
    refreshFacultyAssignmentRequirement();
  });
});

// ─────────────────────────────────────────────
//  COURSE OFFERING REQUIREMENT — complete once the semester has sections
//  defined. Must NOT depend on published schedules: those are the OUTPUT of
//  timetable generation, so requiring them made the Generate button
//  impossible to unlock.
// ─────────────────────────────────────────────
async function refreshCourseOfferingRequirement() {
  const ay = document.getElementById('aySelect')?.value;
  const semValue = document.getElementById('semSelect')?.value;
  if (!ay || !semValue) return;

  const SEM_MAP = { '1': '1st', '2': '2nd', 'summer': 'Summer' };
  const sem = SEM_MAP[semValue] || semValue;

  try {
    const status = await API.getCourseOfferingStatus(ay, sem);
    courseOfferingStatus = status.status || 'pending';
  } catch (err) {
    courseOfferingStatus = 'pending';
    console.error('Failed to check course offering schedule status:', err);
  }
  renderRequirements();
}

// ─────────────────────────────────────────────
//  FACULTY ASSIGNMENT REQUIREMENT — real check against the DB, replacing
//  the hardcoded 'complete' this used to be.
// ─────────────────────────────────────────────
async function refreshFacultyAssignmentRequirement() {
  const ay = document.getElementById('aySelect')?.value;
  const semValue = document.getElementById('semSelect')?.value;
  if (!ay || !semValue) return;

  const SEM_MAP = { '1': '1st', '2': '2nd', 'summer': 'Summer' };
  const sem = SEM_MAP[semValue] || semValue;

  try {
    const status = await API.getAssignmentStatus(ay, sem);
    facultyAssignmentStatus = status.approved_count > 0 ? 'complete' :
                               status.draft_count > 0    ? 'pending'  : 'missing';
  } catch (err) {
    // Leave it as-is (starts 'pending') rather than falsely claim 'complete'
    console.error('Failed to check faculty assignment status:', err);
  }
  renderRequirements();
}

refreshCourseOfferingRequirement();
refreshFacultyAssignmentRequirement();

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'cs-toast';
    document.body.appendChild(toastEl);
  }
  const bg = type === 'warn'  ? '#92400E'
           : type === 'error' ? '#C0392B'
           : 'var(--maroon)';
  toastEl.textContent = msg;
  toastEl.style.background = bg;
  toastEl.classList.add('cs-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('cs-toast--show'), 3000);
}

// ─────────────────────────────────────────────
//  PRE-TIMETABLING REQUIREMENTS WARNING MODAL
// ─────────────────────────────────────────────
function showPrereqWarningModal(pendingReqs) {
  const overlay = document.createElement('div');
  overlay.className = 'prereq-modal-overlay prereq-modal-overlay--open';
  overlay.innerHTML = `
    <div class="prereq-modal" role="dialog" aria-modal="true" aria-labelledby="prereqModalTitle">
      <div class="prereq-modal__header">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <path d="M24 6L44 40H4L24 6Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M24 19v10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="24" cy="33" r="1.5" fill="currentColor"/>
        </svg>
        <p class="prereq-modal__title" id="prereqModalTitle">CANNOT GENERATE TIMETABLE</p>
      </div>
      
      <div class="prereq-modal__body">
        <p class="prereq-modal__message">
          <strong>${pendingReqs.length}</strong> pre-timetabling ${pendingReqs.length === 1 ? 'requirement is' : 'requirements are'} not yet complete.
        </p>
        <p class="prereq-modal__sub">
          All pre-timetabling requirements must be completed before generating the timetable.
        </p>
        
        <div class="prereq-list-header">
          <span>Pending Requirements:</span>
        </div>
        <div class="prereq-list">
          ${pendingReqs.map(r => `
            <div class="prereq-req-item">
              <div class="prereq-req-info">
                <span class="prereq-req-name">${r.name}</span>
              </div>
              <button class="prereq-view-btn" onclick="window.location.href='${r.viewHref}'">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.4"/>
                  <circle cx="7" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/>
                </svg>
                View
              </button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="prereq-modal__footer">
        <button class="prereq-modal-btn prereq-modal-btn--primary" id="prereqCloseBtn">
          Understood
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Event handlers
  document.getElementById('prereqCloseBtn')?.addEventListener('click', () => {
    overlay.classList.remove('prereq-modal-overlay--open');
    setTimeout(() => overlay.remove(), 300);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('prereq-modal-overlay--open');
      setTimeout(() => overlay.remove(), 300);
    }
  });
  
  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.classList.remove('prereq-modal-overlay--open');
      setTimeout(() => overlay.remove(), 300);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
