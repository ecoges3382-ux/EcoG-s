function renderParentView(){
  if(!parentSelectedChild) parentSelectedChild = critiques[0] || students[0];
  const s = parentSelectedChild;
  const otherChildren = students.filter(c=>c.id!==s.id).slice(0,2);

  return `
    <p class="page-title" style="margin:0 0 6px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Espace parent</p>
    <p style="margin:0 0 22px;font-size:13px;color:var(--muted);">Ce que voit un parent connecté — même contenu, sur ordinateur comme sur téléphone.</p>

    <div class="desktop-split" style="display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:start;">

      <div class="card-bold" style="padding:16px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.03em;">Mes enfants</p>
        <div onclick="selectParentChild(${s.id})" style="display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;background:var(--forest-light);margin-bottom:6px;cursor:pointer;">
          <div style="width:32px;height:32px;border-radius:9px;background:var(--forest);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:11px;font-weight:600;flex-shrink:0;">${initials(s.nom)}</div>
          <div><p style="margin:0;font-size:12.5px;font-weight:600;">${s.nom}</p><p style="margin:0;font-size:11px;color:var(--muted);">${s.niveau}</p></div>
        </div>
        ${otherChildren.map(c=>`
          <div onclick="selectParentChild(${c.id})" style="display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;cursor:pointer;margin-bottom:6px;">
            <div style="width:32px;height:32px;border-radius:9px;background:var(--clay-light);color:var(--clay-dark);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:11px;font-weight:600;flex-shrink:0;">${initials(c.nom)}</div>
            <div><p style="margin:0;font-size:12.5px;font-weight:600;">${c.nom}</p><p style="margin:0;font-size:11px;color:var(--muted);">${c.niveau}</p></div>
          </div>
        `).join('')}
      </div>

      <div>
        <div class="desktop-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
          <div class="card-bold" style="padding:16px 18px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:var(--muted);font-weight:600;">Reste à payer</p>
            <p style="margin:0;font-family:var(--serif);font-size:19px;font-weight:700;color:${s.reste>0?'var(--danger)':'var(--success)'};">${fmt(s.reste)} F</p>
          </div>
          <div class="card-bold" style="padding:16px 18px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:var(--muted);font-weight:600;">Frais connexes restants</p>
            <p style="margin:0;font-family:var(--serif);font-size:19px;font-weight:700;color:${s.fraisConnexeReste>0?'var(--amber)':'var(--success)'};">${fmt(s.fraisConnexeReste)} F</p>
          </div>
          <div class="card-bold" style="padding:16px 18px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:var(--muted);font-weight:600;">Classe</p>
            <p style="margin:0;font-family:var(--serif);font-size:19px;font-weight:700;">${s.niveau}</p>
          </div>
        </div>

        <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:17px;font-weight:600;color:var(--ink);">Rappels de paiement</p>
        <div class="desktop-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px;">
          <div class="card-bold" style="padding:14px 16px;border-left:4px solid var(--forest);border-radius:0 var(--radius) var(--radius) 0;">
            <p style="margin:0 0 5px;font-size:10.5px;font-weight:700;color:var(--forest);letter-spacing:0.03em;">DÉBUT DE PÉRIODE</p>
            <p style="margin:0;font-size:12.5px;line-height:1.5;">Échéance du trimestre fixée pour ${s.nom}.</p>
          </div>
          <div class="card-bold" style="padding:14px 16px;border-left:4px solid var(--amber);border-radius:0 var(--radius) var(--radius) 0;">
            <p style="margin:0 0 5px;font-size:10.5px;font-weight:700;color:var(--amber);letter-spacing:0.03em;">15 JOURS AVANT</p>
            <p style="margin:0;font-size:12.5px;line-height:1.5;">${fmt(s.reste)} F restants pour ${s.nom}.</p>
          </div>
          <div class="card-bold" style="padding:14px 16px;border-left:4px solid var(--danger);border-radius:0 var(--radius) var(--radius) 0;">
            <p style="margin:0 0 5px;font-size:10.5px;font-weight:700;color:var(--danger);letter-spacing:0.03em;">7 JOURS AVANT</p>
            <p style="margin:0;font-size:12.5px;line-height:1.5;">Dernier rappel : ${fmt(s.reste)} F.</p>
          </div>
        </div>

        <button style="background:var(--forest);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px 24px;border-radius:var(--radius);margin-bottom:24px;" onclick="sendPrompt('Paiement Mobile Money pour ${s.nom}')">
          <i class="ti ti-device-mobile" style="font-size:16px;vertical-align:-3px;margin-right:7px;" aria-hidden="true"></i>Payer par Mobile Money
        </button>

        <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:17px;font-weight:600;color:var(--ink);">Notes et bulletins</p>
        <div class="card-bold" style="padding:16px 18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div><p style="margin:0 0 3px;font-size:13.5px;font-weight:600;">Bulletin du 2ᵉ trimestre</p><p style="margin:0;font-size:12px;color:var(--muted);">Disponible pour consultation</p></div>
            <span style="background:var(--success-light);color:var(--success);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;">Prêt</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
function selectParentChild(id){
  parentSelectedChild = students.find(s=>s.id===id);
  document.getElementById('screen').innerHTML = renderParentView();
}
window.selectParentChild = selectParentChild;

// L'app démarre sur l'écran de connexion ; la navigation s'initialise via selectLoginRole().
