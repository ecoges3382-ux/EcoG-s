// ---- Argent ----
function renderMoneyTabs(){
  const tabs = `<p class="page-title" style="margin:0 0 20px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Argent</p>
  <div style="display:flex;gap:8px;overflow-x:auto;margin:0 -14px 22px;padding:0 14px 4px;">
    <button onclick="setMoneySubTab('vue')" style="flex-shrink:0;padding:9px 18px;border-radius:10px;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid ${moneySubTab==='vue'?'var(--forest)':'var(--line-strong)'};background:${moneySubTab==='vue'?'var(--forest)':'var(--paper)'};color:${moneySubTab==='vue'?'#fff':'var(--ink)'};">Droit d'écolage</button>
    <button onclick="setMoneySubTab('connexe')" style="flex-shrink:0;padding:9px 18px;border-radius:10px;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid ${moneySubTab==='connexe'?'var(--forest)':'var(--line-strong)'};background:${moneySubTab==='connexe'?'var(--forest)':'var(--paper)'};color:${moneySubTab==='connexe'?'#fff':'var(--ink)'};">Frais connexes</button>
    <button onclick="setMoneySubTab('compta')" style="flex-shrink:0;padding:9px 18px;border-radius:10px;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid ${moneySubTab==='compta'?'var(--forest)':'var(--line-strong)'};background:${moneySubTab==='compta'?'var(--forest)':'var(--paper)'};color:${moneySubTab==='compta'?'#fff':'var(--ink)'};">Dépenses</button>
    <button onclick="setMoneySubTab('avances')" style="flex-shrink:0;padding:9px 18px;border-radius:10px;font-size:13.5px;font-weight:600;white-space:nowrap;border:1px solid ${moneySubTab==='avances'?'var(--forest)':'var(--line-strong)'};background:${moneySubTab==='avances'?'var(--forest)':'var(--paper)'};color:${moneySubTab==='avances'?'#fff':'var(--ink)'};">Avances sur salaire</button>
  </div>`;
  let content;
  if(moneySubTab==='vue') content = renderMoneyVue();
  else if(moneySubTab==='connexe') content = renderFraisConnexes();
  else if(moneySubTab==='compta') content = renderCompta();
  else content = renderAvances();
  return tabs + content;
}
function setMoneySubTab(t){ moneySubTab=t; document.getElementById('screen').innerHTML = renderMoneyTabs(); }
window.setMoneySubTab = setMoneySubTab;

function decideAvance(id, nouveauStatut){
  const labels = { approuvee:'approuvée', refusee:'refusée', attente_directeur:'transmise au directeur avec avis favorable' };
  sendPrompt(`Demande d'avance #${id} : ${labels[nouveauStatut] || nouveauStatut} (action enregistrée par ${ROLES[currentRole].label})`);
}
window.decideAvance = decideAvance;

function renderMoneyVue(){
  return `
    <div class="card-bold" style="padding:16px 20px;margin-bottom:20px;background:var(--gold-light);border-color:var(--gold);">
      <p style="margin:0;font-size:13px;color:var(--clay-dark);line-height:1.6;"><i class="ti ti-sparkles" style="font-size:15px;vertical-align:-2px;margin-right:6px;" aria-hidden="true"></i>Droit d'écolage uniquement — les frais connexes (uniforme, cantine, carte scolaire...) sont suivis séparément dans leur propre onglet.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;" class="desktop-grid-3">
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Attendu</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;">${fmt(totalDu)} F</p>
      </div>
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Familles en retard</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--danger);">${critiques.length+legers.length}</p>
      </div>
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Taux de recouvrement</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--success);">${tauxRecouv}%</p>
      </div>
    </div>
    <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);">Priorité de relance</p>
    <div class="card-bold" style="overflow:hidden;margin-bottom:20px;">
    ${critiques.slice(0,6).map((s,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;${i<Math.min(critiques.length,6)-1?'border-bottom:1px solid var(--line);':''}cursor:pointer;" onclick='nav("student-detail", ${JSON.stringify(s)})'>
        <div>
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;">${s.nom}</p>
          <div style="display:flex;align-items:center;gap:7px;">${prioriteBadge(s.priorite)}<span style="font-size:12px;color:var(--muted);">${s.retardJours} j · efficace : ${s.canalEfficace}</span></div>
        </div>
        <p style="margin:0;font-size:15px;color:var(--danger);font-weight:700;">${fmt(s.reste)} F</p>
      </div>
    `).join('')}
    </div>
    <button style="background:var(--clay);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:var(--radius);" onclick="sendPrompt('Lance les relances WhatsApp pour toutes les familles prioritaires')">
      <i class="ti ti-brand-whatsapp" style="font-size:17px;vertical-align:-3px;margin-right:7px;" aria-hidden="true"></i>Relancer les familles prioritaires
    </button>
  `;
}

function renderFraisConnexes(){
  const enRetard = students.filter(s=>s.fraisConnexeReste>0);
  const taux = Math.round(totalFraisConnexePaye/totalFraisConnexeDu*100);
  return `
    <div class="card-bold" style="padding:16px 20px;margin-bottom:20px;background:var(--forest-light);border-color:var(--forest);">
      <p style="margin:0;font-size:13px;color:var(--forest-dark);line-height:1.6;">Uniforme, carte scolaire, polycopiés, cantine, tenue de sport — suivi indépendant du droit d'écolage, avec le statut de chaque élève à jour ici.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;" class="desktop-grid-3">
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Attendu</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;">${fmt(totalFraisConnexeDu)} F</p>
      </div>
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Encaissé</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--success);">${fmt(totalFraisConnexePaye)} F</p>
      </div>
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Taux</p>
        <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;">${taux}%</p>
      </div>
    </div>
    <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);">Liste des élèves — frais connexes</p>
    <div class="card-bold" style="overflow-x:auto;">
    <div style="min-width:560px;">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:12px 20px;background:var(--forest-light);font-size:11.5px;font-weight:700;color:var(--forest-dark);text-transform:uppercase;letter-spacing:0.03em;">
      <span>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
    </div>
    ${students.slice(0,15).map((s,i)=>`
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:12px 20px;align-items:center;${i<14?'border-bottom:1px solid var(--line);':''}">
        <span style="font-size:13.5px;font-weight:600;">${s.nom}</span>
        <span style="font-size:13px;color:var(--muted);">${s.niveau}</span>
        <span style="font-size:13px;">${fmt(s.fraisConnexeDu)} F</span>
        <span style="font-size:13px;">${fmt(s.fraisConnexePaye)} F</span>
        <span>${s.fraisConnexeReste===0 ? statusBadge('a_jour') : statusBadge('retard_leger')}</span>
      </div>
    `).join('')}
    </div>
    </div>
  `;
}

function renderCompta(){
  const depenses = [
    { libelle:"Fournitures scolaires", categorie:"Achats", montant:85000, date:"3 sept." },
    { libelle:"Réparation portail", categorie:"Réparations", montant:35000, date:"5 sept." },
    { libelle:"Salaire M. Sossou", categorie:"Salaires", montant:75000, date:"1 sept." },
    { libelle:"Salaire Mme Da Silva", categorie:"Salaires", montant:75000, date:"1 sept." },
  ];
  const total = depenses.reduce((a,d)=>a+d.montant,0);
  return `
    <div class="card-bold" style="padding:18px 20px;margin-bottom:24px;max-width:320px;">
      <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Dépenses ce mois</p>
      <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--danger);">${fmt(total)} F</p>
    </div>

    <p class="page-title" style="margin:0 0 12px;font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);">Dépenses récentes</p>
    <div class="card-bold" style="overflow:hidden;margin-bottom:24px;">
    ${depenses.map((d,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;${i<depenses.length-1?'border-bottom:1px solid var(--line);':''}">
        <div><p style="margin:0 0 3px;font-size:13.5px;font-weight:600;">${d.libelle}</p><p style="margin:0;font-size:11.5px;color:var(--muted);">${d.categorie} · ${d.date}</p></div>
        <p style="margin:0;font-size:14px;font-weight:600;">${fmt(d.montant)} F</p>
      </div>
    `).join('')}
    </div>

    <div class="card-bold" style="padding:16px 20px;margin-bottom:20px;background:var(--gold-light);border-color:var(--gold);">
      <p style="margin:0;font-size:12.5px;color:var(--clay-dark);line-height:1.6;">Vue volontairement simple pour l'instant : suivi des dépenses courantes, pas de comptabilité légale complète (bilan, liasse fiscale).</p>
    </div>
    <button style="background:var(--paper);color:var(--ink);border:1px solid var(--line-strong);font-weight:600;font-size:14px;padding:13px 22px;border-radius:var(--radius);" onclick="sendPrompt('Ajoute une nouvelle dépense')">
      <i class="ti ti-plus" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Ajouter une dépense
    </button>
  `;
}

function renderAvances(){
  // Statuts possibles : attente_fondateur | attente_directeur | approuvee | refusee
  const avances = [
    { id:1, nom:"M. Sossou", role:"Enseignant", montant:25000, date:"10 sept.", solde:25000, mensualite:8333, statut:"approuvee" },
    { id:2, nom:"Mme Adjovi", role:"Secrétaire", montant:15000, date:"2 sept.", solde:5000, mensualite:5000, statut:"approuvee" },
    { id:3, nom:"Mme Gbaguidi", role:"Enseignant", montant:20000, date:"14 sept.", solde:20000, mensualite:6667, statut:"attente_fondateur" },
    { id:4, nom:"M. Aïhounton", role:"Enseignant", montant:10000, date:"15 sept.", solde:10000, mensualite:5000, statut:"attente_directeur" },
    { id:5, nom:"M. Kpodjro", role:"Directeur", montant:30000, date:"16 sept.", solde:30000, mensualite:10000, statut:"attente_fondateur" },
  ];
  const totalAvances = avances.filter(a=>a.statut==='approuvee').reduce((a,d)=>a+d.solde,0);
  const enAttente = avances.filter(a=>a.statut==='attente_fondateur'||a.statut==='attente_directeur');

  function statutBadgeAvance(s){
    if(s==='approuvee') return '<span style="background:var(--success-light);color:var(--success);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Approuvée</span>';
    if(s==='refusee') return '<span style="background:var(--danger-light);color:var(--danger);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Refusée</span>';
    if(s==='attente_directeur') return '<span style="background:var(--gold-light);color:var(--clay-dark);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Avis favorable — attente directeur</span>';
    return '<span style="background:var(--amber-light);color:var(--amber);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Attente avis fondateur</span>';
  }

  function actionsAvance(a){
    if(currentRole==='fondateur'){
      if(a.statut==='attente_fondateur'){
        if(a.role==='Directeur'){
          return `<button onclick="decideAvance(${a.id},'approuvee')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:none;background:var(--forest);color:#fff;margin-right:6px;">Approuver</button><button onclick="decideAvance(${a.id},'refusee')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);">Refuser</button>`;
        }
        return `<button onclick="decideAvance(${a.id},'attente_directeur')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:none;background:var(--forest);color:#fff;margin-right:6px;">Avis favorable</button><button onclick="decideAvance(${a.id},'refusee')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);">Refuser</button>`;
      }
    }
    if(currentRole==='directeur' && a.statut==='attente_directeur'){
      return `<button onclick="decideAvance(${a.id},'approuvee')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:none;background:var(--forest);color:#fff;margin-right:6px;">Approuver</button><button onclick="decideAvance(${a.id},'refusee')" style="font-size:11.5px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);">Refuser</button>`;
    }
    return '';
  }

  return `
    <div class="card-bold" style="padding:18px 20px;margin-bottom:24px;max-width:320px;">
      <p style="margin:0 0 4px;font-size:12.5px;color:var(--muted);font-weight:600;">Avances approuvées</p>
      <p style="margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--amber);">${fmt(totalAvances)} F</p>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <p class="page-title" style="margin:0;font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);">Avances sur salaire</p>
      <button style="font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:10px;border:none;background:var(--forest);color:#fff;" onclick="sendPrompt('Faire une demande d\\'avance sur salaire, en tant que ${ROLES[currentRole].label}')"><i class="ti ti-plus" style="font-size:13px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Nouvelle demande</button>
    </div>
    <p style="margin:0 0 14px;font-size:11.5px;color:var(--muted);line-height:1.6;">Directeur, secrétaire et professeurs peuvent demander. Le fondateur approuve toujours en dernier ressort ; pour la secrétaire et les professeurs, son avis favorable précède la validation du directeur.</p>

    ${enAttente.length ? `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:var(--amber);">${enAttente.length} demande${enAttente.length>1?'s':''} en attente</p>` : ''}
    <div class="card-bold" style="overflow:hidden;margin-bottom:20px;">
    ${avances.map((a,i)=>`
      <div style="padding:13px 20px;${i<avances.length-1?'border-bottom:1px solid var(--line);':''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div><span style="font-size:13.5px;font-weight:600;">${a.nom}</span><span style="font-size:11.5px;color:var(--muted);"> · ${a.role}</span></div>
          <span style="font-size:13px;font-weight:600;">${fmt(a.montant)} F</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">${statutBadgeAvance(a.statut)}<span style="font-size:11px;color:var(--muted);">${a.date}</span></div>
          <div>${actionsAvance(a)}</div>
        </div>
      </div>
    `).join('')}
    </div>
    <p style="margin:0 0 20px;font-size:11.5px;color:var(--muted);line-height:1.6;">Une fois approuvée, une avance se rembourse automatiquement sur les salaires suivants jusqu'à solde nul.</p>
  `;
}
