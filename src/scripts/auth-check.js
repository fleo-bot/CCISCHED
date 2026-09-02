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

    // Optional: validate role on chairperson-only pages
    if (window.location.pathname.includes('/chairperson/') && currentUser.role !== 'chairperson') {
      window.location.href = '../login.html';
    }

    // Optional: validate role on faculty-only pages
    if (window.location.pathname.includes('/faculty/') && currentUser.role !== 'faculty') {
      window.location.href = '../login.html';
    }

  } catch (err) {
    // API.getCurrentUser already redirects to login on 401, but handle other errors
    console.error('[Auth Check]', err);
  }
})();
