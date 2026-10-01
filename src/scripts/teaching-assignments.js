'use strict';

const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  topbarDate.textContent = `${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
document.getElementById('notifBtn')?.addEventListener('click', () => { window.location.href = 'notifications.html'; });

const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = value => {
  if (!value) return '';
  const parts = String(value).split(':');
  const h = Number(parts[0]), m = Number(parts[1] || 0);
  if (!Number.isFinite(h)) return String(value);
  const d = new Date(2000,0,1,h,m);
  return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
};
const termLabel = term => ({'1st':'1st Sem','2nd':'2nd Sem','summer':'Summer'}[String(term||'').toLowerCase()] || `${term || ''} Sem`);

function setMeta(semester, user) {
  const sub = document.getElementById('taPageSub');
  if (sub) sub.textContent = semester ? `${termLabel(semester.semester_term)} · AY ${semester.academic_year} · ${user ? `${user.first_name} ${user.last_name}` : 'Faculty'}` : 'No active semester';
  const sections = document.getElementById('taSectionsCount');
  const subjects = document.getElementById('taSubjectsCount');
  const sem = document.getElementById('taSemester');
  const ay = document.getElementById('taAcademicYear');
  if (sem) sem.textContent = semester ? termLabel(semester.semester_term) : '—';
  if (ay) ay.textContent = semester?.academic_year ? `AY ${semester.academic_year.slice(2,4)}–${semester.academic_year.slice(-2)}` : '—';
  return {sections, subjects};
}

function renderError(message) {
  const container = document.getElementById('taSections');
  if (container) container.innerHTML = `<div class="ta-card"><div class="ta-card__subjects"><p style="padding:24px;text-align:center;color:#777;">${escapeHtml(message)}</p></div></div>`;
}

function buildSubjectRows(subjects) {
  return subjects.map(subj => {
    const schedRows = subj.schedule.length
      ? subj.schedule.map(s => `<div class="ta-sched-row"><span class="ta-sched-row__day">${escapeHtml(DAY_SHORT[s.day] || s.day)}</span><span class="ta-sched-row__time">${escapeHtml(formatTime(s.start))} – ${escapeHtml(formatTime(s.end))}</span></div>`).join('')
      : '<div class="ta-sched-row"><span class="ta-sched-row__day">—</span><span class="ta-sched-row__time">Schedule not published</span></div>';
    const room = subj.rooms.length ? subj.rooms.join(', ') : 'Schedule not published';
    return `<div class="ta-subject"><div class="ta-subject__top"><div class="ta-subject__info"><p class="ta-subject__code">${escapeHtml(subj.code)}</p><p class="ta-subject__name">${escapeHtml(subj.name)}</p><div class="ta-subject__meta"><span class="ta-subject__type-badge">${escapeHtml(subj.type)}</span><span class="ta-subject__units">${escapeHtml(subj.units)} units</span></div></div><div class="ta-subject__room">${escapeHtml(room)}</div></div><div class="ta-subject__schedule">${schedRows}</div></div>`;
  }).join('');
}

async function loadTeachingAssignments() {
  try {
    const [assignmentData, scheduleData, user] = await Promise.all([
      getFacultyCourseAssignments(),
      getMySchedule(),
      getCurrentUser().catch(() => null),
    ]);
    const semester = assignmentData?.semester || scheduleData?.semester || null;
    const meta = setMeta(semester, user || assignmentData?.faculty);
    const me = assignmentData?.faculty?.find(f => Number(f.id) === Number(user?.id));
    // Backend may return all faculty; the logged-in user is the authoritative filter.
    const faculty = me || assignmentData?.faculty?.find(f => String(f.employee_number || '').toLowerCase() === String(user?.employee_number || '').toLowerCase());
    if (!faculty) {
      if (meta.sections) meta.sections.textContent = '0';
      if (meta.subjects) meta.subjects.textContent = '0';
      renderError('No teaching assignment data is available for the current faculty member.');
      return;
    }

    const schedule = Array.isArray(scheduleData?.schedule) ? scheduleData.schedule : [];
    const scheduleMap = new Map();
    schedule.forEach(row => {
      const key = `${row.course_code}::${row.section_name}`;
      if (!scheduleMap.has(key)) scheduleMap.set(key, []);
      scheduleMap.get(key).push(row);
    });

    const sectionMap = new Map();
    (faculty.courses || []).forEach(course => {
      (course.sections || []).forEach(sectionName => {
        if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, []);
        const rows = scheduleMap.get(`${course.code}::${sectionName}`) || [];
        const key = course.code;
        let subj = sectionMap.get(sectionName).find(x => x.code === key);
        if (!subj) {
          subj = { code: course.code, name: course.name, type: 'Lecture', units: course.units || 0, schedule: [], rooms: [] };
          sectionMap.get(sectionName).push(subj);
        }
        rows.forEach(r => {
          subj.type = r.class_type || subj.type;
          if (!subj.schedule.some(x => x.day === r.day && x.start === r.time_start && x.end === r.time_end)) subj.schedule.push({day:r.day,start:r.time_start,end:r.time_end});
          if (r.room && !subj.rooms.includes(r.room)) subj.rooms.push(r.room);
        });
      });
    });

    const sections = Array.from(sectionMap.entries());
    if (meta.sections) meta.sections.textContent = sections.length;
    if (meta.subjects) meta.subjects.textContent = (faculty.courses || []).length;
    const container = document.getElementById('taSections');
    if (!container) return;
    if (!sections.length) {
      renderError('No courses are currently assigned to you for the active semester.');
      return;
    }
    const colors = ['maroon','blue','gold','green'];
    container.innerHTML = sections.map(([section, subjects], idx) => `<div class="ta-card ta-card--${colors[idx % colors.length]}"><div class="ta-card__header"><div class="ta-card__header-left"><div class="ta-card__num">${idx+1}</div><div><p class="ta-card__section">${escapeHtml(section)}</p><p class="ta-card__program">${escapeHtml(faculty.program || faculty.department || 'CCIS')}</p></div></div><div class="ta-card__header-right"><span class="ta-card__count">${subjects.length} subject${subjects.length !== 1 ? 's' : ''}</span></div></div><p class="ta-card__prog-full">${escapeHtml(faculty.department || faculty.program || 'CCIS')}</p><div class="ta-card__subjects">${buildSubjectRows(subjects)}</div></div>`).join('');
  } catch (err) {
    console.error('[Teaching Assignments]', err);
    renderError('ERROR: Unable to load teaching assignments from the backend.');
  }
}

document.addEventListener('authReady', loadTeachingAssignments);
if (typeof getCurrentUser === 'function') loadTeachingAssignments();
