// ---- Dashboard ----
function renderDashboard(){
  return `
    <p class="page-title" id="dashboard-greeting" style="margin:0 0 22px;font-family:var(--serif);font-size:26px;font-weight:600;color:var(--ink);">Bonjour ${schoolSettings.nom.split(' ').pop()}.</p>

    <div class="desktop-grid-2" style="display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-bottom:22px;">
      <div class="card-bold" style="padding:22px 24px;background:var(--forest);border-color:var(--forest);color:#fff;">
        <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.72);font-weight:600;">Taux de recouvrement — scolarité</p>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;">
          <p style="margin:0;font-family:var(--serif);font-size:46px;font-weight:700;line-height:1;">${tauxRecouv}%</p>
          <p style="margin:0;font-size:13.5px;color:rgba(255,255,255,0.65);">de ${fmt(totalDu)} F attendus</p>
        </div>
        <div style="height:9px;background:rgba(255,255,255,0.18);border-radius:8px;overflow:hidden;">
          <div style="height:100%;width:${tauxRecouv}%;background:var(--gold);"></div>
        </div>
      </div>
      <div class="card-bold" style="padding:22px 24px;">
        <p style="margin:0 0 10px;font-size:13px;color:var(--muted);font-weight:600;">Frais connexes</p>
        <p style="margin:0 0 4px;font-family:var(--serif);font-size:26px;font-weight:700;color:var(--clay-dark);">${Math.round(totalFraisConnexePaye/totalFraisConnexeDu*100)}%</p>
        <p style="margin:0;font-size:12px;color:var(--muted);">encaissés séparément du droit d'écolage</p>
      </div>
    </div>

    <div class="desktop-grid-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:26px;">
      <div class="card-bold" style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;color:var(--muted);font-weight:600;">Encaissé</p>
        <p style="margin:0;font-family:var(--serif);font-size:21px;font-weight:700;color:var(--success);">${fmt(totalPaye)} F</p>
      </div>
      <div class="card-bold" style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;color:var(--muted);font-weight:600;">Reste dû</p>
        <p style="margin:0;font-family:var(--serif);font-size:21px;font-weight:700;color:var(--danger);">${fmt(totalReste)} F</p>
      </div>
      <div class="card-bold" style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;color:var(--muted);font-weight:600;">Élèves</p>
        <p style="margin:0;font-family:var(--serif);font-size:21px;font-weight:700;">${students.length}</p>
      </div>
      <div class="card-bold" style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;color:var(--muted);font-weight:600;">Personnel</p>
        <p style="margin:0;font-family:var(--serif);font-size:21px;font-weight:700;">${STAFF.length}</p>
      </div>
    </div>

    <div class="desktop-split" style="display:grid;grid-template-columns:1.3fr 1fr;gap:20px;">
      <div class="card-bold" style="padding:20px 22px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <p style="margin:0;font-family:var(--serif);font-size:17px;font-weight:600;color:var(--ink);">Priorité du jour</p>
          <span style="font-size:12.5px;color:var(--muted);font-weight:600;">${critiques.length} familles</span>
        </div>
        ${critiques.slice(0,5).map((s,i)=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;${i<4?'border-bottom:1px solid var(--line);':''}cursor:pointer;" onclick='nav("student-detail", ${JSON.stringify(s)})'>
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:36px;height:36px;border-radius:10px;background:var(--clay-light);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:13px;font-weight:600;color:var(--clay-dark);flex-shrink:0;">${initials(s.nom)}</div>
              <div>
                <p style="margin:0;font-size:13.5px;font-weight:600;">${s.nom}</p>
                <p style="margin:0;font-size:11.5px;color:var(--muted);">${s.niveau} · ${s.retardJours} j de retard</p>
              </div>
            </div>
            <p style="margin:0;font-size:14px;color:var(--danger);font-weight:700;">${fmt(s.reste)} F</p>
          </div>
        `).join('')}
        <button style="width:100%;margin-top:16px;background:var(--clay);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px;border-radius:var(--radius);" onclick="sendPrompt('Lance les relances WhatsApp pour les familles en retard critique')">
          <i class="ti ti-brand-whatsapp" style="font-size:17px;vertical-align:-3px;margin-right:7px;" aria-hidden="true"></i>Relancer ces ${critiques.length} familles
        </button>
      </div>

      <div>
        <div class="card-bold" style="padding:18px 20px;margin-bottom:16px;background:var(--forest-light);border-color:var(--forest);">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:var(--forest-dark);"><i class="ti ti-bulb" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Recommandation</p>
          <p style="margin:0;font-size:13px;color:var(--forest-dark);line-height:1.6;">Le WhatsApp a généré 71 % des paiements après relance ce mois-ci. C'est le canal à privilégier.</p>
        </div>
        <div class="card-bold" style="padding:18px 20px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;">Rappels aux parents</p>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;">
            <span style="color:var(--muted);">Début de période</span><span style="font-weight:600;">42 envoyés</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;">
            <span style="color:var(--muted);">15 jours avant</span><span style="font-weight:600;">28 envoyés</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;">
            <span style="color:var(--muted);">7 jours avant</span><span style="font-weight:600;">${critiques.length+legers.length} envoyés</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
