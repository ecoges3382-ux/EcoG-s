import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';

const CREATABLE_ROLES = ['directeur', 'secretaire', 'enseignant'];

// supabase-js ne remplit pas `data` quand la fonction répond en erreur (code
// non-2xx) : il faut relire le corps de la réponse via fnError.context pour
// récupérer le vrai message, sinon on n'a que "non-2xx status code".
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

export default function Accounts() {
  const { profile } = useAuth();
  const isFondateur = profile.role === 'fondateur';

  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    const { data, error: fetchError } = await supabase.from('profiles').select('*').order('full_name');
    if (fetchError) setError(fetchError.message);
    else setAccounts(data);
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(account) {
    if (!window.confirm(`Supprimer le compte de ${account.full_name} ? Cette action est définitive.`)) return;
    const { data, error: fnError } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'delete', profileId: account.id },
    });
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    reload();
  }

  if (!isFondateur) {
    return (
      <div>
        <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Comptes utilisateurs</p>
        <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
            Seul le fondateur peut créer ou supprimer des comptes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Comptes utilisateurs</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Directeur, secrétaire, enseignant — chacun avec son propre e-mail et mot de passe.</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', flexShrink: 0 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouveau compte
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!accounts && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {accounts && (
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {accounts.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < accounts.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 12, fontWeight: 600, color: 'var(--forest)', flexShrink: 0 }}>
                  {initials(a.full_name)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{a.full_name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{a.email || '—'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>
                  {ROLES[a.role]?.label || a.role}
                </span>
                {a.role !== 'fondateur' && a.id !== profile.id && (
                  <button onClick={() => handleDelete(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Supprimer">
                    <i className="ti ti-trash" style={{ fontSize: 16 }} aria-hidden="true"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <NewAccountModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function NewAccountModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(CREATABLE_ROLES[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'create', full_name: fullName.trim(), email: email.trim(), password, role },
    });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    onCreated();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Nouveau compte utilisateur</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <label style={labelStyle}>Nom complet</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Rôle</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>

        <label style={labelStyle}>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Mot de passe</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={{ ...inputStyle, marginBottom: 18 }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
