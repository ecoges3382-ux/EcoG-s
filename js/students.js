// ---- Élèves ----
function renderStudents(){
  const classesPresentes = [...new Set(students.map(s=>s.niveau))];
  const classesOrdonnees = NIVEAUX.filter(n => classesPresentes.includes(n));
  const filtered = activeClassFilter==='toutes' ? students : students.filter(s=>s.niveau===activeClassFilter);

  // Chips rapides : Toutes + les 3 classes avec le plus d'élèves
  const rapides = ['toutes', ...classesOrdonnees.slice().sort((a,b)=>{
    const ca = students.filter(s=>s.niveau===a).length;
    const cb = students.filter(s=>s.niveau===b).length;
    return cb-ca;
  }).slice(0,2)];

  const quickChips = rapides.map(c=>{
    const count = c==='toutes' ? students.length : students.filter(s=>s.niveau===c).length;
    const label = c==='toutes' ? 'Toutes' : c;
    const active = activeClassFilter===c;
    return `<button onclick="setClassFilter('${c}')" style="flex-shrink:0;padding:8px 15px;border-radius:20px;font-size:12.5px;font-weight:600;border:1px solid ${active?'var(--forest)':'var(--line-strong)'};background:${active?'var(--forest)':'var(--paper)'};color:${active?'#fff':'var(--ink)'};white-space:nowrap;">${label} <span style="opacity:0.7;">${count}</span></button>`;
  }).join('');

  const dropdownOptions = classesOrdonnees.map(c=>{
    const count = students.filter(s=>s.niveau===c).length;
    return `<option value="${c}" ${activeClassFilter===c?'selected':''}>${c} (${count})</option>`;
  }).join('');
  const isDropdownActive = activeClassFilter!=='toutes' && !rapides.includes(activeClassFilter);
  const niveauOptions = NIVEAUX.map(n=>`<option value="${n}">${n}</option>`).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <p class="page-title" style="margin:0;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Élèves</p>
      <div style="display:flex;gap:9px;flex-wrap:wrap;">
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);" onclick="exportStudentsCsv()"><i class="ti ti-download" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Exporter</button>
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);" onclick="document.getElementById('csv-file-input').click()"><i class="ti ti-upload" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Importer</button>
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:none;background:var(--forest);color:#fff;" onclick="openStudentModal()"><i class="ti ti-plus" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Ajouter</button>
      </div>
    </div>
    <input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="handleCsvImport(this)">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px;">
      ${quickChips}
      <select onchange="setClassFilter(this.value)" style="flex-shrink:0;padding:8px 13px;border-radius:20px;font-size:12.5px;font-weight:600;border:1px solid ${isDropdownActive?'var(--forest)':'var(--line-strong)'};background:${isDropdownActive?'var(--forest)':'var(--paper)'};color:${isDropdownActive?'#fff':'var(--ink)'};cursor:pointer;">
        <option value="" disabled ${!isDropdownActive?'selected':''}>Autre classe…</option>
        ${dropdownOptions}
      </select>
    </div>
    <p style="margin:0 0 12px;font-size:12.5px;color:var(--muted);font-weight:600;">${filtered.length} élève${filtered.length>1?'s':''} ${activeClassFilter==='toutes'?'· toutes classes':'· '+activeClassFilter}</p>
    <div class="card-bold" style="overflow:hidden;">
    ${filtered.map((s,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 20px;${i<filtered.length-1?'border-bottom:1px solid var(--line);':''}cursor:pointer;" onclick='nav("student-detail", ${JSON.stringify(s)})'>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--forest-light);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:12.5px;font-weight:600;color:var(--forest);flex-shrink:0;">${initials(s.nom)}</div>
          <div><p style="margin:0;font-size:14px;font-weight:600;">${s.nom}</p><p style="margin:0;font-size:11.5px;color:var(--muted);">${s.niveau}</p></div>
        </div>
        ${statusBadge(s.statut)}
      </div>
    `).join('')}
    </div>

    <!-- Modal d'inscription -->
    <div id="student-modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:50;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this) closeStudentModal()">
      <div style="background:var(--paper);border-radius:16px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;padding:26px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <p style="margin:0;font-family:var(--serif);font-size:19px;font-weight:600;color:var(--ink);">Inscription d'un élève</p>
          <button onclick="closeStudentModal()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;">×</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Prénom</label>
            <input id="student-prenom" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Nom</label>
            <input id="student-nom" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Sexe</label>
            <select id="student-sexe" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
              <option>Fille</option><option>Garçon</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Date de naissance</label>
            <input id="student-naissance" type="date" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Lieu de naissance</label>
            <input id="student-lieu" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Classe</label>
            <select id="student-classe" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
              ${niveauOptions}
            </select>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Photo (facultatif)</label>
          ${renderPhotoPicker('student', '')}
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Adresse</label>
          <input id="student-adresse" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Nom du parent</label>
            <input id="student-parent-nom" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Téléphone parent</label>
            <input id="student-parent-tel" type="text" placeholder="01 XX XX XX XX" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
        </div>

        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Historique scolaire</label>
          <textarea id="student-historique" rows="2" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);font-family:var(--sans);resize:vertical;"></textarea>
        </div>

        <p style="margin:0 0 16px;font-size:11.5px;color:var(--muted);">Un matricule sera généré automatiquement (ex. MED-0101).</p>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button onclick="closeStudentModal()" style="padding:10px 18px;border-radius:9px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-weight:600;font-size:13.5px;">Annuler</button>
          <button onclick="submitStudent()" style="padding:10px 18px;border-radius:9px;border:none;background:var(--forest);color:#fff;font-weight:600;font-size:13.5px;"><i class="ti ti-user-plus" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Inscrire</button>
        </div>
      </div>
    </div>
  `;
}

function makeNewStudent({nom, niveau}){
  const canaux = ["WhatsApp","SMS","Appel"];
  const id = students.length ? Math.max(...students.map(s=>s.id))+1 : 1;
  const montantDu = 90000;
  return {
    id, matricule: "MED-" + String(studentMatriculeCounter++).padStart(4,"0"),
    nom, niveau, montantDu, paye: 0, reste: montantDu, statut: "retard_critique", priorite: "haute",
    fraisConnexeDu: 20000, fraisConnexePaye: 0, fraisConnexeReste: 20000,
    retardJours: 0, canalEfficace: canaux[0], parentTel: ""
  };
}

function openStudentModal(){
  clearPhoto('student');
  document.getElementById('student-modal-backdrop').style.display = 'flex';
}
window.openStudentModal = openStudentModal;

function closeStudentModal(){
  document.getElementById('student-modal-backdrop').style.display = 'none';
}
window.closeStudentModal = closeStudentModal;

function submitStudent(){
  const prenom = document.getElementById('student-prenom').value.trim();
  const nom = document.getElementById('student-nom').value.trim();
  const classe = document.getElementById('student-classe').value;
  const parentTel = document.getElementById('student-parent-tel').value.trim();

  if(!prenom || !nom){
    alert("Le prénom et le nom sont obligatoires.");
    return;
  }

  const eleve = makeNewStudent({ nom: prenom + " " + nom, niveau: classe });
  eleve.parentTel = parentTel;
  eleve.photo = photoData.student || "";
  students.push(eleve);

  closeStudentModal();
  const isMobile = window.innerWidth <= 780;
  document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderStudents();
  sendPrompt(`Élève inscrit : ${prenom} ${nom} (${eleve.matricule})`);
}
window.submitStudent = submitStudent;

function handleCsvImport(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
    if(lines.length < 2){
      alert("Le fichier semble vide ou ne contient pas de données à importer.");
      input.value = "";
      return;
    }
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const idxPrenom = header.findIndex(h=>h.includes('prénom')||h.includes('prenom'));
    const idxNom = header.findIndex(h=>h.includes('nom') && !h.includes('prénom') && !h.includes('prenom'));
    const idxClasse = header.findIndex(h=>h.includes('classe'));

    if(idxPrenom===-1 || idxNom===-1){
      alert("Colonnes attendues introuvables. Le fichier doit contenir au minimum les colonnes : Prénom, Nom, Classe.");
      input.value = "";
      return;
    }

    let imported = 0;
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(c=>c.trim());
      const prenom = cols[idxPrenom];
      const nom = cols[idxNom];
      const classe = idxClasse!==-1 ? (cols[idxClasse] || NIVEAUX[0]) : NIVEAUX[0];
      if(!prenom || !nom) continue;
      const classeValide = NIVEAUX.includes(classe) ? classe : NIVEAUX[0];
      students.push(makeNewStudent({ nom: prenom + " " + nom, niveau: classeValide }));
      imported++;
    }

    input.value = "";
    const isMobile = window.innerWidth <= 780;
    document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderStudents();
    sendPrompt(`Import terminé : ${imported} élève${imported>1?'s':''} ajouté${imported>1?'s':''} depuis ${file.name}`);
  };
  reader.onerror = function(){
    alert("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier CSV.");
    input.value = "";
  };
  reader.readAsText(file);
}
window.handleCsvImport = handleCsvImport;
function setClassFilter(c){
  activeClassFilter=c;
  const isMobile = window.innerWidth <= 780;
  document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderStudents();
}
window.setClassFilter = setClassFilter;

function renderStudentDetail(s){
  return `
    <button onclick="nav('students')" style="display:flex;align-items:center;gap:6px;border:none;background:none;color:var(--forest);font-weight:600;font-size:13px;padding:0 0 18px;"><i class="ti ti-arrow-left" style="font-size:15px;" aria-hidden="true"></i>Retour aux élèves</button>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;">
      <div style="width:58px;height:58px;border-radius:14px;background:var(--clay-light);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:19px;font-weight:600;color:var(--clay-dark);">${initials(s.nom)}</div>
      <div><p style="margin:0;font-family:var(--serif);font-size:21px;font-weight:600;">${s.nom}</p><p style="margin:2px 0 0;font-size:13px;color:var(--muted);">${s.niveau} · Parent : ${s.parentTel}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px;">
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;">Droit d'écolage</p>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;"><span style="color:var(--muted);">Dû</span><span style="font-weight:600;">${fmt(s.montantDu)} F</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;"><span style="color:var(--muted);">Payé</span><span style="font-weight:600;color:var(--success);">${fmt(s.paye)} F</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;padding-top:8px;border-top:1px solid var(--line);"><span style="font-weight:600;">Reste</span><span style="font-weight:700;color:var(--danger);">${fmt(s.reste)} F</span></div>
      </div>
      <div class="card-bold" style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;">Frais connexes</p>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;"><span style="color:var(--muted);">Dû</span><span style="font-weight:600;">${fmt(s.fraisConnexeDu)} F</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;"><span style="color:var(--muted);">Payé</span><span style="font-weight:600;color:var(--success);">${fmt(s.fraisConnexePaye)} F</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;padding-top:8px;border-top:1px solid var(--line);"><span style="font-weight:600;">Reste</span><span style="font-weight:700;color:${s.fraisConnexeReste>0?'var(--danger)':'var(--success)'};">${fmt(s.fraisConnexeReste)} F</span></div>
      </div>
    </div>
    ${s.statut!=='a_jour' ? `
    <div style="margin-top:20px;max-width:640px;">
      <button style="background:var(--clay);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:var(--radius);margin-right:10px;" onclick="sendPrompt('Envoie une relance WhatsApp à la famille de ${s.nom}')"><i class="ti ti-brand-whatsapp" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Relancer par WhatsApp</button>
      <button style="background:var(--paper);color:var(--ink);border:1px solid var(--line-strong);font-weight:600;font-size:14px;padding:13px 22px;border-radius:var(--radius);" onclick="sendPrompt('Envoie une relance SMS à la famille de ${s.nom}')"><i class="ti ti-message" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>SMS</button>
    </div>` : ''}
  `;
}

function exportStudentsCsv(){
  const rows = [["Matricule","Prénom et nom","Classe","Montant dû","Payé","Reste","Statut","Téléphone parent"]];
  students.forEach(s=>{
    const statutLabel = s.statut==='a_jour' ? 'À jour' : (s.statut==='retard_leger' ? 'Retard léger' : 'Retard critique');
    rows.push([s.matricule||'', s.nom, s.niveau, s.montantDu, s.paye, s.reste, statutLabel, s.parentTel||'']);
  });
  downloadCsv("eleves-medecon.csv", rows);
}
window.exportStudentsCsv = exportStudentsCsv;
