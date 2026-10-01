'use strict';

// ── Elements ──
const btnChairperson = document.getElementById('btnChairperson');
const btnFaculty     = document.getElementById('btnFaculty');
const roleInput      = document.getElementById('roleInput');
const cardSub        = document.getElementById('cardSub');
const emailInput     = document.getElementById('email');
const passwordInput  = document.getElementById('password');

// ── Placeholder hints per role ──
const PLACEHOLDERS = {
  chairperson: { email: 'chair@pup.edu.ph',    password: '••••••••••••' },
  faculty:     { email: 'bgarcia@pup.edu.ph',  password: '••••••••••••' },
};

// ── Switch role ──
function setRole(role) {
  roleInput.value = role;

  btnChairperson.classList.toggle('active', role === 'chairperson');
  btnFaculty.classList.toggle('active',     role === 'faculty');

  cardSub.textContent = role === 'chairperson' ? 'CHAIRPERSON PORTAL' : 'FACULTY PORTAL';

  emailInput.placeholder    = PLACEHOLDERS[role].email;
  passwordInput.placeholder = PLACEHOLDERS[role].password;
}

btnChairperson.addEventListener('click', () => setRole('chairperson'));
btnFaculty.addEventListener('click',     () => setRole('faculty'));

// ── Pre-select role from URL query param (?role=chairperson or ?role=faculty) ──
const urlRole = new URLSearchParams(window.location.search).get('role');
if (urlRole === 'faculty' || urlRole === 'chairperson') {
  setRole(urlRole);
}

// ── Show an error if we were bounced back here for using the wrong role ──
const urlError = new URLSearchParams(window.location.search).get('error');
if (urlError === 'access_denied') {
  const passwordErrorEl = document.getElementById('passwordError');
  if (passwordErrorEl) {
    passwordErrorEl.textContent = 'Access denied: that account does not have permission to view that portal. Please log in with the correct account.';
  }
}

// ── Password visibility toggle ──
const toggleBtn = document.getElementById('togglePassword');
const eyeIcon   = document.getElementById('eyeIcon');

const EYE_OPEN = `
  <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor" stroke-width="1.5"/>
  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
`;

const EYE_CLOSED = `
  <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor" stroke-width="1.5"/>
  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
`;

toggleBtn.addEventListener('click', () => {
  const showing       = passwordInput.type === 'password';
  passwordInput.type  = showing ? 'text' : 'password';
  eyeIcon.innerHTML   = showing ? EYE_CLOSED : EYE_OPEN;
});

// ── Validation ──
const form          = document.getElementById('loginForm');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitBtn     = document.getElementById('submitBtn');

function validateEmail(v) {
  if (!v)                                     return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
  return '';
}

function validatePassword(v) {
  if (!v) return 'Password is required.';
  const minLength = roleInput.value === 'faculty' ? 5 : 5;
  if (v.length < minLength) return `At least ${minLength} characters required.`;
  return '';
}

emailInput.addEventListener('blur',    () => { emailError.textContent    = validateEmail(emailInput.value.trim()); });
passwordInput.addEventListener('blur', () => { passwordError.textContent = validatePassword(passwordInput.value); });
emailInput.addEventListener('input',   () => { emailError.textContent    = ''; });
passwordInput.addEventListener('input',() => { passwordError.textContent = ''; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const eErr = validateEmail(emailInput.value.trim());
  const pErr = validatePassword(passwordInput.value);
  emailError.textContent    = eErr;
  passwordError.textContent = pErr;
  if (eErr || pErr) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  submitBtn.classList.add('loading');
  submitBtn.textContent = 'Logging in…';

  try {
    const response = await API.login(email, password);
    const user = response.user;
    const selectedRole = roleInput.value; // which tab was active when they submitted

    if (user.role !== selectedRole) {
      // Credentials were valid, but for the other portal. Reject explicitly
      // instead of silently logging them in and redirecting to their real
      // portal — end the session we just created so nothing is left active.
      await API.logout().catch(() => {});
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'LOGIN';
      const portalName = selectedRole === 'chairperson' ? 'Chairperson' : 'Faculty';
      passwordError.textContent = `That account is not a ${portalName.toLowerCase()} account. Please switch tabs above, or use the correct portal's credentials.`;
      return;
    }

    // Redirect based on role from backend
    if (user.role === 'chairperson') {
      window.location.href = 'chairperson/dashboard.html';
    } else {
      window.location.href = 'faculty/dashboard.html';
    }
  } catch (err) {
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'LOGIN';
    passwordError.textContent = err.message || 'Invalid email or password.';
  }
});
