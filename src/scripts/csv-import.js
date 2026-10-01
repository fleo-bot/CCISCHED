'use strict';
(function () {
  const API_BASE = window.API_BASE || 'http://localhost:5000/api';
  const FALLBACK_DATASETS = [
    {key:'faculty',label:'Faculty',required:['faculty_id','first_name','last_name','webmail'],optional:['middle_name','age','gender','phone_number','specialization','academic_rank','department','max units','employment type','Avatar'],ignored:[],notes:['Faculty IDs must use the FA-### format.','Import faculty before availability or qualifications.']},
    {key:'semesters',label:'Semesters',required:['semester id','academic_year','semester_term','start_date','end_date'],optional:['max_units_per_faculty','is_active'],ignored:[],notes:['Dates must be valid YYYY-MM-DD values.']},
    {key:'courses',label:'Courses',required:['course_code','course_title','credited_units'],optional:['lec_units','lab_unit','year level','department','college','course_category','is active','program','Department'],ignored:[],notes:['course_code must be unique.']},
    {key:'rooms',label:'Rooms',required:['room_code','capacity'],optional:['building','floor number','room type','is active'],ignored:[],notes:['room_code must be unique.']},
    {key:'curriculum',label:'Program Curriculum',required:['program_code','course_code','year_level','semester_offered'],optional:['curriculum_id'],ignored:[],notes:['course_code must already exist in Courses.']},
    {key:'sections',label:'Sections / Cohorts',required:['section_id','section_name','program_code','semester_id','status'],optional:[],ignored:[],notes:['Import Semesters, Courses, and Curriculum before Sections.']},
    {key:'qualifications',label:'Faculty Course Qualifications',required:['faculty_id','course_code'],optional:['qualification_id','preference_rank'],ignored:[],notes:['Faculty IDs and course codes must already exist.','preference_rank is optional; when omitted it follows row order per faculty.']},
    {key:'availability',label:'Faculty Availability',required:['faculty_id','day_of_week','start_time','end_time'],optional:['shift_block','semester_id'],ignored:['availability_id'],notes:['Faculty must already exist and use FA-###.','Day names must be full and capitalized.','Times must use zero-padded 24-hour format such as 08:00:00.','Only rows for the currently active semester are imported (matched by semester_id).','Back-to-back shifts on the same day are merged into one slot.']},
    {key:'historical',label:'Historical Assignments',required:['assignment_id','faculty_id','course_code','section_id','semester_id','room_id','component_type','day _of_week','start_time','end_time','status'],optional:[],ignored:[],notes:['This dataset is stored as CSV training data for the RF model.']}
  ];
  const state = { datasets: FALLBACK_DATASETS.slice() };
  function injectStyles(){if(document.getElementById('csvImportStyles'))return;const s=document.createElement('style');s.id='csvImportStyles';s.textContent=`
  .csv-import-btn{border:1px solid #800000;background:#fff;color:#800000;border-radius:8px;padding:8px 12px;font:600 12px Raleway,sans-serif;cursor:pointer;margin-right:8px}.csv-import-btn:hover{background:#800000;color:#fff}
  .csv-import-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;z-index:99999}.csv-import-modal{width:min(720px,92vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:24px;color:#333;font-family:Raleway,sans-serif}.csv-import-modal h2{margin:0 0 8px;color:#800000;font-size:21px}.csv-import-modal p{font-size:13px;line-height:1.55;margin:7px 0 14px}.csv-import-warning{background:#fff8e8;border:1px solid #f0c36d;border-radius:10px;padding:13px;margin:12px 0}.csv-import-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.csv-import-field{display:flex;flex-direction:column;gap:5px}.csv-import-field label{font-size:12px;font-weight:700}.csv-import-field select,.csv-import-field input{padding:10px;border:1px solid #ddd;border-radius:8px;background:#fff}.csv-import-help{font-size:12px;line-height:1.55;background:#f8f8f8;border-radius:9px;padding:12px;margin-top:12px}.csv-import-help ul{margin:6px 0 0 18px;padding:0}.csv-import-help li{margin:4px 0}.csv-import-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.csv-import-actions button{padding:9px 14px;border-radius:8px;border:1px solid #800000;background:#fff;color:#800000;font-weight:700;cursor:pointer}.csv-import-actions .primary{background:#800000;color:#fff}.csv-import-status{margin-top:10px;font-size:12px}.csv-import-status.error{color:#a40000}.csv-import-status.ok{color:#167c3b}@media(max-width:620px){.csv-import-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
  async function api(path,options={}){const r=await fetch(API_BASE+path,{credentials:'include',...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
  const esc=v=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function meta(k){return state.datasets.find(x=>x.key===k)}
  function help(m){const el=document.getElementById('csvImportHelp');if(!m){el.innerHTML='';return}el.innerHTML=`<strong>Import requirements</strong><ul><li><strong>Required:</strong> ${(m.required||[]).map(x=>`<code>${esc(x)}</code>`).join(', ')}</li><li><strong>Optional:</strong> ${(m.optional||[]).map(x=>`<code>${esc(x)}</code>`).join(', ')||'None'}</li><li><strong>Ignored:</strong> ${(m.ignored||[]).map(x=>`<code>${esc(x)}</code>`).join(', ')||'None'}</li>${(m.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`}
  function close(){document.getElementById('csvImportOverlay')?.remove()}
  function open(){injectStyles();const o=document.createElement('div');o.className='csv-import-overlay';o.id='csvImportOverlay';o.innerHTML=`<div class="csv-import-modal" role="dialog" aria-modal="true"><h2>Import CSV Data</h2><p>Select the institutional dataset you want to import. The file is validated before it is applied.</p><div class="csv-import-warning"><strong>Important:</strong> Imported data can update existing records. Related records must already exist where required (for example, faculty before availability and courses before curriculum).</div><div class="csv-import-grid"><div class="csv-import-field"><label>Data type</label><select id="csvImportType"><option value="">Select data type...</option>${state.datasets.map(d=>`<option value="${esc(d.key)}">${esc(d.label)}</option>`).join('')}</select></div><div class="csv-import-field"><label>CSV file</label><input id="csvImportFile" type="file" accept=".csv,text/csv"></div></div><div class="csv-import-help" id="csvImportHelp"></div><div class="csv-import-status" id="csvImportStatus"></div><div class="csv-import-actions"><button id="csvImportCancel">Cancel</button><button class="primary" id="csvImportSubmit">Import CSV</button></div></div>`;document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)close()});document.getElementById('csvImportCancel').onclick=close;document.getElementById('csvImportType').onchange=e=>help(meta(e.target.value));document.getElementById('csvImportSubmit').onclick=submit}
  async function submit(){const type=document.getElementById('csvImportType').value,file=document.getElementById('csvImportFile').files[0],st=document.getElementById('csvImportStatus');if(!type){st.className='csv-import-status error';st.textContent='Please select a data type.';return}if(!file){st.className='csv-import-status error';st.textContent='Please select a CSV file.';return}if(!confirm(`Import ${file.name} as ${meta(type).label}? Existing records may be updated.`))return;const f=new FormData();f.append('file',file);st.className='csv-import-status';st.textContent='Importing…';try{const r=await api(`/manage/import/${encodeURIComponent(type)}`,{method:'POST',body:f});st.className='csv-import-status ok';st.textContent=r.message||'Import completed.';setTimeout(()=>location.reload(),900)}catch(e){st.className='csv-import-status error';st.textContent=e.message}}
  async function loadMetadata(){
    try{
      const remote=await api('/manage/import/datasets');
      if(Array.isArray(remote) && remote.length) state.datasets=remote;
    }catch(e){
      // Keep the local definitions. The modal can still open and explain the
      // requirements even if the metadata endpoint is temporarily unavailable.
      state.datasets=FALLBACK_DATASETS.slice();
    }
  }

  function bindButton(){
    injectStyles();
    const buttons=document.querySelectorAll('#csvImportBtn');
    buttons.forEach(b=>{
      b.type='button';
      b.onclick=null;
      b.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        open();
      }, {once:false});
    });
  }

  function init(){
    injectStyles();
    bindButton();
    // A delegated listener is an extra safeguard if another page script
    // replaces the header/button after this script loads.
    if(!window.__csvImportDelegated){
      document.addEventListener('click', function(ev){
        const b=ev.target.closest && ev.target.closest('#csvImportBtn');
        if(!b) return;
        ev.preventDefault();
        ev.stopPropagation();
        open();
      }, true);
      window.__csvImportDelegated=true;
    }
    loadMetadata();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }

})();
