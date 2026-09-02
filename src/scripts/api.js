/**
 * api.js
 * ------
 * Central API utility for all backend calls.
 * Handles fetch, credentials, error responses, and redirects.
 */

const API_BASE = "http://localhost:5000/api";

/**
 * Make an authenticated API request.
 * @param {string} endpoint - e.g. "/auth/login"
 * @param {object} options - fetch options (method, body, headers)
 * @returns {Promise<any>} - parsed JSON response
 * @throws {Error} - if response is not ok or network fails
 */
async function apiFetch(endpoint, options = {}) {
  const url = API_BASE + endpoint;

  const config = {
    credentials: "include",  // Send cookies for session
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);

    // If 401 Unauthorized → redirect to login (except on login page itself)
    if (res.status === 401 && !window.location.pathname.includes("login.html")) {
      window.location.href = "../login.html";
      throw new Error("Unauthorized — redirecting to login");
    }

    // Parse JSON body
    const data = await res.json();

    // If response not ok, throw with backend error message
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────
async function login(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function logout() {
  return apiFetch("/auth/logout", { method: "POST" });
}

async function getCurrentUser() {
  return apiFetch("/auth/me");
}

// ─────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────
async function getProfile() {
  return apiFetch("/profile");
}

async function updateProfile(fields) {
  return apiFetch("/profile", {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

async function changePassword(currentPassword, newPassword) {
  return apiFetch("/profile/password", {
    method: "PATCH",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

// ─────────────────────────────────────────────
//  AVAILABILITY (Faculty)
// ─────────────────────────────────────────────
async function getMyAvailability() {
  return apiFetch("/availability");
}

async function saveAvailability(slots) {
  return apiFetch("/availability", {
    method: "POST",
    body: JSON.stringify({ slots }),
  });
}

async function finalizeAvailability() {
  return apiFetch("/availability/finalize", { method: "POST" });
}

async function deleteSlot(slotId) {
  return apiFetch(`/availability/slots/${slotId}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────
//  AVAILABILITY (Chairperson)
// ─────────────────────────────────────────────
async function getAllSubmissions() {
  return apiFetch("/availability/all");
}

async function getSubmission(submissionId) {
  return apiFetch(`/availability/${submissionId}`);
}

// ─────────────────────────────────────────────
//  REVIEW (Chairperson)
// ─────────────────────────────────────────────
async function approveSubmission(submissionId) {
  return apiFetch(`/review/${submissionId}/approve`, { method: "POST" });
}

async function rejectSubmission(submissionId, remarks) {
  return apiFetch(`/review/${submissionId}/reject`, {
    method: "POST",
    body: JSON.stringify({ remarks }),
  });
}

async function returnSubmission(submissionId, remarks) {
  return apiFetch(`/review/${submissionId}/return`, {
    method: "POST",
    body: JSON.stringify({ remarks }),
  });
}

// ─────────────────────────────────────────────
//  NOTIFICATIONS
// ─────────────────────────────────────────────
async function getNotifications() {
  return apiFetch("/notifications");
}

async function getUnreadCount() {
  return apiFetch("/notifications/unread");
}

async function markNotificationRead(notifId) {
  return apiFetch(`/notifications/${notifId}/read`, { method: "PATCH" });
}

async function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "PATCH" });
}

// ─────────────────────────────────────────────
//  SCHEDULE
// ─────────────────────────────────────────────
async function getMySchedule() {
  return apiFetch("/schedule");
}

async function getFacultySchedule(facultyId) {
  return apiFetch(`/schedule/${facultyId}`);
}

async function publishSchedule(assignments) {
  return apiFetch("/schedule/publish", {
    method: "POST",
    body: JSON.stringify({ assignments }),
  });
}

// ─────────────────────────────────────────────
//  LEGACY SCHEDULER (CSV-based)
// ─────────────────────────────────────────────
async function generateSchedule(academicYear, semester) {
  return apiFetch("/generate", {
    method: "POST",
    body: JSON.stringify({ academic_year: academicYear, semester }),
  });
}

async function getHealthCheck() {
  return apiFetch("/health");
}

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────
const API = {
  // Auth
  login,
  logout,
  getCurrentUser,
  // Profile
  getProfile,
  updateProfile,
  changePassword,
  // Availability
  getMyAvailability,
  saveAvailability,
  finalizeAvailability,
  deleteSlot,
  getAllSubmissions,
  getSubmission,
  // Review
  approveSubmission,
  rejectSubmission,
  returnSubmission,
  // Notifications
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Schedule
  getMySchedule,
  getFacultySchedule,
  publishSchedule,
  // Legacy
  generateSchedule,
  getHealthCheck,
};

// For ES module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = API;
}
