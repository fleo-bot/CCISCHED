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
//  DATA — loaded from the real backend
// ─────────────────────────────────────────────
let courses = [];

async function loadCourses() {
  try {
    const data = await API.getCourses();
    courses = data.map(c => ({
      id:             c.id,
      code:           c.code,
      title:          c.title,
      classification: c.classification || '',
      yearLevel:      c.yearLevel || '',
      units:          c.units,
      sections:       c.sections,
      description:    c.description || '',
    }));
    renderRows();
  } catch (err) {
    showToast('Failed to load courses: ' + err.message, 'error');
  }
}

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
          <button class="mc-action-btn mc-action-btn--sections" data-idx="${idx}" title="Manage Sections">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="4" height="4" rx="0.7" stroke="currentColor" stroke-width="1.3"/>
              <rect x="8" y="2" width="4" height="4" rx="0.7" stroke="currentColor" stroke-width="1.3"/>
              <rect x="2" y="8" width="4" height="4" rx="0.7" stroke="currentColor" stroke-width="1.3"/>
              <rect x="8" y="8" width="4" height="4" rx="0.7" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </button>
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

loadCourses();

// ─────────────────────────────────────────────
//  TABLE BUTTON DELEGATION
// ─────────────────────────────────────────────
tbody?.addEventListener('click', e => {
  const editBtn     = e.target.closest('.mc-action-btn--edit');
  const deleteBtn   = e.target.closest('.mc-action-btn--delete');
  const sectionsBtn = e.target.closest('.mc-action-btn--sections');

  if (sectionsBtn) {
    openSectionsModal(parseInt(sectionsBtn.dataset.idx, 10));
  }

  if (editBtn) {
    openEditModal(parseInt(editBtn.dataset.idx, 10));
  }

  if (deleteBtn) {
    const idx = parseInt(deleteBtn.dataset.idx, 10);
    const course = courses[idx];
    const row = deleteBtn.closest('tr');

    API.deleteCourse(course.id).then(() => {
      row.style.transition = 'opacity 0.18s';
      row.style.opacity = '0';
      setTimeout(() => {
        courses.splice(idx, 1);
        renderRows();
        showToast('Course removed.');
      }, 180);
    }).catch(err => {
      showToast('Failed to delete course: ' + err.message, 'error');
    });
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
  document.getElementById('editSections').value       = '0';
  document.getElementById('editSections').disabled    = true;
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
  // Sections is a real count derived from actual Section rows, not editable here
  document.getElementById('editSections').value         = c.sections;
  document.getElementById('editSections').disabled      = true;
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

editSave?.addEventListener('click', async () => {
  const idx         = parseInt(document.getElementById('editRowIndex').value, 10);
  const code        = document.getElementById('editCode').value.trim();
  const units       = parseInt(document.getElementById('editUnits').value, 10) || 3;
  const title       = document.getElementById('editTitle').value.trim();
  const classif     = document.getElementById('editClassification').value.trim();
  const yearLevel   = document.getElementById('editYearLevel').value.trim();
  const description = document.getElementById('editDescription').value.trim();

  if (!code || !title) {
    showToast('Course code and title are required.', 'error');
    return;
  }

  const payload = { code, units, title, classification: classif, yearLevel, description };

  try {
    if (idx === -1) {
      const res = await API.addCourse(payload);
      courses.push({ ...payload, id: res.course.id, sections: 0 });
      showToast('Course added.');
    } else {
      const course = courses[idx];
      await API.editCourse(course.id, payload);
      courses[idx] = { ...course, ...payload };
      showToast('Course updated.');
    }
    renderRows();
    closeOverlay();
  } catch (err) {
    showToast('Failed to save course: ' + err.message, 'error');
  }
});

// ─────────────────────────────────────────────
//  SECTIONS MODAL
// ─────────────────────────────────────────────
const sectionsOverlay   = document.getElementById('sectionsOverlay');
const sectionsClose     = document.getElementById('sectionsModalClose');
const sectionsCloseBtn  = document.getElementById('sectionsCloseBtn');
const secSaveBtn        = document.getElementById('secSaveBtn');
const secCancelEditBtn  = document.getElementById('secCancelEditBtn');
const sectionsTableBody = document.getElementById('sectionsTableBody');

let roomsCache     = null;
let semestersCache = null;
let currentSections = [];

function openSectionsOverlay()  { sectionsOverlay?.classList.add('mc-modal-overlay--open'); }
function closeSectionsOverlay() { sectionsOverlay?.classList.remove('mc-modal-overlay--open'); }

sectionsClose?.addEventListener('click', closeSectionsOverlay);
sectionsCloseBtn?.addEventListener('click', closeSectionsOverlay);
sectionsOverlay?.addEventListener('click', e => { if (e.target === sectionsOverlay) closeSectionsOverlay(); });

async function ensureDropdownsLoaded() {
  if (!roomsCache) {
    roomsCache = await API.getRooms();
    const roomSelect = document.getElementById('secRoom');
    roomSelect.innerHTML = '<option value="">TBA</option>' +
      roomsCache.map(r => `<option value="${r.id}">${r.room_code} (${r.building})</option>`).join('');
  }
  if (!semestersCache) {
    semestersCache = await API.getSemesters();
    const semSelect = document.getElementById('secSemester');
    semSelect.innerHTML = semestersCache.map(s =>
      `<option value="${s.id}">${s.academic_year} — ${s.semester_term}${s.is_active ? ' (current)' : ''}</option>`
    ).join('');
    const active = semestersCache.find(s => s.is_active);
    if (active) semSelect.value = active.id;
  }
}

function resetSectionForm() {
  document.getElementById('editingSectionId').value = '';
  document.getElementById('secName').value  = '';
  document.getElementById('secDays').value  = '';
  document.getElementById('secStart').value = '';
  document.getElementById('secEnd').value   = '';
  document.getElementById('secRoom').value  = '';
  document.getElementById('secStatus').value = 'open';
  document.getElementById('sectionFormLabel').textContent = 'ADD NEW SECTION';
  document.getElementById('secSaveBtnLabel').textContent  = 'Add Section';
  secCancelEditBtn.style.display = 'none';
}

function renderSectionsTable() {
  if (currentSections.length === 0) {
    sectionsTableBody.innerHTML = `<tr><td colspan="7" class="mc-sections-table__empty">No sections yet — add one below.</td></tr>`;
    return;
  }
  sectionsTableBody.innerHTML = currentSections.map(s => `
    <tr>
      <td>${s.section_name}</td>
      <td>${s.preferred_days || '—'}</td>
      <td>${s.preferred_time_start && s.preferred_time_end ? `${s.preferred_time_start}–${s.preferred_time_end}` : '—'}</td>
      <td>${s.room_label}</td>
      <td>${semestersCache?.find(sem => sem.id === s.semester_id)?.academic_year || '—'}</td>
      <td style="text-transform:capitalize;">${s.status}</td>
      <td>
        <div class="mc-actions">
          <button class="mc-action-btn mc-action-btn--edit" data-sec-id="${s.id}" title="Edit">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="mc-action-btn mc-action-btn--delete" data-sec-id="${s.id}" title="Delete">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.5 8a1 1 0 001 1h5a1 1 0 001-1l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function openSectionsModal(courseIdx) {
  const course = courses[courseIdx];
  document.getElementById('sectionsCourseIdx').value = courseIdx;
  document.getElementById('sectionsModalTitle').textContent = `SECTIONS — ${course.code}`;
  resetSectionForm();

  try {
    await ensureDropdownsLoaded();
    currentSections = await API.getSections(course.id);
    renderSectionsTable();
    openSectionsOverlay();
  } catch (err) {
    showToast('Failed to load sections: ' + err.message, 'error');
  }
}

sectionsTableBody?.addEventListener('click', e => {
  const editBtn   = e.target.closest('.mc-action-btn--edit');
  const deleteBtn = e.target.closest('.mc-action-btn--delete');

  if (editBtn) {
    const sec = currentSections.find(s => s.id === parseInt(editBtn.dataset.secId, 10));
    if (!sec) return;
    document.getElementById('editingSectionId').value = sec.id;
    document.getElementById('secName').value   = sec.section_name;
    document.getElementById('secDays').value   = sec.preferred_days || '';
    document.getElementById('secStart').value  = sec.preferred_time_start || '';
    document.getElementById('secEnd').value    = sec.preferred_time_end || '';
    document.getElementById('secRoom').value   = sec.room_id || '';
    document.getElementById('secSemester').value = sec.semester_id;
    document.getElementById('secStatus').value = sec.status;
    document.getElementById('sectionFormLabel').textContent = `EDITING ${sec.section_name}`;
    document.getElementById('secSaveBtnLabel').textContent  = 'Update Section';
    secCancelEditBtn.style.display = '';
  }

  if (deleteBtn) {
    const secId = parseInt(deleteBtn.dataset.secId, 10);
    if (!confirm('Delete this section? This cannot be undone.')) return;

    API.deleteSection(secId).then(async () => {
      const courseIdx = parseInt(document.getElementById('sectionsCourseIdx').value, 10);
      currentSections = currentSections.filter(s => s.id !== secId);
      courses[courseIdx].sections = currentSections.length;
      renderSectionsTable();
      renderRows();
      showToast('Section removed.');
    }).catch(err => {
      showToast('Failed to delete section: ' + err.message, 'error');
    });
  }
});

secCancelEditBtn?.addEventListener('click', resetSectionForm);

secSaveBtn?.addEventListener('click', async () => {
  const courseIdx = parseInt(document.getElementById('sectionsCourseIdx').value, 10);
  const course = courses[courseIdx];
  const editingId = document.getElementById('editingSectionId').value;

  const payload = {
    course_id:            course.id,
    section_name:         document.getElementById('secName').value.trim(),
    preferred_days:       document.getElementById('secDays').value.trim(),
    preferred_time_start: document.getElementById('secStart').value,
    preferred_time_end:   document.getElementById('secEnd').value,
    room_id:              document.getElementById('secRoom').value || null,
    semester_id:          parseInt(document.getElementById('secSemester').value, 10),
    status:               document.getElementById('secStatus').value,
  };

  if (!payload.section_name) {
    showToast('Section name is required.', 'error');
    return;
  }

  try {
    if (editingId) {
      const res = await API.editSection(editingId, payload);
      const i = currentSections.findIndex(s => s.id === parseInt(editingId, 10));
      if (i !== -1) currentSections[i] = res.section;
      showToast('Section updated.');
    } else {
      const res = await API.addSection(payload);
      currentSections.push(res.section);
      course.sections = currentSections.length;
      showToast('Section added.');
    }
    renderSectionsTable();
    renderRows();
    resetSectionForm();
  } catch (err) {
    showToast('Failed to save section: ' + err.message, 'error');
  }
});

// ─────────────────────────────────────────────
//  FOOTER BUTTONS
// ─────────────────────────────────────────────
document.getElementById('cancelBtn')?.addEventListener('click', () => {
  window.location.href = 'courses.html';
});

document.getElementById('saveBtn')?.addEventListener('click', () => {
  // Every add/edit/delete above already saves to the backend immediately —
  // this button is just a "done, take me back" action now.
  window.location.href = 'courses.html';
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
