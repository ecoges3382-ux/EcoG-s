// ---- Annonces ----
function renderAnnounce(){
  const r = ROLES[currentRole];
  const peutEcole = (currentRole==='fondateur' || currentRole==='directeur' || currentRole==='secretaire');
  const porteeDefaut = peutEcole ? 'École entière' : r.classe;
  return `
    <p class="page-title" style="margin:0 0 20px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Annonces</p>
    <div class="card-bold" style="padding:20px 22px;margin-bottom:20px;max-width:640px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;">Nouvelle annonce — en tant que ${r.label}</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        ${peutEcole ? `<span style="padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;background:var(--forest);color:#fff;">École entière</span>` : ''}
        ${peutEcole ? `<span style="padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;background:var(--paper);border:1px solid var(--line-strong);">Une classe</span>` : `<span style="padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;background:var(--forest);color:#fff;">${r.classe} (votre classe)</span>`}
        ${peutEcole ? `<span style="padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;background:var(--paper);border:1px solid var(--line-strong);">Une famille</span>` : ''}
      </div>
      <button style="background:var(--clay);color:#fff;border:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:var(--radius);" onclick="sendPrompt('Rédige une annonce pour ${porteeDefaut}')"><i class="ti ti-speakerphone" style="font-size:15px;vertical-align:-2px;margin-right:6px;" aria-hidden="true"></i>Écrire une annonce</button>
    </div>
    <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);">Annonces récentes</p>
    <div class="card-bold" style="overflow:hidden;max-width:640px;">
    ${announcements.map((a,i)=>`
      <div style="padding:14px 20px;${i<announcements.length-1?'border-bottom:1px solid var(--line);':''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:${a.portee==='École entière'?'var(--forest-light)':'var(--gold-light)'};color:${a.portee==='École entière'?'var(--forest-dark)':'var(--clay-dark)'};">${a.portee}</span>
          <span style="font-size:11.5px;color:var(--muted);">${a.date}</span>
        </div>
        <p style="margin:0 0 3px;font-size:14px;font-weight:600;">${a.titre}</p>
        <p style="margin:0;font-size:12px;color:var(--muted);">${a.auteur} · ${a.role}</p>
      </div>
    `).join('')}
    </div>
  `;
}
