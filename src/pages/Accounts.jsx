import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';
import PasswordInput from '../components/PasswordInput.jsx';

const CREATABLE_STAFF_ROLES = ['directeur', 'secretaire', 'enseignant'];
const PARENT_MANAGER_ROLES = ['fondateur', 'directeur', 'secretaire'];

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

const TABS = [
  { id: 'staff', label: 'Comptes utilisateurs' },
  { id: 'parents', label: 'Comptes parents' },
];

export default function Accounts() {
  const [tab, setTab] = useState('staff');
  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Comptes</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'staff' ? <StaffAccounts /> : <ParentAccounts />}
    </div>
  );
}

function StaffAccounts() {
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
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
          Seul le fondateur peut créer ou supprimer des comptes utilisateurs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Directeur, secrétaire, enseignant — chacun avec son propre e-mail et mot de passe.</p>
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
        <NewStaffAccountModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function NewStaffAccountModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(CREATABLE_STAFF_ROLES[0]);
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
    <ModalShell title="Nouveau compte utilisateur" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Nom complet</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Rôle</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          {CREATABLE_STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>

        <label style={labelStyle}>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Mot de passe</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={{ ...inputStyle, marginBottom: 18 }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <ModalActions onCancel={onClose} submitting={submitting} submitLabel="Créer" submittingLabel="Création…" />
      </form>
    </ModalShell>
  );
}

function ParentAccounts() {
  const { profile } = useAuth();
  const canManage = PARENT_MANAGER_ROLES.includes(profile.role);

  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*, student_guardians ( students ( id, full_name ) )')
      .eq('role', 'parent')
      .order('full_name');
    if (fetchError) setError(fetchError.message);
    else setAccounts(data);
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(account) {
    if (!window.confirm(`Supprimer le compte de ${account.full_name} ? Cette action est définitive.`)) return;
    const { data, error: fnError } = await supabase.functions.invoke('manage-parent-account', {
      body: { action: 'delete', profileId: account.id },
    });
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    reload();
  }

  if (!canManage) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire peuvent créer ou supprimer des comptes parents.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Rattachés à un ou plusieurs élèves — ils ne voient que leurs propres enfants.</p>
        <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', flexShrink: 0 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouveau compte parent
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!accounts && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {accounts && (
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {accounts.map((a, i) => {
            const children = (a.student_guardians || []).map((sg) => sg.students?.full_name).filter(Boolean);
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < accounts.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 12, fontWeight: 600, color: 'var(--clay-dark)', flexShrink: 0 }}>
                    {initials(a.full_name)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{a.full_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{a.email} · {children.length ? children.join(', ') : 'aucun enfant relié'}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Supprimer">
                  <i className="ti ti-trash" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </button>
              </div>
            );
          })}
          {accounts.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun compte parent pour l'instant.</p>}
        </div>
      )}

      {modalOpen && (
        <NewParentAccountModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function NewParentAccountModal({ onClose, onCreated }) {
  const [students, setStudents] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('students').select('id, full_name, niveau').order('full_name').then(({ data }) => setStudents(data || []));
  }, []);

  function toggleStudent(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Nom, e-mail et mot de passe sont obligatoires.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Sélectionne au moins un élève.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('manage-parent-account', {
      body: {
        action: 'create',
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        student_ids: selectedIds,
      },
    });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    onCreated();
  }

  return (
    <ModalShell title="Nouveau compte parent" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Nom complet</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Téléphone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 XX XX XX XX" style={inputStyle} />

        <label style={labelStyle}>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Mot de passe</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={inputStyle} />

        <label style={labelStyle}>Élève(s) rattaché(s)</label>
        <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '6px 10px', marginBottom: 18 }}>
          {students === null && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Chargement…</p>}
          {students?.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Aucun élève inscrit pour l'instant.</p>}
          {students?.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
              {s.full_name} <span style={{ color: 'var(--muted)' }}>· {s.niveau}</span>
            </label>
          ))}
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <ModalActions onCancel={onClose} submitting={submitting} submitLabel="Créer" submittingLabel="Création…" />
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitting, submitLabel, submittingLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button type="button" onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
      <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
