/**
 * notif-badge.js
 * --------------
 * Keeps every page's bell badge (".notif-badge") in sync with the signed-in
 * user's real unread notification count, instead of the hardcoded "4" / "3"
 * that used to sit in the markup on every page.
 *
 * Include this once per page, after auth-check.js. Pages that render their
 * own notification list (notifications.html) additionally call
 * refreshNotifBadge() themselves whenever the count changes locally (read,
 * dismiss, ...) so the badge updates without a reload.
 */
'use strict';

async function refreshNotifBadge() {
  const badges = document.querySelectorAll('.notif-badge');
  if (!badges.length) return;

  let count = 0;
  try {
    const res = await API.getUnreadCount();
    count = res.unread_count || 0;
  } catch (err) {
    console.error('[NotifBadge] Failed to load unread count:', err);
    return; // leave the badge as-is rather than show a stale/fake number
  }

  badges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  });
}

document.addEventListener('authReady', refreshNotifBadge);
