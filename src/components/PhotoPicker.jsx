import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export default function PhotoPicker({ schoolId, value, onChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [displayUrl, setDisplayUrl] = useState(''); // 👈 Nouvel état pour l'image sécurisée

  // 🔒 GESTION DES IMAGES PRIVÉES
  useEffect(() => {
    if (!value) { setDisplayUrl(''); return; }

    // Si c'est une URL externe (ex: https://google.com/image.jpg)
    if (value.startsWith('http') && !value.includes('/storage/v1/object/public/photos/')) {
      setDisplayUrl(value);
      return;
    }

    // Extraire le chemin si c'est une ancienne URL publique
    let path = value;
    if (value.includes('/storage/v1/object/public/photos/')) {
      path = value.split('/storage/v1/object/public/photos/')[1];
    }

    // Générer une URL sécurisée (valable 1 heure) pour l'affichage
    supabase.storage.from('photos').createSignedUrl(path, 3600).then(({ data }) => {
      if (data) {
        setDisplayUrl(data.signedUrl);
      } else {
        setDisplayUrl(value); // En cas d'erreur, on garde l'ancienne valeur
      }
    });
  }, [value]);

  async function handleFile(e) {
    const file = e.target.files[0];
    setMenuOpen(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisis un fichier image.');
      return;
    }
    setUploading(true);
    setError('');
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const path = `${schoolId}/${crypto.randomUUID()}.${ext}`;
    
    // On envoie le fichier dans le bucket
    const { error: uploadError } = await supabase.storage.from('photos').upload(path, file);
    setUploading(false);
    e.target.value = '';
    
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    
    // 👇 ON SAUVEGARDE LE CHEMIN DU FICHIER (ex: "schoolId/uuid.jpg"), PAS L'URL
    onChange(path);
  }

  function confirmUrl() {
    if (urlInput.trim()) onChange(urlInput.trim());
    setUrlMode(false);
    setUrlInput('');
  }

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 👇 On affiche l'URL signée (ou l'ancienne en attendant) */}
        <img src={displayUrl || value} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--line-strong)' }} />
        <button type="button" onClick={() => onChange('')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Retirer la photo
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {!urlMode && (
        <button type="button" onClick={() => setMenuOpen((v) => !v)} disabled={uploading} style={triggerStyle}>
          <i className="ti ti-camera-plus" style={{ fontSize: 15, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
          {uploading ? 'Envoi…' : 'Ajouter une photo'}
        </button>
      )}

      {menuOpen && (
        <div style={menuStyle}>
          <label style={menuItemStyle}>
            <i className="ti ti-photo" style={{ fontSize: 15, marginRight: 8 }} aria-hidden="true"></i>
            Galerie / Fichier
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          <div
            role="button" tabIndex={0}
            onClick={() => { setMenuOpen(false); setUrlMode(true); }}
            style={{ ...menuItemStyle, borderBottom: 'none' }}
          >
            <i className="ti ti-link" style={{ fontSize: 15, marginRight: 8 }} aria-hidden="true"></i>
            Lien URL externe
          </div>
        </div>
      )}

      {urlMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: '13.5px', color: 'var(--ink)', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={confirmUrl} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontSize: 13, fontWeight: 600 }}>OK</button>
        </div>
      )}

      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

const triggerStyle = { padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' };
const menuStyle = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 10, background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: 200, overflow: 'hidden' };
const menuItemStyle = { display: 'block', padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', borderBottom: '1px solid var(--line)' };
