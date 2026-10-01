'use strict';

// This script runs on both chairperson/notifications.html and
// faculty/notifications.html — the two pages share the same markup and CSS,
// just with different tab labels ("Faculty" vs "Chairperson").

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
const MANILA_TIME_ZONE = 'Asia/Manila';
if (topbarDate) {
  const now = new Date();
  const dayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', timeZone: MANILA_TIME_ZONE
  }).format(now);
  const datePart = new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: MANILA_TIME_ZONE
  }).format(now);
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Helpers ──
const list         = document.getElementById('notifList');
const emptyState   = document.getElementById('notifEmpty');
const unreadCountEl = document.getElementById('unreadCount');

let notifications = [];
let activeFilter  = 'all';
let searchQuery   = '';

function getItems() {
  return [...list.querySelectorAll('.notif-item')];
}

function countUnread() {
  return notifications.filter(n => !n.is_read).length;
}

function syncUnreadBadge() {
  if (unreadCountEl) unreadCountEl.textContent = countUnread();
  // The shared bell badge (notif-badge.js) — guarded since not every page
  // that can host this script also has a bell badge to keep in sync.
  if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
}

function checkEmpty() {
  const visible = getItems().filter(i => i.style.display !== 'none');
  emptyState.style.display = visible.length === 0 ? 'flex' : 'none';
}

// ── What each backend notif_type means for this page: which tab it belongs
//    under, its accent color, and its icon. A chairperson only ever receives
//    "submission_received" (category "faculty"); a faculty member only ever
//    receives the submission_* decisions (category "chairperson") and
//    "schedule_published" (category "system") — so one table covers both
//    pages and each page's tabs only ever show what that role can get.
const ICONS = {
  inbox: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
    <path d="M3 19C3 15.686 6.134 13 10 13C13.866 13 17 15.686 17 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M4 10L8 14L16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  cross: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  returned: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M10 4V16M10 4L6 8M10 4L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  calendar: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="3" width="16" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/>
    <path d="M2 8H18" stroke="currentColor" stroke-width="1.8"/>
    <rect x="6" y="1" width="2" height="4" rx="1" fill="currentColor"/>
    <rect x="12" y="1" width="2" height="4" rx="1" fill="currentColor"/>
  </svg>`,
  alert: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M10 2L18.5 17H1.5L10 2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M10 8V11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="10" cy="14.2" r="1" fill="currentColor"/>
  </svg>`,
};

const TYPE_META = {
  submission_received: { category: 'faculty',     tagLabel: 'Faculty',     colorClass: 'chairperson', icon: ICONS.inbox },
  submission_approved:  { category: 'chairperson', tagLabel: 'Chairperson', colorClass: 'chairperson', icon: ICONS.check },
  submission_rejected:  { category: 'chairperson', tagLabel: 'Chairperson', colorClass: 'warning',     icon: ICONS.cross },
  submission_returned:  { category: 'chairperson', tagLabel: 'Chairperson', colorClass: 'warning',     icon: ICONS.returned },
  schedule_published:   { category: 'system',      tagLabel: 'System',      colorClass: 'system',      icon: ICONS.calendar },
  assignment_distributed: { category: 'system',    tagLabel: 'System',      colorClass: 'system',      icon: ICONS.inbox },
  timetable_distributed:  { category: 'system',    tagLabel: 'System',      colorClass: 'system',      icon: ICONS.calendar },
  faculty_inactive:     { category: 'faculty',     tagLabel: 'Faculty',     colorClass: 'warning',     icon: ICONS.alert },
  faculty_unassigned:   { category: 'faculty',     tagLabel: 'Faculty',     colorClass: 'warning',     icon: ICONS.alert },
};
const DEFAULT_META = { category: 'system', tagLabel: 'System', colorClass: 'system', icon: ICONS.calendar };

function metaFor(notifType) {
  return TYPE_META[notifType] || DEFAULT_META;
}

// ── Load notifications from API ──
async function loadNotifications() {
  try {
    const response = await API.getNotifications();
    notifications = response.notifications || [];
    renderNotifications();
    syncUnreadBadge();
  } catch (err) {
    console.error('Failed to load notifications:', err);
    list.innerHTML = '';
    emptyState.style.display = 'flex';
  }
}

// ── Render notifications ──
function renderNotifications() {
  list.innerHTML = '';

  notifications.forEach(notif => {
    const meta = metaFor(notif.notif_type);

    const item = document.createElement('div');
    item.className = 'notif-item' + (notif.is_read ? '' : ' notif-item--unread');
    item.dataset.category = meta.category;   // what the filter tabs match against
    item.dataset.id = notif.id;

    item.innerHTML = `
      <div class="notif-item__indicator ${notif.is_read ? 'notif-item__indicator--read' : ''}"></div>
      <div class="notif-item__icon notif-item__icon--${meta.colorClass}">${meta.icon}</div>
      <div class="notif-item__body">
        <div class="notif-item__row">
          <p class="notif-item__title"></p>
          <span class="notif-item__time">${formatNotificationDateTime(notif.created_at)}</span>
        </div>
        <p class="notif-item__msg"></p>
        <span class="notif-item__tag notif-item__tag--${meta.colorClass}">${meta.tagLabel}</span>
      </div>
      <button class="notif-item__dismiss" title="Dismiss" aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    // Title/message set via textContent, not innerHTML — notification text
    // reflects a faculty member's name (submission_received) and is never
    // trusted as markup.
    item.querySelector('.notif-item__title').textContent = notif.title;
    item.querySelector('.notif-item__msg').textContent   = notif.message;

    list.appendChild(item);
  });

  applyFilters();
}

// ── Notification sent date/time formatter ──
// Notification.created_at is created in UTC by the backend. If MySQL returns
// a timezone-free DATETIME, interpret it as UTC and display it in Manila time.
function parseNotificationDateTime(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value.trim()) return new Date(NaN);

  const normalized = value.trim().replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

function formatNotificationDateTime(dateValue) {
  const date = parseNotificationDateTime(dateValue);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  // Deliberately omit timeZoneName so the text is only date and time.
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MANILA_TIME_ZONE
  }).format(date);
}

// ── Filter tabs + search act together, so switching tabs keeps a typed
//    search and vice versa, instead of one silently overwriting the other ──
function applyFilters() {
  const q = searchQuery.trim().toLowerCase();
  getItems().forEach(item => {
    const inTab = activeFilter === 'all'    ? true :
                  activeFilter === 'unread' ? item.classList.contains('notif-item--unread') :
                  item.dataset.category === activeFilter;

    const text = (item.querySelector('.notif-item__title')?.textContent + ' ' +
                  item.querySelector('.notif-item__msg')?.textContent).toLowerCase();
    const inSearch = !q || text.includes(q);

    item.style.display = (inTab && inSearch) ? '' : 'none';
  });
  checkEmpty();
}

document.querySelectorAll('.notif-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('notif-tab--active'));
    tab.classList.add('notif-tab--active');
    activeFilter = tab.dataset.filter;
    applyFilters();
  });
});

document.getElementById('notifSearch')?.addEventListener('input', function () {
  searchQuery = this.value;
  applyFilters();
});

// ── Dismiss individual (persists — deletes the notification) ──
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('.notif-item__dismiss');
  if (!btn) return;
  const item = btn.closest('.notif-item');
  const notifId = parseInt(item.dataset.id, 10);

  try {
    await API.dismissNotification(notifId);
  } catch (err) {
    console.error('Failed to dismiss notification:', err);
    return; // leave it on screen — it wasn't actually removed
  }

  notifications = notifications.filter(n => n.id !== notifId);
  item.style.transition = 'opacity 0.2s, transform 0.2s';
  item.style.opacity = '0';
  item.style.transform = 'translateX(16px)';
  setTimeout(() => {
    item.remove();
    syncUnreadBadge();
    checkEmpty();
  }, 200);
});

// ── Click item to mark as read ──
list.addEventListener('click', async (e) => {
  if (e.target.closest('.notif-item__dismiss')) return;
  const item = e.target.closest('.notif-item');
  if (!item) return;

  const notifId = parseInt(item.dataset.id, 10);
  const notif = notifications.find(n => n.id === notifId);

  if (notif && !notif.is_read) {
    try {
      await API.markNotificationRead(notifId);
      notif.is_read = true;
      item.classList.remove('notif-item--unread');
      const dot = item.querySelector('.notif-item__indicator');
      if (dot) dot.classList.add('notif-item__indicator--read');
      syncUnreadBadge();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }
});

// ── Mark all as read ──
document.getElementById('markAllBtn')?.addEventListener('click', async () => {
  try {
    await API.markAllNotificationsRead();
  } catch (err) {
    console.error('Failed to mark all as read:', err);
    return;
  }
  notifications.forEach(n => n.is_read = true);
  getItems().forEach(item => {
    item.classList.remove('notif-item--unread');
    const dot = item.querySelector('.notif-item__indicator');
    if (dot) dot.classList.add('notif-item__indicator--read');
  });
  syncUnreadBadge();
});

// ── Clear all (persists — deletes every notification for this user) ──
document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
  if (notifications.length === 0) return;
  try {
    await API.clearAllNotifications();
  } catch (err) {
    console.error('Failed to clear notifications:', err);
    return;
  }
  notifications = [];
  getItems().forEach(item => {
    item.style.transition = 'opacity 0.2s';
    item.style.opacity = '0';
  });
  setTimeout(() => {
    list.innerHTML = '';
    syncUnreadBadge();
    checkEmpty();
  }, 220);
});

// ── Init ──
loadNotifications();
