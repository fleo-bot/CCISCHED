'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Helpers ──
const list      = document.getElementById('notifList');
const emptyState = document.getElementById('notifEmpty');
const unreadCountEl = document.getElementById('unreadCount');

let notifications = [];

function getItems() {
  return [...list.querySelectorAll('.notif-item')];
}

function countUnread() {
  return notifications.filter(n => !n.is_read).length;
}

function syncUnreadBadge() {
  const n = countUnread();
  if (unreadCountEl) unreadCountEl.textContent = n;
}

function checkEmpty() {
  const visible = getItems().filter(i => i.style.display !== 'none');
  emptyState.style.display = visible.length === 0 ? 'flex' : 'none';
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
  }
}

// ── Render notifications ──
function renderNotifications() {
  list.innerHTML = '';
  
  if (notifications.length === 0) {
    checkEmpty();
    return;
  }

  notifications.forEach(notif => {
    const item = document.createElement('div');
    item.className = 'notif-item' + (notif.is_read ? '' : ' notif-item--unread');
    item.dataset.type = notif.notif_type;
    item.dataset.id = notif.id;
    
    const typeIcons = {
      submission_approved: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 10L8 14L16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      submission_rejected: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      submission_returned: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 4V16M10 4L6 8M10 4L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      schedule_published: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 8H17" stroke="currentColor" stroke-width="1.8"/>
      </svg>`,
    };
    
    const icon = typeIcons[notif.notif_type] || typeIcons.schedule_published;
    const timeAgo = formatTimeAgo(new Date(notif.created_at));
    
    item.innerHTML = `
      <div class="notif-item__indicator ${notif.is_read ? 'notif-item__indicator--read' : ''}"></div>
      <div class="notif-item__icon">${icon}</div>
      <div class="notif-item__body">
        <p class="notif-item__title">${notif.title}</p>
        <p class="notif-item__message">${notif.message}</p>
        <span class="notif-item__time">${timeAgo}</span>
      </div>
      <button class="notif-item__dismiss" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    
    list.appendChild(item);
  });
  
  checkEmpty();
}

// ── Time ago formatter ──
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Filter tabs ──
document.querySelectorAll('.notif-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('notif-tab--active'));
    tab.classList.add('notif-tab--active');

    const filter = tab.dataset.filter;
    getItems().forEach(item => {
      const type = item.dataset.type;
      const show =
        filter === 'all'      ? true :
        filter === 'unread'   ? item.classList.contains('notif-item--unread') :
        type === filter;
      item.style.display = show ? '' : 'none';
    });
    checkEmpty();
  });
});

// ── Dismiss individual ──
list.addEventListener('click', e => {
  const btn = e.target.closest('.notif-item__dismiss');
  if (!btn) return;
  const item = btn.closest('.notif-item');
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
  
  const notifId = parseInt(item.dataset.id);
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
    notifications.forEach(n => n.is_read = true);
    getItems().forEach(item => {
      item.classList.remove('notif-item--unread');
      const dot = item.querySelector('.notif-item__indicator');
      if (dot) dot.classList.add('notif-item__indicator--read');
    });
    syncUnreadBadge();
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
});

// ── Clear all (just hides locally — could add API endpoint to delete) ──
document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  getItems().forEach(item => {
    item.style.transition = 'opacity 0.2s';
    item.style.opacity = '0';
  });
  setTimeout(() => {
    getItems().forEach(item => item.remove());
    syncUnreadBadge();
    checkEmpty();
  }, 220);
});

// ── Search / filter ──
document.getElementById('notifSearch')?.addEventListener('input', function () {
  const q = this.value.trim().toLowerCase();
  getItems().forEach(item => {
    const text = item.querySelector('.notif-item__title')?.textContent.toLowerCase() +
                 item.querySelector('.notif-item__msg')?.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
  checkEmpty();
});

// ── Init ──
syncUnreadBadge();
checkEmpty();


// ── Init ──
loadNotifications();
