'use strict';

// Chairperson-only audit log viewer. Talks to GET /api/audit-logs
// (the backend enforces chairperson-only; auth-check.js also redirects
// non-chairpersons away from /chairperson/ pages).

const $ = (id) => document.getElementById(id);
const state = { page: 1, pages: 1, perPage: 25 };

const topbarDate = $('topbarDate');
if (topbarDate) {
  topbarDate.textContent = new Date().toLocaleDateString('en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    '<br><span class="audit-time">' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '</span>';
}

function queryString() {
  const p = new URLSearchParams();
  const add = (k, v) => { if (v) p.set(k, v); };
  add('user_id',  $('fUser').value);
  add('role',     $('fRole').value);
  add('category', $('fCategory').value);
  add('outcome',  $('fOutcome').value);
  add('date_from', $('fFrom').value);
  add('date_to',   $('fTo').value);
  add('q', $('auditSearch').value.trim());
  return p;
}

function detailsHtml(log) {
  // The sentence, plus the error (if it failed) and request body in a <details>.
  let extra = '';
  if (log.details) {
    const pretty = JSON.stringify(log.details, null, 2);
    extra = `<details class="audit-more"><summary>More</summary><pre>${esc(pretty)}</pre></details>`;
  }
  return `<div>${esc(log.description || '')}</div>${extra}`;
}

function render(data) {
  const body = $('auditBody');
  if (!data.logs.length) {
    body.innerHTML = '<tr><td colspan="5" class="audit-empty">No activity matches these filters.</td></tr>';
  } else {
    body.innerHTML = data.logs.map((l) => `
      <tr>
        <td class="audit-nowrap">${fmtTime(l.created_at)}</td>
        <td>
          <div class="audit-user">${esc(l.user_name || 'Unknown')}</div>
          ${l.user_role ? `<span class="audit-role audit-role--${esc(l.user_role)}">${esc(l.user_role)}</span>` : ''}
        </td>
        <td>
          <div class="audit-action">${esc(l.action)}</div>
          <span class="audit-cat">${esc(l.category || '')}</span>
        </td>
        <td>${detailsHtml(l)}</td>
        <td><span class="audit-pill ${l.success ? 'audit-pill--ok' : 'audit-pill--fail'}">
          ${l.success ? 'Success' : 'Failed'}${l.status_code ? ' · ' + l.status_code : ''}</span></td>
      </tr>`).join('');
  }
  state.page  = data.page;
  state.pages = data.pages || 1;
  $('auditCount').textContent = `${data.total} entr${data.total === 1 ? 'y' : 'ies'}`;
  $('pageLabel').textContent  = `Page ${state.page} of ${state.pages}`;
  $('prevBtn').disabled = state.page <= 1;
  $('nextBtn').disabled = state.page >= state.pages;
}

async function load() {
  const p = queryString();
  p.set('page', state.page);
  p.set('per_page', state.perPage);
  try {
    render(await apiFetch('/audit-logs?' + p.toString()));
  } catch (err) {
    $('auditBody').innerHTML =
      `<tr><td colspan="5" class="audit-empty">Couldn't load the audit log: ${esc(err.message)}</td></tr>`;
  }
}

async function loadFilters() {
  try {
    const f = await apiFetch('/audit-logs/filters');
    $('fUser').innerHTML = '<option value="">All users</option>' +
      f.users.map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.role)})</option>`).join('');
    $('fCategory').innerHTML = '<option value="">All categories</option>' +
      f.categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  } catch (err) { console.error('[audit filters]', err); }
}

function refilter() { state.page = 1; load(); }

['fUser', 'fRole', 'fCategory', 'fOutcome', 'fFrom', 'fTo']
  .forEach((id) => $(id).addEventListener('change', refilter));

let searchTimer;
$('auditSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refilter, 300);
});

$('resetBtn').addEventListener('click', () => {
  ['fUser', 'fRole', 'fCategory', 'fOutcome', 'fFrom', 'fTo', 'auditSearch']
    .forEach((id) => { $(id).value = ''; });
  refilter();
});
$('prevBtn').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
$('nextBtn').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); } });

// CSV export — needs the session cookie, so fetch as a blob rather than a plain link.
$('exportBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(API_BASE + '/audit-logs/export?' + queryString().toString(),
                            { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'audit_log.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) { alert('Export failed: ' + err.message); }
});

document.addEventListener('authReady', () => { loadFilters(); load(); });
