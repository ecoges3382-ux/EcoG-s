import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

// Même logique que dans Accounts.jsx : supabase-js ne remplit pas `data`
// quand la fonction répond en erreur, il faut relire fnError.context.
async function describeFunctionError(fnError) {
  if (!fnError) return null;
  try {
    const body = await fnError.context.json();
    if (body?.error) return body.error;
  } catch {
    // corps non lisible en JSON : on retombe sur le message générique
  }
  return fnError.message;
}

const STATUT_LABELS = {
  essai: { label: 'Essai', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
  actif: { label: 'Actif', bg: 'var(--success-light)', fg: 'var(--success)' },
  suspendu: { label: 'Suspendu', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  resilie: { label: 'Résilié', bg: 'var(--danger-light)', fg: 'var(--danger)' },
};

export default function PlatformAdmin() {
  const { signOut } = useAuth();
  const [schools, setSchools] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  async function reload() {
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('platform-admin', { body: { action: 'list' } });
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    setSchools(data.schools);
  }

  useEffect(() => { reload(); }, []);

  async function callAction(body) {
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('platform-admin', { body });
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return false;
    }
    return true;
  }

  // 'essai' et 'actif' donnent aujourd'hui exactement les mêmes droits
  // (aucune facturation ni expiration d'essai n'existe encore) — seul le
  // passage vers/depuis 'suspendu' coupe réellement l'accès (voir
  // current_school_id() dans supabase/schema.sql).
  async function handleSetStatut(school, statut) {
    setBusyId(school.id);
    const ok = await callAction({ action: 'set_statut', schoolId: school.id, statut });
    setBusyId(null);
    setConfirmingDeleteId(null);
    if (ok) reload();
  }

  async function handleDelete(school) {
    setBusyId(school.id);
    const ok = await callAction({ action: 'delete', schoolId: school.id });
    setBusyId(null);
    setConfirmingDeleteId(null);
    if (ok) reload();
  }

  function startEditNote(school) {
    setEditingNoteId(school.id);
    setNoteDraft(school.note_administrative || '');
  }

  async function saveNote(school) {
    setBusyId(school.id);
    const ok = await callAction({ action: 'set_note', schoolId: school.id, note: noteDraft });
    setBusyId(null);
    if (ok) { setEditingNoteId(null); reload(); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-dark)', padding: '28px 20px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#fff' }}>Administration EcoGès</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Toutes les écoles de la plateforme, tous comptes confondus.</p>
          </div>
          <button
            onClick={() => signOut()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', padding: '9px 14px', flexShrink: 0 }}
          >
            Se déconnecter
          </button>
        </div>

        <div className="card-bold" style={{ padding: '14px 18px', marginBottom: 20, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
            La facturation réelle n'existe pas encore ici — le statut et la note ci-dessous sont une déclaration manuelle.
            Suspendre une école coupe réellement son accès (vérifié côté serveur, pas juste dans cet écran) ; la suppression
            définitive n'est possible qu'une fois l'école déjà suspendue.
          </p>
        </div>

        {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}
        {!schools && !error && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>}
        {schools?.length === 0 && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Aucune école pour l'instant.</p>}

        {schools?.length > 0 && (
          <div className="card-bold" style={{ overflowX: 'hidden', background: 'var(--paper)' }}>
            {schools.map((s, i) => {
              const st = STATUT_LABELS[s.statut] || STATUT_LABELS.actif;
              const canDelete = s.statut === 'suspendu' || s.statut === 'resilie';
              return (
                <div
                  key={s.id}
                  style={{ padding: '14px 18px', borderBottom: i === schools.length - 1 ? 'none' : '1px solid var(--line)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</p>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {s.staffCount} compte{s.staffCount !== 1 ? 's' : ''} · {s.studentCount} élève{s.studentCount !== 1 ? 's' : ''} · créée le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {confirmingDeleteId === s.id ? (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          disabled={busyId === s.id}
                          style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: busyId === s.id ? 0.7 : 1 }}
                        >
                          {busyId === s.id ? 'Suppression…' : 'Confirmer la suppression définitive'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        {s.statut !== 'suspendu' ? (
                          <button
                            type="button"
                            onClick={() => handleSetStatut(s, 'suspendu')}
                            disabled={busyId === s.id}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--amber)', background: 'none', color: 'var(--amber)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: busyId === s.id ? 0.7 : 1 }}
                          >
                            Suspendre
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetStatut(s, 'actif')}
                            disabled={busyId === s.id}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--success)', background: 'none', color: 'var(--success)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: busyId === s.id ? 0.7 : 1 }}
                          >
                            Réactiver
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => (canDelete ? setConfirmingDeleteId(s.id) : null)}
                          disabled={!canDelete || busyId === s.id}
                          title={canDelete ? undefined : "Suspends d'abord cette école pour pouvoir la supprimer définitivement."}
                          style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${canDelete ? 'var(--danger)' : 'var(--line-strong)'}`, background: 'none', color: canDelete ? 'var(--danger)' : 'var(--muted)', fontWeight: 600, fontSize: 12.5, cursor: canDelete ? 'pointer' : 'not-allowed' }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {editingNoteId === s.id ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Note administrative (plan convenu, contact, motif de suspension…)"
                          style={{ flex: '1 1 260px', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 12.5, color: 'var(--ink)' }}
                        />
                        <button
                          type="button"
                          onClick={() => saveNote(s)}
                          disabled={busyId === s.id}
                          style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditNote(s)}
                        style={{ padding: 0, border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontStyle: s.note_administrative ? 'normal' : 'italic' }}
                      >
                        {s.note_administrative || 'Ajouter une note administrative…'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
