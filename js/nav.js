function nav(tab, param){
  document.querySelectorAll('.navlink').forEach(el=>{
    let isActive = el.dataset.nav===tab;
    if(el.closest('#bottomnav') && el.dataset.nav==='school-group' && SCHOOL_TABS.includes(tab)) isActive = true;
    if(el.closest('#sidebar')){
      el.style.background = isActive ? 'rgba(255,255,255,0.14)' : 'transparent';
    } else if(el.closest('#bottomnav')){
      el.classList.toggle('active', isActive);
    }
  });
  const screen = document.getElementById('screen');
  screen.dataset.current = tab;
  const isMobile = window.innerWidth <= 780;
  if(tab==='dashboard') screen.innerHTML = renderDashboard();
  else if(tab==='money') screen.innerHTML = renderMoneyTabs();
  else if(tab==='students'){ schoolSubSection='students'; screen.innerHTML = isMobile ? renderSchoolHub() : renderStudents(); }
  else if(tab==='staff'){ schoolSubSection='staff'; screen.innerHTML = isMobile ? renderSchoolHub() : renderStaff(); }
  else if(tab==='grades'){ schoolSubSection='grades'; screen.innerHTML = isMobile ? renderSchoolHub() : renderGrades(); }
  else if(tab==='schedule'){ schoolSubSection='schedule'; screen.innerHTML = isMobile ? renderSchoolHub() : renderSchedule(); }
  else if(tab==='announce'){ schoolSubSection='announce'; screen.innerHTML = isMobile ? renderSchoolHub() : renderAnnounce(); }
  else if(tab==='settings') screen.innerHTML = renderSettings();
  else if(tab==='parent') screen.innerHTML = renderParentView();
  else if(tab==='student-detail') screen.innerHTML = renderStudentDetail(param);
  window.scrollTo(0,0);
}
window.nav = nav;

function navSchool(){ nav(schoolSubSection); }
window.navSchool = navSchool;

function setSchoolSub(tab){ nav(tab); }
window.setSchoolSub = setSchoolSub;

function renderSchoolHub(){
  const labels = { students:'Élèves', staff:'Personnel', grades:'Bulletins', schedule:'Emploi du temps', announce:'Annonces' };
  const icons = { students:'ti-users', staff:'ti-id-badge-2', grades:'ti-certificate', schedule:'ti-calendar-time', announce:'ti-speakerphone' };
  const tabs = `<div style="display:flex;gap:7px;overflow-x:auto;margin:0 -14px 18px;padding:0 14px 4px;">
    ${SCHOOL_TABS.map(t=>`<button onclick="setSchoolSub('${t}')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:8px 15px;border-radius:20px;font-size:12.5px;font-weight:600;border:1px solid ${schoolSubSection===t?'var(--forest)':'var(--line-strong)'};background:${schoolSubSection===t?'var(--forest)':'var(--paper)'};color:${schoolSubSection===t?'#fff':'var(--ink)'};white-space:nowrap;"><i class="ti ${icons[t]}" style="font-size:14px;" aria-hidden="true"></i>${labels[t]}</button>`).join('')}
  </div>`;
  let content;
  if(schoolSubSection==='students') content = renderStudents();
  else if(schoolSubSection==='staff') content = renderStaff();
  else if(schoolSubSection==='grades') content = renderGrades();
  else if(schoolSubSection==='schedule') content = renderSchedule();
  else content = renderAnnounce();
  return tabs + content;
}

function statusBadge(statut){
  if(statut==='a_jour') return '<span style="background:var(--success-light);color:var(--success);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">À jour</span>';
  if(statut==='retard_leger') return '<span style="background:var(--amber-light);color:var(--amber);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">Retard léger</span>';
  return '<span style="background:var(--danger-light);color:var(--danger);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">Retard critique</span>';
}
function prioriteBadge(p){
  if(p==='haute') return '<span style="background:var(--danger);color:#fff;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;">Priorité haute</span>';
  if(p==='moyenne') return '<span style="background:var(--amber-light);color:var(--amber);font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;">À surveiller</span>';
  return '';
}
