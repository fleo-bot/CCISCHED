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

function getItems() {
  return [...list.querySelectorAll('.notif-item')];
}

function countUnread() {
  return getItems().filter(i => i.classList.contains('notif-item--unread')).length;
}

function syncUnreadBadge() {
  const n = countUnread();
  if (unreadCountEl) unreadCountEl.textContent = n;
}

function checkEmpty() {
  const visible = getItems().filter(i => i.style.display !== 'none');
  emptyState.style.display = visible.length === 0 ? 'flex' : 'none';
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
list.addEventListener('click', e => {
  if (e.target.closest('.notif-item__dismiss')) return;
  const item = e.target.closest('.notif-item');
  if (!item) return;
  item.classList.remove('notif-item--unread');
  const dot = item.querySelector('.notif-item__indicator');
  if (dot) dot.classList.add('notif-item__indicator--read');
  syncUnreadBadge();
});

// ── Mark all as read ──
document.getElementById('markAllBtn')?.addEventListener('click', () => {
  getItems().forEach(item => {
    item.classList.remove('notif-item--unread');
    const dot = item.querySelector('.notif-item__indicator');
    if (dot) dot.classList.add('notif-item__indicator--read');
  });
  syncUnreadBadge();
});

// ── Clear all ──
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
