'use strict';

// ── Check for availability submission notifications ──
function checkAvailabilityNotifications() {
  try {
    const notifs = sessionStorage.getItem('faculty_notifications');
    if (!notifs) return;
    
    const notifications = JSON.parse(notifs);
    const latestNotif = notifications[notifications.length - 1];
    
    if (latestNotif && latestNotif.facultyName) {
      // Assuming current faculty (in real app, match by facultyId)
      showAvailabilityAlert(latestNotif);
      
      // Clear notification after showing (optional - or keep for history)
      // sessionStorage.removeItem('faculty_notifications');
    }
  } catch { /* silent fail */ }
}

function showAvailabilityAlert(notif) {
  const pageBody = document.querySelector('.page-body');
  if (!pageBody) return;
  
  const existingAlert = document.getElementById('availabilityAlert');
  if (existingAlert) existingAlert.remove();
  
  let alertClass = '';
  let icon = '';
  let title = '';
  let message = '';
  
  if (notif.action === 'approved') {
    alertClass = 'profile-alert--success';
    icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 12L9 17L20 6" stroke="currentColor" stroke-width="2.5" 
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
    title = 'Availability Submission Approved';
    message = 'Your availability submission for 1st Semester AY 2025-2026 has been approved by the chairperson.';
  } else if (notif.action === 'return') {
    alertClass = 'profile-alert--info';
    icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 4V20M12 4L6 10M12 4L18 10" stroke="currentColor" stroke-width="2.5" 
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
    title = 'Availability Submission Returned';
    message = `Your submission has been returned for revision. Reason: "${notif.reason || 'Please review and resubmit.'}"`;
  } else if (notif.action === 'reject') {
    alertClass = 'profile-alert--error';
    icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" stroke-width="2.5" 
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
    title = 'Availability Submission Rejected';
    message = 'Your availability submission has been rejected by the chairperson. Please submit a new availability form.';
  }
  
  const alert = document.createElement('div');
  alert.id = 'availabilityAlert';
  alert.className = `profile-alert ${alertClass}`;
  alert.innerHTML = `
    <div class="profile-alert__icon">${icon}</div>
    <div class="profile-alert__content">
      <p class="profile-alert__title">${title}</p>
      <p class="profile-alert__message">${message}</p>
    </div>
    <button class="profile-alert__close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="2" 
              stroke-linecap="round"/>
      </svg>
    </button>
  `;
  
  pageBody.insertBefore(alert, pageBody.firstChild);
}

// Check on page load
checkAvailabilityNotifications();

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Tab switching ──
const tabs   = document.querySelectorAll('.profile-tab');
const panels = document.querySelectorAll('.profile-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab
    tabs.forEach(t => t.classList.remove('profile-tab--active'));
    tab.classList.add('profile-tab--active');

    // Show matching panel
    const target = tab.dataset.tab;
    panels.forEach(panel => {
      panel.style.display = panel.id === `tab-${target}` ? 'block' : 'none';
    });
  });
});

// ── Password visibility toggle ──
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    // Swap icon opacity to signal state
    btn.style.color = input.type === 'text'
      ? 'rgba(255,255,255,0.90)'
      : 'rgba(255,255,255,0.45)';
  });
});


// ── Personal form — fetch profile and save via API ──
const personalForm    = document.getElementById('personalForm');
const personalDiscard = document.getElementById('personalDiscard');
let personalOriginal  = {};

async function loadProfile() {
  try {
    const response = await API.getProfile();
    const user = response.user;
    document.getElementById('profileLoadError')?.remove();

    // Header: name + role shown next to the avatar
    const nameEl = document.querySelector('.profile-left__name');
    if (nameEl) nameEl.textContent = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
    const roleEl = document.querySelector('.profile-left__role');
    if (roleEl) roleEl.textContent = user.role === 'chairperson' ? 'Chairperson' : 'Faculty';

    // Avatar follows the saved gender (was hardcoded to female for everyone)
    const avatarEl = document.querySelector('.profile-left__avatar');
    if (avatarEl && (user.gender === 'male' || user.gender === 'female')) {
      avatarEl.src = `../assets/images/avatar-${user.gender}.svg`;
    }

    // Populate form fields (guarded — not every page that includes this
    // script has every field, e.g. chairperson/profile.html currently uses
    // static placeholder inputs with no ids)
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    setVal('firstName', user.first_name);
    setVal('middleName', user.middle_name);
    setVal('lastName', user.last_name);
    setVal('email', user.email);
    setVal('age', user.age);
    setVal('role', user.role === 'chairperson' ? 'Chairperson' : 'Faculty');
    setVal('department', user.department);
    setVal('contactNumber', user.contact_number);
    setVal('employeeNumber', user.employee_number);

    const genderEl = document.getElementById('gender');
    if (genderEl) genderEl.value = user.gender || 'female';

    // Academic fields
    setVal('specialization', user.specialization);
    setVal('rank', user.academic_rank);
    setVal('education', user.highest_educ_attainment);
    setVal('experience', user.exp_years);
    setVal('preferredCourses', user.preferred_courses);
    setVal('subjectsAssigned', `${user.subjects_assigned_count ?? 0} Subjects Assigned`);

    const employmentTypeEl = document.getElementById('employmentType');
    if (employmentTypeEl) employmentTypeEl.value = user.employment_type || 'Full Time';

    // Save originals for discard
    personalOriginal = {
      firstName: user.first_name || '',
      middleName: user.middle_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      age: user.age || '',
      department: user.department || '',
      gender: user.gender || 'female',
      contactNumber: user.contact_number || '',
    };

    academicOriginal = {
      specialization: user.specialization || '',
      rank: user.academic_rank || '',
      education: user.highest_educ_attainment || '',
      experience: user.exp_years || '',
      preferredCourses: user.preferred_courses || '',
      employmentType: user.employment_type || 'Full Time',
    };

  } catch (err) {
    console.error('[loadProfile]', err);
    const nameEl = document.querySelector('.profile-left__name');
    if (nameEl) nameEl.textContent = 'Profile unavailable';
    showLoadError('Could not load your profile from the server (' + err.message +
                  '). Nothing below reflects your saved data, so don\'t save. ' +
                  'Check that the backend is running, then refresh.');
  }
}

function showLoadError(msg) {
  let box = document.getElementById('profileLoadError');
  if (!box) {
    box = document.createElement('div');
    box.id = 'profileLoadError';
    box.style.cssText = 'margin:0 0 14px;padding:12px 16px;border-radius:12px;' +
      'background:#FDE8E8;color:#B42318;font-size:0.8rem;font-weight:700;';
    const body = document.querySelector('.page-body');
    if (body) body.insertBefore(box, body.firstChild);
  }
  box.textContent = msg;
}

loadProfile();

if (personalForm) {
  personalDiscard?.addEventListener('click', () => {
    document.getElementById('firstName').value = personalOriginal.firstName;
    document.getElementById('middleName').value = personalOriginal.middleName;
    document.getElementById('lastName').value = personalOriginal.lastName;
    document.getElementById('email').value = personalOriginal.email;
    document.getElementById('age').value = personalOriginal.age;
    document.getElementById('department').value = personalOriginal.department;
    document.getElementById('gender').value = personalOriginal.gender;
    document.getElementById('contactNumber').value = personalOriginal.contactNumber;
  });

  personalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.updateProfile({
        first_name: document.getElementById('firstName').value.trim(),
        middle_name: document.getElementById('middleName').value.trim(),
        last_name: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        age: document.getElementById('age').value,
        department: document.getElementById('department').value.trim(),
        gender: document.getElementById('gender').value,
        contact_number: document.getElementById('contactNumber').value.trim(),
      });
      showToast('Personal information saved.');
      loadProfile(); // Refresh
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  });
}

// ── Academic form ──
const academicForm    = document.getElementById('academicForm');
const academicDiscard = document.getElementById('academicDiscard');
let academicOriginal  = {};

if (academicForm) {
  academicDiscard?.addEventListener('click', () => {
    document.getElementById('specialization').value = academicOriginal.specialization;
    document.getElementById('rank').value = academicOriginal.rank;
    document.getElementById('education').value = academicOriginal.education;
    document.getElementById('experience').value = academicOriginal.experience;
    document.getElementById('preferredCourses').value = academicOriginal.preferredCourses;
    document.getElementById('employmentType').value = academicOriginal.employmentType;
  });

  academicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.updateProfile({
        specialization: document.getElementById('specialization').value.trim(),
        academic_rank: document.getElementById('rank').value.trim(),
        highest_educ_attainment: document.getElementById('education').value.trim(),
        exp_years: Math.max(parseInt(document.getElementById('experience').value, 10) || 0, 0),
        preferred_courses: document.getElementById('preferredCourses').value.trim(),
        employment_type: document.getElementById('employmentType').value,
      });
      showToast('Academic profile saved.');
      loadProfile();
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  });
}

// ── Security form — change password via API ──
const securityForm = document.getElementById('securityForm');

if (securityForm) {
  securityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPw = document.getElementById('currentPw').value;
    const newPw     = document.getElementById('newPw').value;
    const confirmPw = document.getElementById('confirmPw').value;

    if (!currentPw || !newPw || !confirmPw) {
      showToast('Please fill in all password fields.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('New passwords do not match.', 'error');
      document.getElementById('confirmPw').style.borderColor = '#FF6B6B';
      return;
    }
    document.getElementById('confirmPw').style.borderColor = '';

    try {
      await API.changePassword(currentPw, newPw);
      showToast('Password updated successfully.');
      securityForm.reset();
    } catch (err) {
      showToast('Failed to update password: ' + err.message, 'error');
    }
  });
}

// ── Toast helper ──
function showToast(message, type = 'success') {
  let toast = document.getElementById('profileToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'profileToast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; right: 28px;
      padding: 12px 22px; border-radius: 50px;
      font-family: Raleway, sans-serif; font-size: 0.80rem; font-weight: 700;
      color: white; z-index: 9999;
      box-shadow: 0 4px 18px rgba(0,0,0,0.18);
      transition: opacity 0.3s, transform 0.3s;
      opacity: 0; transform: translateY(8px);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#C0392B' : '#800000';
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, 3000);
}
