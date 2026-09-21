import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const CAN_MANAGE_ROLES = ['fondateur', 'directeur', 'secretaire', 'enseignant'];

export default function Documents() {
  const { profile } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [titre, setTitre] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);

  async function reload() {
    const { data, error: fetchError } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setDocuments(data);
  }

  useEffect(() => { reload(); }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!titre.trim()) {
      setError('Donne un titre au document avant de choisir le fichier.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    setError('');
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = `${profile.school_id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    e.target.value = '';
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }
    // Bucket privé (voir supabase/schema.sql) : on garde le chemin de
    // stockage, pas d'URL publique — l'ouverture du document génère une
    // URL signée à la demande (voir openDocument), valable quelques minutes.
    const { error: insertError } = await supabase.from('documents').insert({
      school_id: profile.school_id, titre: titre.trim(), storage_path: path, uploaded_by: profile.full_name,
    });
    setUploading(false);
    if (insertError) { setError(insertError.message); return; }
    setTitre('');
    reload();
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Supprimer « ${doc.titre} » ?`)) return;
    const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  // URL signée générée à la demande (bucket privé) : repose sur la session
  // de l'utilisateur déjà connecté, donc soumise à la policy de lecture par
  // école du bucket "documents" (voir supabase/schema.sql) — un membre
  // d'une autre école ne peut pas en obtenir une, même en connaissant le
  // chemin de stockage. Repli sur l'ancien file_url pour d'éventuelles
  // fiches créées avant cette migration si jamais storage_path est absent.
  async function openDocument(doc) {
    if (!doc.storage_path) {
      if (doc.file_url) window.open(doc.file_url, '_blank', 'noopener');
      return;
    }
    // L'onglet doit s'ouvrir tout de suite, dans le même geste que le
    // clic — sinon Safari (et certains autres navigateurs) bloque
    // silencieusement une fenêtre ouverte après un await, sans aucun
    // message d'erreur visible. On l'ouvre vide puis on le redirige une
    // fois l'URL signée obtenue.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    setOpeningId(doc.id);
    const { data, error: signError } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    setOpeningId(null);
    if (signError || !data?.signedUrl) {
      if (tab) tab.close();
      setError("Impossible d'ouvrir ce document.");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Documents</p>

      {canManage && (
        <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 22, maxWidth: 520 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Partager un document</p>
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre (ex : Circulaire rentrée)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 }}
          />
          <label style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true"></i>
            {uploading ? 'Envoi…' : 'Choisir un fichier'}
            <input type="file" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!documents && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {documents && (
        <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
          {documents.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < documents.length - 1 ? '1px solid var(--line)' : 'none', gap: 10 }}>
              <button
                type="button"
                onClick={() => openDocument(d)}
                disabled={openingId === d.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: openingId === d.id ? 'default' : 'pointer', opacity: openingId === d.id ? 0.7 : 1 }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-file-text" style={{ fontSize: 16, color: 'var(--forest)' }} aria-hidden="true"></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titre}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{d.uploaded_by || '—'} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </button>
              {canManage && (
                <button onClick={() => handleDelete(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }} title="Supprimer">
                  <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                </button>
              )}
            </div>
          ))}
          {documents.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun document partagé pour l'instant.</p>}
        </div>
      )}
    </div>
  );
}
