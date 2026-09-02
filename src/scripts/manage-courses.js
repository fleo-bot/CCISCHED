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
//  DATA — mirrors courses.js, extended with yearLevel & sections
// ─────────────────────────────────────────────
let courses = [
  { code: 'COMP 016', title: 'Web Development',              classification: 'IT Common & Professional Course', yearLevel: 2, units: 3, sections: 5 },
  { code: 'COMP 015', title: 'Fundamentals of Research',     classification: 'IT Common & Professional Course', yearLevel: 1, units: 3, sections: 6 },
  { code: 'COMP 001', title: 'Introduction to Computing',    classification: 'IT Common & Professional Course', yearLevel: 1, units: 3, sections: 8 },
  { code: 'COMP 025', title: 'Project Management',           classification: 'IT Elective Course',             yearLevel: 3, units: 3, sections: 5 },
  { code: 'INTE 303', title: 'Capstone',                     classification: 'IT Common & Professional Course', yearLevel: 3, units: 6, sections: 8 },
  { code: 'COMP 018', title: 'Database Administration',      classification: 'IT Common & Professional Course', yearLevel: 3, units: 3, sections: 7 },
  { code: 'COMP 034', title: 'Introduction to Data Science', classification: 'IT Elective Course',             yearLevel: 1, units: 3, sections: 5 },
  { code: 'COMP 035', title: 'Data Mining',                  classification: 'IT Elective Course',             yearLevel: 3, units: 3, sections: 5 },
  { code: 'COMP 019', title: 'Application Development',      classification: 'IT Common & Professional Course', yearLevel: 3, units: 3, sections: 3 },
  { code: 'COMP 037', title: 'Machine Learning',             classification: 'IT Elective Course',             yearLevel: 2, units: 3, sections: 5 },
  { code: 'COMP 007', title: 'Operating Systems',            classification: 'IT Common & Professional Course', yearLevel: 2, units: 3, sections: 8 },
  { code: 'COMP 017', title: 'Multimedia',                   classification: 'IT Elective Course',             yearLevel: 3, units: 3, sections: 5 },
];

// Track unsaved changes
let dirty = false;

// ─────────────────────────────────────────────
//  RENDER TABLE
// ─────────────────────────────────────────────
const tbody = document.getElementById('mcTableBody');

function renderRows() {
  if (!tbody) return;
  tbody.innerHTML = '';

  courses.forEach((course, idx) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${course.code}</td>
      <td>${course.title}</td>
      <td class="mc-td--class">${course.classification}</td>
      <td class="mc-td--center">${course.yearLevel}</td>
      <td class="mc-td--center">${course.units ?? '—'}</td>
      <td class="mc-td--center">${course.sections}</td>
      <td class="mc-td--center">
        <div class="mc-actions">
          <button class="mc-action-btn mc-action-btn--edit" data-idx="${idx}" title="Edit">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="mc-action-btn mc-action-btn--delete" data-idx="${idx}" title="Delete">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.5 8a1 1 0 001 1h5a1 1 0 001-1l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

renderRows();

// ─────────────────────────────────────────────
//  TABLE BUTTON DELEGATION
// ─────────────────────────────────────────────
tbody?.addEventListener('click', e => {
  const editBtn   = e.target.closest('.mc-action-btn--edit');
  const deleteBtn = e.target.closest('.mc-action-btn--delete');

  if (editBtn) {
    openEditModal(parseInt(editBtn.dataset.idx, 10));
  }

  if (deleteBtn) {
    const idx = parseInt(deleteBtn.dataset.idx, 10);
    const row = deleteBtn.closest('tr');
    row.style.transition = 'opacity 0.18s';
    row.style.opacity = '0';
    setTimeout(() => {
      courses.splice(idx, 1);
      dirty = true;
      renderRows();
      showToast('Course removed.');
    }, 180);
  }
});

// ─────────────────────────────────────────────
//  ADD COURSE
// ─────────────────────────────────────────────
document.getElementById('addCourseBtn')?.addEventListener('click', () => {
  document.getElementById('editRowIndex').value       = '-1';
  document.getElementById('editCode').value           = '';
  document.getElementById('editUnits').value          = '';
  document.getElementById('editTitle').value          = '';
  document.getElementById('editClassification').value = '';
  document.getElementById('editYearLevel').value      = '';
  document.getElementById('editSections').value       = '';
  document.getElementById('editDescription').value    = '';
  document.getElementById('editModalTitle').textContent = 'ADD COURSE';
  openOverlay();
});

// ─────────────────────────────────────────────
//  EDIT MODAL
// ─────────────────────────────────────────────
const overlay    = document.getElementById('editOverlay');
const closeModal = document.getElementById('editModalClose');
const editCancel = document.getElementById('editCancelBtn');
const editSave   = document.getElementById('editSaveBtn');

function openEditModal(idx) {
  const c = courses[idx];
  document.getElementById('editRowIndex').value         = idx;
  document.getElementById('editCode').value             = c.code;
  document.getElementById('editUnits').value            = c.units || '';
  document.getElementById('editTitle').value            = c.title;
  document.getElementById('editClassification').value   = c.classification;
  document.getElementById('editYearLevel').value        = c.yearLevel;
  document.getElementById('editSections').value         = c.sections;
  document.getElementById('editDescription').value      = c.description || '';
  document.getElementById('editModalTitle').textContent = 'EDIT COURSE';
  openOverlay();
}

function openOverlay()  { overlay?.classList.add('mc-modal-overlay--open'); }
function closeOverlay() { overlay?.classList.remove('mc-modal-overlay--open'); }

closeModal?.addEventListener('click', closeOverlay);
editCancel?.addEventListener('click', closeOverlay);
overlay?.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

editSave?.addEventListener('click', () => {
  const idx         = parseInt(document.getElementById('editRowIndex').value, 10);
  const code        = document.getElementById('editCode').value.trim();
  const units       = document.getElementById('editUnits').value.trim();
  const title       = document.getElementById('editTitle').value.trim();
  const classif     = document.getElementById('editClassification').value.trim();
  const yearLevel   = document.getElementById('editYearLevel').value.trim();
  const sections    = parseInt(document.getElementById('editSections').value, 10) || 1;
  const description = document.getElementById('editDescription').value.trim();

  if (!code || !title) {
    showToast('Course code and title are required.', 'error');
    return;
  }

  const entry = { code, units, title, classification: classif, yearLevel, sections, description };

  if (idx === -1) {
    courses.push(entry);
  } else {
    courses[idx] = entry;
  }

  dirty = true;
  renderRows();
  closeOverlay();
  showToast(idx === -1 ? 'Course added.' : 'Course updated.');
});

// ─────────────────────────────────────────────
//  FOOTER BUTTONS
// ─────────────────────────────────────────────
document.getElementById('cancelBtn')?.addEventListener('click', () => {
  window.location.href = 'courses.html';
});

document.getElementById('saveBtn')?.addEventListener('click', () => {
  // In a real app: POST courses to backend
  dirty = false;
  showToast('Changes saved successfully.');
  setTimeout(() => window.location.href = 'courses.html', 1200);
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl    = null;
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'mc-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.background = type === 'error' ? '#C0392B' : 'var(--maroon)';
  toastEl.classList.add('mc-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('mc-toast--show'), 2800);
}

// Warn on unload if dirty
window.addEventListener('beforeunload', e => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
