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
//  ASSIGNMENT DATA — loaded from sessionStorage
//  (written by chairperson-faculty.js's Generate Faculty Assignment flow —
//  Stage 1 only, no day/time. Separate key from 'ccisched_result', which is
//  the Stage 2/timetable flow's own result.)
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_assignment_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore */ }

const ASSIGNMENTS = _apiResult?.dept_summary ?? [
  {
    department: 'Bachelor of Science in Computer Science',
    totalFaculty: 0,
    status: 'Completed',
  },
  {
    department: 'Bachelor of Science in Information Technology',
    totalFaculty: 0,
    status: 'Completed',
  },
];

// ─────────────────────────────────────────────
//  RENDER TABLE ROWS
// ─────────────────────────────────────────────
const gaBody = document.getElementById('gaBody');

function renderRows() {
  if (!gaBody) return;
  gaBody.innerHTML = '';

  ASSIGNMENTS.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'ga-row';
    row.innerHTML = `
      <span class="ga-row__dept">${item.department}</span>
      <span class="ga-row__faculty">${item.totalFaculty}</span>
      <span class="ga-row__status">${item.status}</span>
      <div class="ga-row__actions">
        <button class="ga-view-btn" data-idx="${idx}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="7" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          View
        </button>
      </div>
    `;
    gaBody.appendChild(row);
  });
}

renderRows();

// ─────────────────────────────────────────────
//  VIEW BUTTON DELEGATION
// ─────────────────────────────────────────────
gaBody?.addEventListener('click', e => {
  const btn = e.target.closest('.ga-view-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  window.location.href = `assignment-detail.html?dept=${idx}`;
});

// ─────────────────────────────────────────────
//  PDF EXPORT — real, direct file download via jsPDF + autoTable
//  (previously opened a print dialog and relied on the user manually
//  choosing "Save as PDF" themselves)
// ─────────────────────────────────────────────
function buildAssignmentsPDF() {
  const deptDetail = _apiResult?.dept_detail ?? {};
  const depts = Object.values(deptDetail).filter(d => d.faculty && d.faculty.length);

  if (!depts.length) {
    showToast('No generated assignment data to export.', 'error');
    return null;
  }
  if (!window.jspdf?.jsPDF) {
    showToast('PDF library failed to load — check your connection and try again.', 'error');
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const MAROON  = [128, 0, 0];
  const margin  = 40;
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFillColor(...MAROON);
  doc.rect(margin, y, pageW - margin * 2, 46, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GENERATED FACULTY ASSIGNMENTS', margin + 14, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${_apiResult?.academic_year || ''}   \u00b7   ${_apiResult?.semester || ''} Semester`,
            margin + 14, y + 36);
  y += 46 + 22;

  depts.forEach(dept => {
    if (y > pageH - 90) { doc.addPage(); y = margin; }
    doc.setTextColor(...MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(dept.title, margin, y);
    y += 18;

    dept.faculty.forEach(f => {
      if (y > pageH - 110) { doc.addPage(); y = margin; }
      doc.setTextColor(...MAROON);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`${f.name}   \u00b7   ${f.type}   \u00b7   Load: ${f.load}/${f.max}`, margin, y);
      y += 8;

      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Code', 'Course', 'Type', 'Units']],
        body: f.courses.map(c => [c.code, c.desc, c.type, String(c.units)]),
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 30, 30] },
        headStyles: { fillColor: MAROON, textColor: 255, fontSize: 8, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 248, 248] },
      });
      y = doc.lastAutoTable.finalY + 20;
    });
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `CCISched   \u00b7   Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}   \u00b7   Page ${i} of ${pageCount}`,
      pageW / 2, pageH - 20, { align: 'center' }
    );
  }

  const ay  = (_apiResult?.academic_year || 'AY').replace(/\s+/g, '');
  const sem = (_apiResult?.semester || '').replace(/\s+/g, '');
  return { doc, filename: `Faculty-Assignments_${ay}_${sem}.pdf` };
}

function exportAllToPDF() {
  const result = buildAssignmentsPDF();
  if (!result) return;
  result.doc.save(result.filename);
  showToast('PDF saved.');
}

function printAllPDF() {
  const result = buildAssignmentsPDF();
  if (!result) return;
  printPdfDoc(result.doc);
}

document.getElementById('exportPdfBtn')?.addEventListener('click', exportAllToPDF);
document.getElementById('printPdfBtn')?.addEventListener('click', printAllPDF);

// ─────────────────────────────────────────────
//  BOTTOM ACTIONS
// ─────────────────────────────────────────────
document.getElementById('discardAllBtn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const ay  = _apiResult?.academic_year;
  const sem = _apiResult?.semester;

  if (!ay || !sem) {
    sessionStorage.removeItem('ccisched_assignment_result');
    showToast('All assignments discarded.');
    setTimeout(() => window.location.href = 'faculty.html', 1200);
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Discarding…';

  try {
    await API.discardFacultyAssignment(ay, sem);
    sessionStorage.removeItem('ccisched_assignment_result');
    showToast('All assignments discarded.');
    setTimeout(() => window.location.href = 'faculty.html', 1200);
  } catch (err) {
    showToast('Failed to discard assignments: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

document.getElementById('approveAllBtn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const ay  = _apiResult?.academic_year;
  const sem = _apiResult?.semester;

  if (!_apiResult?.faculty_assignment?.length || !ay || !sem) {
    showToast('No generated assignments found to save. Please generate first.', 'error');
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await API.approveFacultyAssignment(ay, sem);
    showToast('All assignments approved and saved.');
    setTimeout(() => window.location.href = 'faculty.html', 1400);
  } catch (err) {
    showToast('Failed to save assignments: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
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
  toastEl.style.background = type === 'error' ? '#C0392B' : 'var(--maroon)';
  toastEl.classList.add('ga-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('ga-toast--show'), 2800);
}
