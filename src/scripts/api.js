/**
 * api.js
 * ------
 * Central API utility for all backend calls.
 * Handles fetch, credentials, error responses, and redirects.
 */

// Use production backend URL (Render) or fallback to localhost for development
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? "http://localhost:5000/api"
  : "https://ccisched-backend.onrender.com/api";

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
    cache: "no-store",       // Always fetch fresh data (dashboard was going stale)
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

async function importAvailabilityCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(API_BASE + "/availability/import-csv", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (res.status === 401 && !window.location.pathname.includes("login.html")) {
    window.location.href = "../login.html";
    throw new Error("Unauthorized — redirecting to login");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function getSubmission(submissionId) {
  return apiFetch(`/availability/${submissionId}`);
}

async function deleteSubmission(submissionId) {
  return apiFetch(`/availability/${submissionId}`, { method: "DELETE" });
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

async function dismissNotification(notifId) {
  return apiFetch(`/notifications/${notifId}`, { method: "DELETE" });
}

async function clearAllNotifications() {
  return apiFetch("/notifications", { method: "DELETE" });
}

// ─────────────────────────────────────────────
//  SCHEDULE
// ─────────────────────────────────────────────
async function getMySchedule() {
  return apiFetch("/schedule");
}

async function getFacultyLoads() {
  return apiFetch("/schedule/loads");
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
//  COURSE / ROOM / SECTION MANAGEMENT
// ─────────────────────────────────────────────
async function getCourses() {
  return apiFetch("/manage/courses");
}

async function getCourseOfferingStatus(academicYear, semester) {
  const qs = new URLSearchParams({ academic_year: academicYear, semester });
  return apiFetch(`/generate/course-offering/status?${qs}`);
}

async function getCourseAssignments() {
  return apiFetch("/manage/course-assignments");
}

async function getFacultyCourseAssignments() {
  return apiFetch("/manage/faculty-course-assignments");
}

async function assignCourseToFaculty(courseId, facultyId) {
  return apiFetch("/manage/course-assignments", {
    method: "POST",
    body: JSON.stringify({ course_id: courseId, faculty_id: facultyId }),
  });
}

async function addCourse(course) {
  return apiFetch("/manage/courses", {
    method: "POST",
    body: JSON.stringify(course),
  });
}

async function editCourse(courseId, course) {
  return apiFetch(`/manage/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(course),
  });
}

async function deleteCourse(courseId) {
  return apiFetch(`/manage/courses/${courseId}`, { method: "DELETE" });
}

async function getRooms() {
  return apiFetch("/manage/rooms");
}

async function getRoomAvailability() {
  return apiFetch("/manage/room-availability");
}

async function getSections(courseId) {
  const qs = courseId ? `?course_id=${courseId}` : "";
  return apiFetch(`/manage/sections${qs}`);
}

async function getCoverage(semesterId) {
  const qs = semesterId ? `?semester_id=${semesterId}` : "";
  return apiFetch(`/manage/coverage${qs}`);
}

async function addSection(section) {
  return apiFetch("/manage/sections", {
    method: "POST",
    body: JSON.stringify(section),
  });
}

async function editSection(sectionId, section) {
  return apiFetch(`/manage/sections/${sectionId}`, {
    method: "PUT",
    body: JSON.stringify(section),
  });
}

async function deleteSection(sectionId) {
  return apiFetch(`/manage/sections/${sectionId}`, { method: "DELETE" });
}

async function getSemesters() {
  return apiFetch("/manage/semesters");
}

async function setActiveSemester(semesterId) {
  return apiFetch(`/manage/semesters/${semesterId}/activate`, { method: "POST" });
}

// ─────────────────────────────────────────────
//  FACULTY MANAGEMENT
// ─────────────────────────────────────────────
async function getFacultyList() {
  return apiFetch("/manage/faculty");
}

async function addFaculty(faculty) {
  return apiFetch("/manage/faculty", {
    method: "POST",
    body: JSON.stringify(faculty),
  });
}

async function addChairperson(chairperson) {
  return apiFetch("/manage/chairpersons", {
    method: "POST",
    body: JSON.stringify(chairperson),
  });
}

async function editFaculty(facultyId, faculty) {
  return apiFetch(`/manage/faculty/${facultyId}`, {
    method: "PUT",
    body: JSON.stringify(faculty),
  });
}

async function deleteFaculty(facultyId) {
  return apiFetch(`/manage/faculty/${facultyId}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────
//  SCHEDULING — two independent stages
// ─────────────────────────────────────────────
async function generateFacultyAssignment(academicYear, semester) {
  return apiFetch("/generate/assignment", {
    method: "POST",
    body: JSON.stringify({ academic_year: academicYear, semester }),
  });
}

async function approveFacultyAssignment(academicYear, semester) {
  return apiFetch("/generate/assignment/approve", {
    method: "POST",
    body: JSON.stringify({ academic_year: academicYear, semester }),
  });
}

async function discardFacultyAssignment(academicYear, semester) {
  return apiFetch("/generate/assignment/discard", {
    method: "POST",
    body: JSON.stringify({ academic_year: academicYear, semester }),
  });
}

async function getAssignmentStatus(academicYear, semester) {
  const qs = new URLSearchParams({ academic_year: academicYear, semester }).toString();
  return apiFetch(`/generate/assignment/status?${qs}`);
}

async function generateTimetable(academicYear, semester) {
  return apiFetch("/generate/timetable", {
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
  deleteSubmission,
  // Review
  approveSubmission,
  rejectSubmission,
  returnSubmission,
  // Notifications
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
  // Schedule
  getMySchedule,
  getFacultyLoads,
  getFacultySchedule,
  publishSchedule,
  // Course/Room/Section management
  getCourses,
  getCourseOfferingStatus,
  getCourseAssignments,
  getFacultyCourseAssignments,
  assignCourseToFaculty,
  addCourse,
  editCourse,
  deleteCourse,
  getRooms,
  getRoomAvailability,
  getSections,
  getCoverage,
  addSection,
  editSection,
  deleteSection,
  getSemesters,
  setActiveSemester,
  // Faculty management
  getFacultyList,
  addFaculty,
  addChairperson,
  editFaculty,
  deleteFaculty,
  // Legacy
  generateFacultyAssignment,
  approveFacultyAssignment,
  discardFacultyAssignment,
  getAssignmentStatus,
  generateTimetable,
  getHealthCheck,
};

// For ES module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = API;
}
