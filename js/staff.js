// ---- Personnel ----
function nextMatricule(role){
  const prefixes = { "Enseignant":"ENS", "Secrétaire":"SEC", "Directeur":"DIR", "Fondateur":"FON" };
  const prefix = prefixes[role] || "PER";
  const count = STAFF.filter(p=>p.role===role).length + 1;
  return prefix + "-" + String(count).padStart(4,"0");
}

function renderStaff(){
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <p class="page-title" style="margin:0;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Personnel</p>
      <div style="display:flex;gap:9px;flex-wrap:wrap;">
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);" onclick="exportStaffCsv()"><i class="ti ti-download" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Exporter</button>
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);" onclick="document.getElementById('staff-csv-input').click()"><i class="ti ti-upload" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Importer</button>
        <button style="font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:none;background:var(--forest);color:#fff;" onclick="openStaffModal()"><i class="ti ti-plus" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Ajouter</button>
      </div>
    </div>
    <input type="file" id="staff-csv-input" accept=".csv" style="display:none;" onchange="handleStaffCsvImport(this)">
    <p style="margin:0 0 18px;font-size:13px;color:var(--muted);">${STAFF.length} membres — visible par le fondateur, le directeur et les enseignants concernés.</p>
    <div class="card-bold" style="overflow-x:auto;">
    <div style="min-width:680px;">
    <div style="display:grid;grid-template-columns:1fr 1.4fr 1fr 1.8fr 1fr;padding:13px 20px;background:var(--forest-light);font-size:11.5px;font-weight:700;color:var(--forest-dark);text-transform:uppercase;letter-spacing:0.03em;">
      <span>Matricule</span><span>Nom</span><span>Rôle</span><span>Niveau d'études</span><span>Classe(s)</span>
    </div>
    ${STAFF.map((p,i)=>`
      <div style="display:grid;grid-template-columns:1fr 1.4fr 1fr 1.8fr 1fr;padding:14px 20px;align-items:center;${i<STAFF.length-1?'border-bottom:1px solid var(--line);':''}">
        <span style="font-size:12px;color:var(--muted);font-weight:600;">${p.matricule}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:9px;background:var(--forest-light);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:11px;font-weight:600;color:var(--forest);flex-shrink:0;overflow:hidden;">
            ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.textContent='${initials(p.nom)}';">` : initials(p.nom)}
          </div>
          <span style="font-size:13.5px;font-weight:600;">${p.nom}</span>
        </div>
        <span style="font-size:13px;color:var(--muted);">${p.role}</span>
        <span style="font-size:13px;">${p.niveau}</span>
        <span style="font-size:13px;color:var(--muted);">${p.classes.length ? p.classes.join(', ') : '—'}</span>
      </div>
    `).join('')}
    </div>
    </div>

    <!-- Modal d'ajout -->
    <div id="staff-modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:50;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this) closeStaffModal()">
      <div style="background:var(--paper);border-radius:16px;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;padding:26px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <p style="margin:0;font-family:var(--serif);font-size:19px;font-weight:600;color:var(--ink);">Nouveau membre du personnel</p>
          <button onclick="closeStaffModal()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;">×</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Prénom</label>
            <input id="staff-prenom" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Nom</label>
            <input id="staff-nom" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Sexe</label>
            <select id="staff-sexe" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
              <option>Femme</option><option>Homme</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Rôle</label>
            <select id="staff-role" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
              <option>Enseignant</option><option>Secrétaire</option><option>Directeur</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Niveau d'études</label>
          <input id="staff-niveau" type="text" placeholder="ex. Licence en Lettres Modernes" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Classe(s) attribuée(s)</label>
          <input id="staff-classes" type="text" placeholder="ex. CM1, 3e (séparées par une virgule)" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Téléphone</label>
            <input id="staff-tel" type="text" placeholder="01 XX XX XX XX" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">E-mail</label>
            <input id="staff-email" type="email" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Adresse</label>
          <input id="staff-adresse" type="text" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
        </div>

        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Photo (facultatif)</label>
          ${renderPhotoPicker('staff', '')}
        </div>
        </div>

        <p style="margin:0 0 16px;font-size:11.5px;color:var(--muted);">Un matricule sera généré automatiquement selon le rôle choisi (ex. ENS-0005).</p>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button onclick="closeStaffModal()" style="padding:10px 18px;border-radius:9px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-weight:600;font-size:13.5px;">Annuler</button>
          <button onclick="submitStaff()" style="padding:10px 18px;border-radius:9px;border:none;background:var(--forest);color:#fff;font-weight:600;font-size:13.5px;"><i class="ti ti-user-plus" style="font-size:14px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>Enregistrer</button>
        </div>
      </div>
    </div>
  `;
}

function openStaffModal(){
  clearPhoto('staff');
  document.getElementById('staff-modal-backdrop').style.display = 'flex';
}
window.openStaffModal = openStaffModal;

function closeStaffModal(){
  document.getElementById('staff-modal-backdrop').style.display = 'none';
}
window.closeStaffModal = closeStaffModal;

function submitStaff(){
  const prenom = document.getElementById('staff-prenom').value.trim();
  const nom = document.getElementById('staff-nom').value.trim();
  const role = document.getElementById('staff-role').value;
  const niveau = document.getElementById('staff-niveau').value.trim();
  const classesRaw = document.getElementById('staff-classes').value.trim();
  const tel = document.getElementById('staff-tel').value.trim();
  const email = document.getElementById('staff-email').value.trim();
  const photo = photoData.staff || "";

  if(!prenom || !nom){
    alert("Le prénom et le nom sont obligatoires.");
    return;
  }

  const matricule = nextMatricule(role);
  const classes = classesRaw ? classesRaw.split(',').map(c=>c.trim()).filter(Boolean) : [];

  STAFF.push({
    id: staffNextId++,
    matricule, nom: prenom + " " + nom, niveau: niveau || "—",
    classes, role, tel, email, photo
  });

  closeStaffModal();
  document.getElementById('screen').innerHTML = (window.innerWidth <= 780) ? renderSchoolHub() : renderStaff();
  sendPrompt(`Nouveau membre enregistré : ${prenom} ${nom} (${matricule})`);
}
window.submitStaff = submitStaff;

function exportStaffCsv(){
  const rows = [["Matricule","Prénom et nom","Rôle","Niveau d'études","Classe(s)","Téléphone","E-mail"]];
  STAFF.forEach(p=>{
    rows.push([p.matricule, p.nom, p.role, p.niveau, p.classes.join(' / '), p.tel||'', p.email||'']);
  });
  downloadCsv("personnel-medecon.csv", rows);
}
window.exportStaffCsv = exportStaffCsv;

function handleStaffCsvImport(input){
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
    const idxRole = header.findIndex(h=>h.includes('rôle')||h.includes('role'));
    const idxNiveau = header.findIndex(h=>h.includes('niveau'));
    const idxClasses = header.findIndex(h=>h.includes('classe'));
    const idxTel = header.findIndex(h=>h.includes('tél')||h.includes('tel'));
    const idxEmail = header.findIndex(h=>h.includes('mail'));

    if(idxPrenom===-1 || idxNom===-1){
      alert("Colonnes attendues introuvables. Le fichier doit contenir au minimum les colonnes : Prénom, Nom.");
      input.value = "";
      return;
    }

    const rolesValides = ["Enseignant","Secrétaire","Directeur","Fondateur"];
    let imported = 0;
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(c=>c.trim());
      const prenom = cols[idxPrenom];
      const nom = cols[idxNom];
      if(!prenom || !nom) continue;
      const roleRaw = idxRole!==-1 ? cols[idxRole] : "Enseignant";
      const role = rolesValides.includes(roleRaw) ? roleRaw : "Enseignant";
      const niveau = idxNiveau!==-1 ? (cols[idxNiveau] || "—") : "—";
      const classesRaw = idxClasses!==-1 ? (cols[idxClasses] || "") : "";
      const classes = classesRaw ? classesRaw.split('/').map(c=>c.trim()).filter(Boolean) : [];
      const tel = idxTel!==-1 ? (cols[idxTel]||"") : "";
      const email = idxEmail!==-1 ? (cols[idxEmail]||"") : "";

      STAFF.push({
        id: staffNextId++, matricule: nextMatricule(role),
        nom: prenom + " " + nom, niveau, classes, role, tel, email, photo: ""
      });
      imported++;
    }

    input.value = "";
    const isMobile = window.innerWidth <= 780;
    document.getElementById('screen').innerHTML = isMobile ? renderSchoolHub() : renderStaff();
    sendPrompt(`Import terminé : ${imported} membre${imported>1?'s':''} du personnel ajouté${imported>1?'s':''} depuis ${file.name}`);
  };
  reader.onerror = function(){
    alert("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier CSV.");
    input.value = "";
  };
  reader.readAsText(file);
}
window.handleStaffCsvImport = handleStaffCsvImport;
