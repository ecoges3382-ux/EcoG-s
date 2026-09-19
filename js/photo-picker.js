function renderPhotoPicker(kind, existingUrl){
  const hasPhoto = !!existingUrl;
  return `
    <div id="${kind}-photo-widget" style="position:relative;">
      <div id="${kind}-photo-trigger-row" style="display:${hasPhoto?'none':'flex'};align-items:center;">
        <button type="button" onclick="togglePhotoMenu('${kind}')" style="padding:9px 16px;border-radius:9px;font-size:13px;font-weight:600;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);">
          <i class="ti ti-camera-plus" style="font-size:15px;vertical-align:-3px;margin-right:6px;" aria-hidden="true"></i>Ajouter une photo
        </button>
      </div>
      <div id="${kind}-photo-menu" style="display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:10;background:var(--paper);border:1px solid var(--line-strong);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:210px;overflow:hidden;">
        <label style="display:block;padding:11px 14px;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;border-bottom:1px solid var(--line);">
          <i class="ti ti-photo" style="font-size:15px;vertical-align:-3px;margin-right:8px;" aria-hidden="true"></i>Galerie / Fichier
          <input type="file" accept="image/*" onchange="handlePhotoFileChange('${kind}', this)" style="display:none;">
        </label>
        <div onclick="showPhotoUrlPrompt('${kind}')" style="padding:11px 14px;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;">
          <i class="ti ti-link" style="font-size:15px;vertical-align:-3px;margin-right:8px;" aria-hidden="true"></i>Lien URL
        </div>
      </div>
      <div id="${kind}-photo-url-row" style="display:none;gap:8px;margin-top:6px;">
        <input id="${kind}-photo-url-input" type="text" placeholder="https://..." style="flex:1;padding:9px 12px;border-radius:9px;border:1px solid var(--line-strong);font-size:13.5px;box-sizing:border-box;color:var(--ink);">
        <button type="button" onclick="confirmPhotoUrl('${kind}')" style="padding:9px 14px;border-radius:9px;border:none;background:var(--forest);color:#fff;font-size:13px;font-weight:600;">OK</button>
      </div>
      <div id="${kind}-photo-preview" style="display:${hasPhoto?'flex':'none'};align-items:center;gap:10px;">
        <img id="${kind}-photo-preview-img" src="${existingUrl||''}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid var(--line-strong);">
        <button type="button" onclick="clearPhoto('${kind}')" style="font-size:12px;font-weight:600;color:var(--danger);background:none;border:none;cursor:pointer;">Retirer la photo</button>
      </div>
    </div>
  `;
}

function togglePhotoMenu(kind){
  const menu = document.getElementById(`${kind}-photo-menu`);
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
window.togglePhotoMenu = togglePhotoMenu;

function showPhotoUrlPrompt(kind){
  document.getElementById(`${kind}-photo-menu`).style.display = 'none';
  document.getElementById(`${kind}-photo-url-row`).style.display = 'flex';
  document.getElementById(`${kind}-photo-url-input`).focus();
}
window.showPhotoUrlPrompt = showPhotoUrlPrompt;

function confirmPhotoUrl(kind){
  const url = document.getElementById(`${kind}-photo-url-input`).value.trim();
  if(url) showPhotoPreview(kind, url);
  document.getElementById(`${kind}-photo-url-row`).style.display = 'none';
}
window.confirmPhotoUrl = confirmPhotoUrl;

function showPhotoPreview(kind, src){
  photoData[kind] = src;
  document.getElementById(`${kind}-photo-trigger-row`).style.display = 'none';
  const preview = document.getElementById(`${kind}-photo-preview`);
  const img = document.getElementById(`${kind}-photo-preview-img`);
  img.src = src;
  preview.style.display = 'flex';
}

function handlePhotoFileChange(kind, input){
  const file = input.files[0];
  document.getElementById(`${kind}-photo-menu`).style.display = 'none';
  if(!file) return;
  if(!file.type.startsWith('image/')){
    alert("Merci de choisir un fichier image.");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = e => showPhotoPreview(kind, e.target.result);
  reader.readAsDataURL(file);
}
window.handlePhotoFileChange = handlePhotoFileChange;

function clearPhoto(kind){
  photoData[kind] = "";
  const preview = document.getElementById(`${kind}-photo-preview`);
  const triggerRow = document.getElementById(`${kind}-photo-trigger-row`);
  if(preview) preview.style.display = 'none';
  if(triggerRow) triggerRow.style.display = 'flex';
  const urlRow = document.getElementById(`${kind}-photo-url-row`);
  if(urlRow) urlRow.style.display = 'none';
}
window.clearPhoto = clearPhoto;
