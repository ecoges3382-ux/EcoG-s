// ---- Emploi du temps ----
function renderSchedule(){
  const classesDispo = [...new Set(scheduleData.map(s=>s.classe))];
  const filterOptions = scheduleView==='classe' ? classesDispo : ENSEIGNANTS;
  const filtered = scheduleData.filter(s => scheduleView==='classe' ? s.classe===scheduleFilter : s.enseignant===scheduleFilter);

  const rapides = filterOptions.slice(0,2);
  const quickChips = rapides.map(f=>{
    const active = scheduleFilter===f;
    return `<button onclick="setScheduleFilter('${f}')" style="flex-shrink:0;padding:8px 15px;border-radius:20px;font-size:12.5px;font-weight:600;border:1px solid ${active?'var(--forest)':'var(--line-strong)'};background:${active?'var(--forest)':'var(--paper)'};color:${active?'#fff':'var(--ink)'};">${f}</button>`;
  }).join('');
  const dropdownOnly = filterOptions.filter(f=>!rapides.includes(f));
  const isDropdownActive = dropdownOnly.includes(scheduleFilter);
  const dropdownOptions = dropdownOnly.map(f=>`<option value="${f}" ${scheduleFilter===f?'selected':''}>${f}</option>`).join('');

  return `
    <p class="page-title" style="margin:0 0 20px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Emploi du temps</p>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button onclick="setScheduleView('classe')" style="padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid ${scheduleView==='classe'?'var(--forest)':'var(--line-strong)'};background:${scheduleView==='classe'?'var(--forest)':'var(--paper)'};color:${scheduleView==='classe'?'#fff':'var(--ink)'};">Par classe</button>
      <button onclick="setScheduleView('enseignant')" style="padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid ${scheduleView==='enseignant'?'var(--forest)':'var(--line-strong)'};background:${scheduleView==='enseignant'?'var(--forest)':'var(--paper)'};color:${scheduleView==='enseignant'?'#fff':'var(--ink)'};">Par enseignant</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:24px;">
      ${quickChips}
      ${dropdownOnly.length ? `<select onchange="setScheduleFilter(this.value)" style="flex-shrink:0;padding:8px 13px;border-radius:20px;font-size:12.5px;font-weight:600;border:1px solid ${isDropdownActive?'var(--forest)':'var(--line-strong)'};background:${isDropdownActive?'var(--forest)':'var(--paper)'};color:${isDropdownActive?'#fff':'var(--ink)'};cursor:pointer;">
        <option value="" disabled ${!isDropdownActive?'selected':''}>${scheduleView==='classe'?'Autre classe…':'Autre enseignant…'}</option>
        ${dropdownOptions}
      </select>` : ''}
    </div>
    <div class="schedule-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;">
    ${JOURS.map(j=>{
      const coursJour = filtered.filter(s=>s.jour===j).sort((a,b)=>CRENEAUX.indexOf(a.creneau)-CRENEAUX.indexOf(b.creneau));
      return `<div>
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.03em;">${j}</p>
        ${coursJour.length===0 ? `<p style="font-size:12px;color:var(--muted);font-style:italic;">Aucun cours</p>` : coursJour.map(c=>`
          <div class="card-bold" style="padding:10px 12px;margin-bottom:8px;cursor:pointer;" onclick="sendPrompt('Modifier le cours de ${c.matiere} du ${c.jour} ${c.creneau}')">
            <p style="margin:0 0 2px;font-size:12.5px;font-weight:600;">${c.matiere}</p>
            <p style="margin:0 0 4px;font-size:11px;color:var(--muted);">${scheduleView==='classe' ? c.enseignant : c.classe}</p>
            <span style="font-size:11px;color:var(--forest);font-weight:600;">${c.creneau}</span>
          </div>
        `).join('')}
      </div>`;
    }).join('')}
    </div>
    <div class="card-bold" style="padding:16px 20px;margin:24px 0;background:var(--gold-light);border-color:var(--gold);">
      <p style="margin:0;font-size:12.5px;color:var(--clay-dark);line-height:1.6;">La détection automatique des conflits d'horaire sera ajoutée lors du développement réel — pas simulée dans cette maquette.</p>
    </div>
    <button style="background:var(--clay);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:var(--radius);" onclick="sendPrompt('Ajoute un nouveau créneau à l\\'emploi du temps de ${scheduleFilter}')"><i class="ti ti-plus" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Ajouter un créneau</button>
  `;
}
function setScheduleView(v){
  scheduleView=v; scheduleFilter = v==='classe' ? 'CM1' : ENSEIGNANTS[0];
  const isMobile = window.innerWidth <= 780;
  document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderSchedule();
}
window.setScheduleView = setScheduleView;
function setScheduleFilter(f){
  scheduleFilter=f;
  const isMobile = window.innerWidth <= 780;
  document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderSchedule();
}
window.setScheduleFilter = setScheduleFilter;
