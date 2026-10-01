/**
 * auth-check.js
 * -------------
 * Include this at the top of every protected page.
 * Checks if the user is logged in, redirects to login if not.
 * Sets global currentUser object.
 */

let currentUser = null;

(async function checkAuth() {
  try {
    const response = await API.getCurrentUser();
    currentUser = response.user;

    // Validate role on chairperson-only pages
    if (window.location.pathname.includes('/chairperson/') && currentUser.role !== 'chairperson') {
      window.location.href = '../login.html?error=access_denied&role=chairperson';
      return;
    }

    // Validate role on faculty-only pages
    if (window.location.pathname.includes('/faculty/') && currentUser.role !== 'faculty') {
      window.location.href = '../login.html?error=access_denied&role=faculty';
      return;
    }

    // Let other scripts on the page know currentUser is ready. Scripts that
    // load right after this one run immediately (synchronously) — before
    // this async function's API call has resolved — so anything reading
    // `currentUser` at top-level would otherwise always see null.
    document.dispatchEvent(new CustomEvent('authReady', { detail: currentUser }));

  } catch (err) {
    // API.getCurrentUser already redirects to login on 401, but handle other errors
    console.error('[Auth Check]', err);
  }
})();
