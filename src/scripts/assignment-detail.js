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
//  chairperson-schedule.js after /api/generate).
//  Falls back to static mock when backend is off.
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore */ }

// dept_detail from the API is keyed "0" / "1" (strings) to match URL ?dept=0/1
const DEPT_DATA = _apiResult?.dept_detail ?? {
  0: {
    label: 'BSCS',
    title: 'GENERATED PREVIEW: BSCS DEPARTMENT',
    faculty: [
      { 
        name: 'Juan Dela Cruz',    
        type: 'Full-Time',             
        load: 15, 
        max: 15, 
        score: 88,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 101', desc: 'INTRODUCTION TO COMPUTING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 101', desc: 'INTRODUCTION TO COMPUTING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 102', desc: 'DATABASE ADMINISTRATION', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 017', desc: 'MULTIMEDIA', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'High historical ranking for COMP101 and optimal alignment with preferred Monday/Wednesday availability.'
      },
      { 
        name: 'Maria Santos',      
        type: 'Part-Time',             
        load: 12, 
        max: 12, 
        score: 90,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 201', desc: 'DATA STRUCTURES', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 202', desc: 'ALGORITHMS', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 203', desc: 'SOFTWARE ENGINEERING', type: 'LABORATORY', units: 3.0 },
        ],
        justification: 'Excellent performance history with data structures courses and strong student feedback ratings.'
      },
      { 
        name: 'Ana Cruz',          
        type: 'Designee|Chairperson',  
        load:  6, 
        max:  6, 
        score: 94,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 301', desc: 'THESIS WRITING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 302', desc: 'RESEARCH METHODS', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Chairperson designation with reduced load. Specialization in research and thesis supervision.'
      },
      { 
        name: 'Ben Torres',        
        type: 'Part-Time',             
        load: 12, 
        max: 12, 
        score: 89,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 150', desc: 'WEB DEVELOPMENT', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 151', desc: 'WEB DEVELOPMENT', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 152', desc: 'MOBILE APP DEVELOPMENT', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Strong industry background in web technologies and consistent positive student evaluations.'
      },
      { 
        name: 'Andrea Gonzales',   
        type: 'Full-Time',             
        load: 15, 
        max: 15, 
        score: 91,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 110', desc: 'PROGRAMMING FUNDAMENTALS', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 111', desc: 'PROGRAMMING FUNDAMENTALS', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 112', desc: 'OBJECT-ORIENTED PROGRAMMING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 113', desc: 'OBJECT-ORIENTED PROGRAMMING', type: 'LABORATORY', units: 3.0 },
        ],
        justification: 'Extensive experience teaching foundational programming courses with high success rates.'
      },
      { 
        name: 'Leo Reyes',         
        type: 'Full-Time',             
        load: 14, 
        max: 15, 
        score: 86,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 220', desc: 'COMPUTER NETWORKS', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 221', desc: 'COMPUTER NETWORKS', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 222', desc: 'NETWORK SECURITY', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 223', desc: 'CYBERSECURITY', type: 'LABORATORY', units: 2.0 },
        ],
        justification: 'Network security specialist with industry certifications and preferred afternoon schedule availability.'
      },
      { 
        name: 'Carla Mendoza',     
        type: 'Part-Time',             
        load:  9, 
        max: 12, 
        score: 83,
        department: 'Computer Science',
        courses: [
          { code: 'COMP 180', desc: 'HUMAN-COMPUTER INTERACTION', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 181', desc: 'UI/UX DESIGN', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 182', desc: 'GRAPHICS DESIGN', type: 'LABORATORY', units: 3.0 },
        ],
        justification: 'Design background with strong portfolio and alignment with Tuesday/Thursday availability.'
      },
    ],
  },
  1: {
    label: 'BSIT',
    title: 'GENERATED PREVIEW: BSIT DEPARTMENT',
    faculty: [
      { 
        name: 'Juan Dela Cruz',    
        type: 'Full-Time',             
        load: 15, 
        max: 15, 
        score: 88,
        department: 'Information Technology',
        courses: [
          { code: 'COMP 101', desc: 'INTRODUCTION TO COMPUTING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 101', desc: 'INTRODUCTION TO COMPUTING', type: 'LECTURE', units: 3.0 },
          { code: 'COMP 102', desc: 'DATABASE ADMINISTRATION', type: 'LABORATORY', units: 3.0 },
          { code: 'COMP 017', desc: 'MULTIMEDIA', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'High historical ranking for COMP101 and optimal alignment with preferred Monday/Wednesday availability.'
      },
      { 
        name: 'Maria Santos',      
        type: 'Part-Time',             
        load: 12, 
        max: 12, 
        score: 90,
        department: 'Information Technology',
        courses: [
          { code: 'IT 201', desc: 'SYSTEMS ANALYSIS AND DESIGN', type: 'LECTURE', units: 3.0 },
          { code: 'IT 202', desc: 'IT PROJECT MANAGEMENT', type: 'LECTURE', units: 3.0 },
          { code: 'IT 203', desc: 'ENTERPRISE ARCHITECTURE', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Business analysis expertise and strong track record with systems design courses.'
      },
      { 
        name: 'Ana Cruz',          
        type: 'Designee|Chairperson',  
        load:  6, 
        max:  6, 
        score: 94,
        department: 'Information Technology',
        courses: [
          { code: 'IT 301', desc: 'CAPSTONE PROJECT', type: 'LECTURE', units: 3.0 },
          { code: 'IT 302', desc: 'IT RESEARCH', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Chairperson designation with reduced load. Focus on senior capstone and research supervision.'
      },
      { 
        name: 'Ben Torres',        
        type: 'Part-Time',             
        load: 12, 
        max: 12, 
        score: 89,
        department: 'Information Technology',
        courses: [
          { code: 'IT 150', desc: 'WEB SYSTEMS AND TECHNOLOGIES', type: 'LECTURE', units: 3.0 },
          { code: 'IT 151', desc: 'WEB SYSTEMS AND TECHNOLOGIES', type: 'LABORATORY', units: 3.0 },
          { code: 'IT 152', desc: 'CLOUD COMPUTING', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Cloud computing certification and web development experience align with course requirements.'
      },
      { 
        name: 'Andrea Gonzales',   
        type: 'Full-Time',             
        load: 15, 
        max: 15, 
        score: 91,
        department: 'Information Technology',
        courses: [
          { code: 'IT 110', desc: 'FUNDAMENTALS OF DATABASE SYSTEMS', type: 'LECTURE', units: 3.0 },
          { code: 'IT 111', desc: 'FUNDAMENTALS OF DATABASE SYSTEMS', type: 'LABORATORY', units: 3.0 },
          { code: 'IT 112', desc: 'DATA WAREHOUSING', type: 'LECTURE', units: 3.0 },
          { code: 'IT 113', desc: 'BIG DATA ANALYTICS', type: 'LABORATORY', units: 3.0 },
        ],
        justification: 'Database administration specialist with advanced certifications and full availability.'
      },
      { 
        name: 'Sofia Dela Peña',   
        type: 'Full-Time',             
        load: 10, 
        max: 15, 
        score: 85,
        department: 'Information Technology',
        courses: [
          { code: 'IT 170', desc: 'IT INFRASTRUCTURE', type: 'LECTURE', units: 3.0 },
          { code: 'IT 171', desc: 'IT INFRASTRUCTURE', type: 'LABORATORY', units: 3.0 },
          { code: 'IT 172', desc: 'SYSTEMS ADMINISTRATION', type: 'LABORATORY', units: 2.0 },
        ],
        justification: 'Infrastructure expertise with preference for morning classes matching course schedule.'
      },
      { 
        name: 'Mark Villanueva',   
        type: 'Full-Time',             
        load: 14, 
        max: 15, 
        score: 92,
        department: 'Information Technology',
        courses: [
          { code: 'IT 220', desc: 'INFORMATION SECURITY', type: 'LECTURE', units: 3.0 },
          { code: 'IT 221', desc: 'INFORMATION SECURITY', type: 'LABORATORY', units: 3.0 },
          { code: 'IT 222', desc: 'ETHICAL HACKING', type: 'LECTURE', units: 3.0 },
          { code: 'IT 223', desc: 'NETWORK DEFENSE', type: 'LABORATORY', units: 2.0 },
        ],
        justification: 'Cybersecurity specialization with industry experience and optimal schedule alignment.'
      },
      { 
        name: 'Rico Aguilar',      
        type: 'Part-Time',             
        load:  4, 
        max: 12, 
        score: 80,
        department: 'Information Technology',
        courses: [
          { code: 'IT 180', desc: 'EMERGING TECHNOLOGIES', type: 'LECTURE', units: 3.0 },
        ],
        justification: 'Industry professional bringing real-world emerging tech insights with limited availability.'
      },
    ],
  },
};

// ─────────────────────────────────────────────
//  READ dept INDEX FROM URL
// ─────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const deptIdx = parseInt(params.get('dept') ?? '1', 10);
const data    = DEPT_DATA[deptIdx] ?? DEPT_DATA[1];

// Set page title
const titleEl = document.getElementById('deptTitle');
if (titleEl) titleEl.textContent = data.title;

// ─────────────────────────────────────────────
//  RENDER ROWS
// ─────────────────────────────────────────────
const adRows = document.getElementById('adRows');
let searchQuery = '';

function renderRows(query = '') {
  if (!adRows) return;
  adRows.innerHTML = '';

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
