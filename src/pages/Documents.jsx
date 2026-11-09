import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonRow } from '../components/Skeleton.jsx';

function FileIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  );
}

const CAN_MANAGE_ROLES = ['fondateur', 'directeur', 'secretaire', 'enseignant'];

export default function Documents() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [titre, setTitre] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  
  // États pour la modification
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTitre, setEditTitre] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  async function reload() {
    await guardedFetch({
      cacheKey: `documents_${profile.school_id}`,
      hasData: documents !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        return fetchError ? { error: fetchError } : { data };
      },
      setData: setDocuments,
      setOffline,
      onError: (err) => setError(err.message),
      onSuccess: () => setError(''),
    });
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
    const { error: insertError } = await supabase.from('documents').insert({
      school_id: profile.school_id, titre: titre.trim(), storage_path: path, uploaded_by: profile.full_name,
    });
    setUploading(false);
    if (insertError) { setError(insertError.message); return; }
    setTitre('');
    showToast('Enregistré');
    reload();
  }

  async function handleDelete(doc) {
    if (!(await confirm(`Supprimer « ${doc.titre} » ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editTitre.trim()) return;
    setEditSaving(true);
    const { error } = await supabase.from('documents').update({ titre: editTitre.trim() }).eq('id', editingDoc.id);
    setEditSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingDoc(null);
    showToast('Modifié');
    reload();
  }

  async function openDocument(doc) {
    // 👇 GESTION SÉCURISÉE DES ANCIENS ET NOUVEAUX DOCUMENTS 👇
    if (!doc.storage_path) {
      if (doc.file_url) window.open(doc.file_url, '_blank', 'noopener');
      return;
    }
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
      {offline && <OfflineBanner />}
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
      {!documents && <div className="card-bold"><SkeletonRow count={4} avatar={false} /></div>}

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
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button 
                    onClick={() => { setEditingDoc(d); setEditTitre(d.titre); }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }} 
                    title="Modifier le titre"
                  >
                    <PencilIcon />
                  </button>
                  <button 
                    onClick={() => handleDelete(d)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, display: 'flex' }} 
                    title="Supprimer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          ))}
          {documents.length === 0 && (
            <EmptyState
              icon={<FileIcon />}
              title="Aucun document partagé"
              subtitle={canManage ? 'Utilise le formulaire ci-dessus pour partager le premier document avec ton équipe.' : "L'équipe n'a encore partagé aucun document ici."}
            />
          )}
        </div>
      )}

      {/* Fenêtre modale pour modifier le titre */}
      {editingDoc && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingDoc(null); }}
        >
          <form onSubmit={handleEditSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 400, width: '100%', padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Modifier le document</p>
              <button type="button" onClick={() => setEditingDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Titre du document</label>
            <input
              value={editTitre}
              onChange={(e) => setEditTitre(e.target.value)}
              placeholder="Titre"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 20 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setEditingDoc(null)} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
              <button type="submit" disabled={editSaving || !editTitre.trim()} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: (editSaving || !editTitre.trim()) ? 0.7 : 1 }}>
                {editSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
