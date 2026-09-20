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

export default function PlatformAdmin() {
  const { signOut } = useAuth();
  const [schools, setSchools] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

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

  async function handleDelete(school) {
    setDeletingId(school.id);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('platform-admin', {
      body: { action: 'delete', schoolId: school.id },
    });
    setDeletingId(null);
    setConfirmingId(null);
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    reload();
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
            La gestion des abonnements n'existe pas encore ici — pour l'instant, cet espace ne fait que lister les écoles et permettre d'en supprimer une. On l'ajoutera quand le système de facturation sera prêt.
          </p>
        </div>

        {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}
        {!schools && !error && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>}
        {schools?.length === 0 && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Aucune école pour l'instant.</p>}

        {schools?.length > 0 && (
          <div className="card-bold" style={{ overflowX: 'hidden', background: 'var(--paper)' }}>
            {schools.map((s, i) => (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: i === schools.length - 1 ? 'none' : '1px solid var(--line)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {s.staffCount} compte{s.staffCount !== 1 ? 's' : ''} · {s.studentCount} élève{s.studentCount !== 1 ? 's' : ''} · créée le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {confirmingId === s.id ? (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: deletingId === s.id ? 0.7 : 1 }}
                    >
                      {deletingId === s.id ? 'Suppression…' : 'Confirmer la suppression'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(s.id)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
