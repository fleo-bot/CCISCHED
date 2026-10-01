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
//  DATA — loaded from sessionStorage (written by
//  chairperson-faculty.js's Generate Faculty Assignment flow, Stage 1 only —
//  reached only via generated-assignment.html's "View" button).
//  Falls back to static mock when backend is off.
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_assignment_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore */ }

// dept_detail from the API is keyed "0" / "1" (strings) to match URL ?dept=0/1
const DEPT_DATA = _apiResult?.dept_detail ?? null;

// ─────────────────────────────────────────────
//  READ dept INDEX FROM URL
// ─────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const deptIdx = parseInt(params.get('dept') ?? '1', 10);
const data = DEPT_DATA ? (DEPT_DATA[deptIdx] ?? DEPT_DATA[1]) : null;

const titleEl = document.getElementById('deptTitle');
if (titleEl) titleEl.textContent = data?.title || 'ERROR: ASSIGNMENT DATA UNAVAILABLE';

// ─────────────────────────────────────────────
//  RENDER ROWS
// ─────────────────────────────────────────────
const adRows = document.getElementById('adRows');
let searchQuery = '';

function renderRows(query = '') {
  if (!adRows) return;
  adRows.innerHTML = '';
  if (!data) {
    adRows.innerHTML = '<div style="padding:28px;text-align:center;color:#777;">ERROR: No generated assignment data is available for this department.</div>';
    return;
  }

  const q = query.trim().toLowerCase();

  data.faculty.forEach((f, idx) => {
    const match = !q || f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
    if (!match) return;

    const pct = ((f.load / f.max) * 100).toFixed(1);

    const row = document.createElement('div');
    row.className = 'ad-row';
    row.dataset.idx = idx;

    row.innerHTML = `
      <span class="ad-row__name">${f.name}</span>
      <span class="ad-row__type">${f.type.replace('|', ' | ')}</span>
      <div class="ad-load">
        <div class="ad-load__track">
          <div class="ad-load__fill" data-pct="${pct}" style="width:0%"></div>
        </div>
        <span class="ad-load__label">${f.load}/${f.max}</span>
      </div>
      <span class="ad-row__score">${f.score}%</span>
    `;

    adRows.appendChild(row);
  });

  // Animate bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      adRows.querySelectorAll('.ad-load__fill').forEach(fill => {
        fill.style.width = fill.dataset.pct + '%';
      });
    }, 60);
  });
}

renderRows();

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
document.getElementById('adSearch')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderRows(searchQuery);
});

// ─────────────────────────────────────────────
//  ROW CLICK — show instructor's assigned courses
// ─────────────────────────────────────────────
adRows?.addEventListener('click', e => {
  const row = e.target.closest('.ad-row');
  if (!row) return;
  const idx  = parseInt(row.dataset.idx, 10);
  const faculty = data.faculty[idx];
  if (faculty) {
    openInstructorModal(faculty);
  }
});

// ─────────────────────────────────────────────
//  INSTRUCTOR ASSIGNMENT MODAL
// ─────────────────────────────────────────────
const iaModalOverlay = document.getElementById('iaModalOverlay');
const iaModalTitle = document.getElementById('iaModalTitle');
const iaModalDept = document.getElementById('iaModalDept');
const iaModalScore = document.getElementById('iaModalScore');
const iaTableBody = document.getElementById('iaTableBody');
const iaJustification = document.getElementById('iaJustification');
const iaModalClose = document.getElementById('iaModalClose');
const iaRejectBtn = document.getElementById('iaRejectBtn');
const iaApproveBtn = document.getElementById('iaApproveBtn');

function openInstructorModal(faculty) {
  if (!iaModalOverlay) return;

  // Populate modal content
  if (iaModalTitle) iaModalTitle.textContent = `COURSE ASSIGNMENT: ${faculty.name.toUpperCase()}`;
  if (iaModalDept) iaModalDept.textContent = faculty.department || 'Information Technology';
  if (iaModalScore) iaModalScore.textContent = `${faculty.score}%`;
  if (iaJustification) iaJustification.textContent = faculty.justification || '';

  // Populate course table
  if (iaTableBody) {
    iaTableBody.innerHTML = '';
    (faculty.courses || []).forEach(course => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${course.code}</td>
        <td>${course.desc}</td>
        <td>${course.type}</td>
        <td>${course.units}</td>
      `;
      iaTableBody.appendChild(tr);
    });
  }

  // Show modal
  iaModalOverlay.classList.add('ia-modal-overlay--open');
}

function closeInstructorModal() {
  if (iaModalOverlay) {
    iaModalOverlay.classList.remove('ia-modal-overlay--open');
  }
}

// Close button
iaModalClose?.addEventListener('click', closeInstructorModal);

// Close modal when clicking outside
iaModalOverlay?.addEventListener('click', e => {
  if (e.target === iaModalOverlay) closeInstructorModal();
});

// Discard button
iaRejectBtn?.addEventListener('click', () => {
  closeInstructorModal();
  showToast('Assignment discarded', 'error');
});

// Save Changes button
iaApproveBtn?.addEventListener('click', () => {
  closeInstructorModal();
  showToast('Assignment saved successfully');
});

// Escape key to close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && iaModalOverlay?.classList.contains('ia-modal-overlay--open')) {
    closeInstructorModal();
  }
});

// ─────────────────────────────────────────────
//  BACK BUTTON
// ─────────────────────────────────────────────
document.getElementById('backBtn')?.addEventListener('click', () => {
  window.location.href = 'generated-assignment.html';
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'ga-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.cssText = `
    position:fixed;bottom:28px;left:50%;
    transform:translateX(-50%) translateY(0);
    background:${type === 'error' ? '#C0392B' : 'var(--maroon)'};
    color:#fff;font-family:'Raleway',sans-serif;font-size:0.78rem;
    font-weight:700;padding:11px 26px;border-radius:999px;
    box-shadow:0 4px 18px rgba(0,0,0,0.18);z-index:9999;white-space:nowrap;
  `;
  toastEl.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (toastEl) toastEl.style.opacity = '0'; }, 2600);
}
