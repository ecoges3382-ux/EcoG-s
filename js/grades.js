// ---- Bulletins ----
function renderGrades(){
  const withGrades = students.slice(0,10).map(s=>({...s, moyenne:(Math.round((10+rnd()*10)*10)/10), bulletinPret: rnd()>0.4}));
  return `
    <p class="page-title" style="margin:0 0 20px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Notes et bulletins</p>
    <div class="card-bold" style="padding:16px 20px;margin-bottom:20px;background:var(--gold-light);border-color:var(--gold);">
      <p style="margin:0;font-size:13px;color:var(--clay-dark);"><i class="ti ti-bell-ringing" style="font-size:15px;vertical-align:-2px;margin-right:6px;" aria-hidden="true"></i>Les parents reçoivent une notification dès qu'un bulletin est prêt ou qu'une nouvelle note est en ligne.</p>
    </div>
    <div class="card-bold" style="overflow:hidden;">
    ${withGrades.map((s,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;${i<withGrades.length-1?'border-bottom:1px solid var(--line);':''}">
        <div><p style="margin:0 0 3px;font-size:14px;font-weight:600;">${s.nom}</p><p style="margin:0;font-size:12px;color:var(--muted);">${s.niveau} · Moyenne : ${s.moyenne}/20</p></div>
        ${s.bulletinPret ? '<span style="background:var(--success-light);color:var(--success);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">Bulletin prêt</span>' : '<span style="background:#F0EDE5;color:var(--muted);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">En cours</span>'}
      </div>
    `).join('')}
    </div>
  `;
}
