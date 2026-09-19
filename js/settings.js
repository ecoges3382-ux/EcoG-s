function renderSettings(){
  return `
    <p class="page-title" style="margin:0 0 20px;font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);">Paramètres</p>
    <div class="card-bold" style="padding:16px 20px;margin-bottom:22px;background:var(--gold-light);border-color:var(--gold);">
      <p style="margin:0;font-size:12.5px;color:var(--clay-dark);line-height:1.6;">Ces réglages personnalisent l'application avec l'identité de votre école : nom, couleur et logo.</p>
    </div>

    <div class="card-bold" style="padding:22px;max-width:520px;">
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:var(--ink);">Identité de l'établissement</p>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Nom de l'école</label>
        <input id="settings-nom" type="text" value="${schoolSettings.nom}" style="width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Couleur principale de l'application</label>
        <div style="display:flex;align-items:center;gap:10px;">
          <input id="settings-couleur" type="color" value="${schoolSettings.couleur}" style="width:48px;height:40px;border-radius:9px;border:1px solid var(--line-strong);padding:2px;cursor:pointer;">
          <input id="settings-couleur-hex" type="text" value="${schoolSettings.couleur}" oninput="syncColorHex(this.value)" style="flex:1;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:14px;box-sizing:border-box;color:var(--ink);">
        </div>
        <p style="margin:6px 0 0;font-size:11.5px;color:var(--muted);">Remplace le vert par défaut dans toute l'application (barre du haut, boutons, cartes).</p>
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;">Logo (facultatif)</label>
        ${renderPhotoPicker('settings-logo', schoolSettings.logo)}
        <p style="margin:6px 0 0;font-size:11.5px;color:var(--muted);">Sans logo, les initiales de l'école restent affichées.</p>
      </div>

      <button onclick="applySchoolSettings()" style="width:100%;background:var(--forest);color:#fff;border:none;font-weight:600;font-size:14px;padding:13px;border-radius:var(--radius);">
        <i class="ti ti-check" style="font-size:16px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Enregistrer et appliquer
      </button>
    </div>
  `;
}

function syncColorHex(value){
  const colorInput = document.getElementById('settings-couleur');
  if(/^#[0-9A-Fa-f]{6}$/.test(value)) colorInput.value = value;
}
window.syncColorHex = syncColorHex;

function hexToRgb(hex){
  const h = hex.replace('#','');
  return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
}
function rgbToHex(r,g,b){
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#' + c(r) + c(g) + c(b);
}
function shadeColor(hex, percent){
  // percent négatif = assombrit, positif = éclaircit
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  return rgbToHex(r + (t-r)*p, g + (t-g)*p, b + (t-b)*p);
}

function applySchoolSettings(){
  const nom = document.getElementById('settings-nom').value.trim();
  const couleur = document.getElementById('settings-couleur').value;
  const logo = photoData['settings-logo'] || schoolSettings.logo;

  if(!nom){
    alert("Le nom de l'école ne peut pas être vide.");
    return;
  }

  schoolSettings.nom = nom;
  schoolSettings.couleur = couleur;
  schoolSettings.logo = logo;

  // Applique la couleur principale et ses variantes dérivées à toute l'app
  const couleurSombre = shadeColor(couleur, -0.30);
  const couleurClaire = shadeColor(couleur, 0.90);
  document.documentElement.style.setProperty('--forest', couleur);
  document.documentElement.style.setProperty('--forest-dark', couleurSombre);
  document.documentElement.style.setProperty('--forest-light', couleurClaire);
  document.getElementById('topbar-main').style.background = couleur;

  // Applique le nom
  const nameEl = document.getElementById('topbar-school-name');
  if(nameEl) nameEl.textContent = nom;

  // Applique le logo
  const logoEl = document.getElementById('topbar-logo');
  if(logoEl){
    if(logo){
      logoEl.innerHTML = `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      const initialesEcole = nom.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0]).join('').toUpperCase() || "MD";
      logoEl.textContent = initialesEcole;
    }
  }

  sendPrompt(`Paramètres de l'école enregistrés : ${nom}`);
}
window.applySchoolSettings = applySchoolSettings;
