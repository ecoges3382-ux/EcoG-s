import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES, generateAccessCode, displayName, sortByRole } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.js';
import PasswordInput from '../components/PasswordInput.jsx';
import PhoneInput, { COUNTRIES, decomposePhone, composePhone } from '../components/PhoneInput.jsx';

// La classe d'un élève est propre à l'année scolaire en cours
// (enrollments) — students ne garde que son identité. Utilisé par les deux
// modales ci-dessous (nouveau lien parent / modification des enfants liés).
function useStudentsForLinking(schoolYearId) {
  const [students, setStudents] = useState(null);
  useEffect(() => {
    if (!schoolYearId) return;
    supabase
      .from('enrollments')
      .select('students ( id, full_name ), classes ( nom )')
      .eq('school_year_id', schoolYearId)
      .then(({ data }) => {
        setStudents((data || [])
          .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—' }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)));
      });
  }, [schoolYearId]);
  return students;
}

const CREATABLE_STAFF_ROLES = ['directeur', 'censeur', 'secretaire', 'enseignant'];
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
  { id: 'parents', label: 'Accès parents' },
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
      {tab === 'staff' ? <StaffAccounts /> : <ParentAccessTab />}
    </div>
  );
}

function StaffAccounts() {
  const { profile } = useAuth();
  const isFondateur = profile.role === 'fondateur';

  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [menuForId, setMenuForId] = useState(null);
  const [editing, setEditing] = useState(null); // { account, field }

  async function reload() {
    const { data, error: fetchError } = await supabase.from('profiles').select('*').order('full_name');
    if (fetchError) setError(fetchError.message);
    else setAccounts(sortByRole(data));
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
        // overflowX seul (pas overflow tout court) : coupe le débordement
        // horizontal pour garder les coins arrondis propres, sans couper
        // verticalement le petit menu déroulant qui s'ouvre sous chaque ligne.
        <div className="card-bold" style={{ overflowX: 'hidden' }}>
          {accounts.map((a, i) => (
            <AccountRow
              key={a.id}
              account={a}
              avatarBg="var(--forest-light)"
              avatarColor="var(--forest)"
              subtitle={`${a.email || '—'}${a.phone ? ` · ${a.phone}` : ''}`}
              isLast={i === accounts.length - 1}
              menuOpen={menuForId === a.id}
              onToggleMenu={() => setMenuForId((prev) => (prev === a.id ? null : a.id))}
              onCloseMenu={() => setMenuForId(null)}
              onSelectField={(field) => { setMenuForId(null); setEditing({ account: a, field }); }}
              canDelete={a.role !== 'fondateur' && a.id !== profile.id}
              onDelete={() => handleDelete(a)}
              badge={<span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>{ROLES[a.role]?.label || a.role}</span>}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <NewStaffAccountModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}

      {editing && (
        <EditFieldModal
          account={editing.account}
          field={editing.field}
          functionName="manage-staff-account"
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function NewStaffAccountModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(CREATABLE_STAFF_ROLES[0]);
  const [email, setEmail] = useState('');
  const [phoneDial, setPhoneDial] = useState(COUNTRIES[0].dial);
  const [phoneLocal, setPhoneLocal] = useState('');
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
      body: { action: 'create', full_name: fullName.trim(), email: email.trim(), phone: composePhone(phoneDial, phoneLocal), password, role },
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

        <label style={labelStyle}>Téléphone (facultatif — permet aussi de se connecter par téléphone)</label>
        <PhoneInput dial={phoneDial} local={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} style={{ marginBottom: 12 }} />

        <label style={labelStyle}>Mot de passe</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={{ ...inputStyle, marginBottom: 18 }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <ModalActions onCancel={onClose} submitting={submitting} submitLabel="Créer" submittingLabel="Création…" />
      </form>
    </ModalShell>
  );
}

function ParentAccessTab() {
  const { profile } = useAuth();
  const canManage = PARENT_MANAGER_ROLES.includes(profile.role);

  const [accesses, setAccesses] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [menuForId, setMenuForId] = useState(null);
  const [editingStudents, setEditingStudents] = useState(null); // access
  const [copiedId, setCopiedId] = useState(null);

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('parent_access')
      .select('*, parent_access_students ( students ( id, full_name ) )')
      .order('full_name');
    if (fetchError) setError(fetchError.message);
    else setAccesses(data);
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(access) {
    if (!window.confirm(`Supprimer l'accès de ${access.full_name} ? Le lien qu'il a reçu cessera de fonctionner.`)) return;
    const { error: deleteError } = await supabase.from('parent_access').delete().eq('id', access.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  async function handleRegenerate(access) {
    if (!window.confirm(`Régénérer le code de ${access.full_name} ? L'ancien lien cessera immédiatement de fonctionner.`)) return;
    let done = false;
    for (let attempt = 0; attempt < 5 && !done; attempt++) {
      const { error: updateError } = await supabase.from('parent_access').update({ code: generateAccessCode() }).eq('id', access.id);
      if (!updateError) { done = true; break; }
      if (updateError.code !== '23505') { setError(updateError.message); return; }
    }
    if (!done) { setError('Impossible de régénérer le code, réessaie.'); return; }
    reload();
  }

  function copyLink(access) {
    const url = `${window.location.origin}/parent-access?code=${access.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(access.id);
      setTimeout(() => setCopiedId((id) => (id === access.id ? null : id)), 1600);
    });
  }

  if (!canManage) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire peuvent créer ou gérer des accès parents.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Un code par parent, à partager par lien ou message — pas de compte, pas de mot de passe.</p>
        <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', flexShrink: 0 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvel accès parent
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!accesses && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {accesses && (
        <div className="card-bold" style={{ overflowX: 'hidden' }}>
          {accesses.map((a, i) => (
            <ParentAccessRow
              key={a.id}
              access={a}
              isLast={i === accesses.length - 1}
              menuOpen={menuForId === a.id}
              onToggleMenu={() => setMenuForId((prev) => (prev === a.id ? null : a.id))}
              onCloseMenu={() => setMenuForId(null)}
              onCopyLink={() => copyLink(a)}
              onRegenerate={() => handleRegenerate(a)}
              onEditStudents={() => setEditingStudents(a)}
              onDelete={() => handleDelete(a)}
              copied={copiedId === a.id}
            />
          ))}
          {accesses.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun accès parent pour l'instant.</p>}
        </div>
      )}

      {modalOpen && (
        <NewParentAccessModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}

      {editingStudents && (
        <EditParentAccessStudentsModal
          access={editingStudents}
          onClose={() => setEditingStudents(null)}
          onSaved={() => { setEditingStudents(null); reload(); }}
        />
      )}
    </div>
  );
}

function NewParentAccessModal({ onClose, onCreated }) {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const students = useStudentsForLinking(schoolYear?.id);
  const [selectedIds, setSelectedIds] = useState([]);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [phoneDial, setPhoneDial] = useState(COUNTRIES[0].dial);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleStudent(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Sélectionne au moins un élève.');
      return;
    }
    setSubmitting(true);
    setError('');

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { data, error: insertError } = await supabase.from('parent_access').insert({
        school_id: profile.school_id,
        full_name: displayName(nom.trim(), prenom.trim()),
        nom: nom.trim(),
        prenom: prenom.trim(),
        phone: composePhone(phoneDial, phoneLocal) || null,
        code: generateAccessCode(),
      }).select().single();
      if (!insertError) { created = data; break; }
      if (insertError.code !== '23505') { setSubmitting(false); setError(insertError.message); return; }
      // sinon collision de code (extrêmement rare) : on retente avec un nouveau
    }
    if (!created) { setSubmitting(false); setError('Impossible de générer un code unique, réessaie.'); return; }

    const { error: linkError } = await supabase.from('parent_access_students').insert(
      selectedIds.map((student_id) => ({ parent_access_id: created.id, student_id })),
    );
    setSubmitting(false);
    if (linkError) {
      await supabase.from('parent_access').delete().eq('id', created.id);
      setError(linkError.message);
      return;
    }
    onCreated();
  }

  return (
    <ModalShell title="Nouvel accès parent" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Prénom</label>
            <input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Téléphone (facultatif, pour info seulement)</label>
        <PhoneInput dial={phoneDial} local={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} style={{ marginBottom: 12 }} />

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

function EditParentAccessStudentsModal({ access, onClose, onSaved }) {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const students = useStudentsForLinking(schoolYear?.id);
  const [selectedIds, setSelectedIds] = useState(
    (access.parent_access_students || []).map((row) => row.students?.id).filter(Boolean),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleStudent(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError('Sélectionne au moins un élève.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: deleteError } = await supabase.from('parent_access_students').delete().eq('parent_access_id', access.id);
    if (deleteError) { setSubmitting(false); setError(deleteError.message); return; }
    const { error: insertError } = await supabase.from('parent_access_students').insert(
      selectedIds.map((student_id) => ({ parent_access_id: access.id, student_id })),
    );
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    onSaved();
  }

  return (
    <ModalShell title={`Enfants rattachés — ${access.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '6px 10px', marginBottom: 18 }}>
          {students === null && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Chargement…</p>}
          {students?.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
              {s.full_name} <span style={{ color: 'var(--muted)' }}>· {s.niveau}</span>
            </label>
          ))}
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <ModalActions onCancel={onClose} submitting={submitting} submitLabel="Enregistrer" submittingLabel="Enregistrement…" />
      </form>
    </ModalShell>
  );
}

function ParentAccessRow({ access, isLast, menuOpen, onToggleMenu, onCloseMenu, onCopyLink, onRegenerate, onEditStudents, onDelete, copied }) {
  const children = (access.parent_access_students || []).map((row) => row.students?.full_name).filter(Boolean);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div onClick={onToggleMenu} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, flex: 1 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 12, fontWeight: 600, color: 'var(--clay-dark)', flexShrink: 0 }}>
          {initials(access.full_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{access.full_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{access.code}</span> · {children.length ? children.join(', ') : 'aucun enfant relié'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {copied && <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>Copié !</span>}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ ...iconButtonStyle, color: 'var(--danger)' }} title="Supprimer">
          <TrashIcon />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(); }} style={{ ...iconButtonStyle, color: 'var(--muted)' }} title="Actions">
          <GearIcon />
        </button>
      </div>

      {menuOpen && (
        <ParentAccessMenu
          onCopyLink={onCopyLink}
          onRegenerate={onRegenerate}
          onEditStudents={onEditStudents}
          onClose={onCloseMenu}
        />
      )}
    </div>
  );
}

function ParentAccessMenu({ onCopyLink, onRegenerate, onEditStudents, onClose }) {
  const items = [
    { id: 'copy', label: 'Copier le lien', action: onCopyLink },
    { id: 'students', label: 'Modifier les enfants rattachés', action: onEditStudents },
    { id: 'regen', label: 'Régénérer le code', action: onRegenerate },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: '100%', right: 20, marginTop: 4, zIndex: 30, background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 240, overflow: 'hidden' }}
      >
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => { it.action(); onClose(); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', border: 'none', background: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

// Ligne de compte partagée (personnel/parent) : nom cliquable et roue
// dentée ouvrent le même petit menu d'actions, ancré à l'extrême droite.
function AccountRow({ account, avatarBg, avatarColor, subtitle, isLast, menuOpen, onToggleMenu, onCloseMenu, onSelectField, canDelete, onDelete, badge }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div onClick={onToggleMenu} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, flex: 1 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 12, fontWeight: 600, color: avatarColor, flexShrink: 0 }}>
          {initials(account.full_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{account.full_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {badge}
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ ...iconButtonStyle, color: 'var(--danger)' }} title="Supprimer">
            <TrashIcon />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(); }} style={{ ...iconButtonStyle, color: 'var(--muted)' }} title="Modifier ce compte">
          <GearIcon />
        </button>
      </div>

      {menuOpen && (
        <AccountActionsMenu
          onSelect={onSelectField}
          onClose={onCloseMenu}
        />
      )}
    </div>
  );
}

function AccountActionsMenu({ onSelect, onClose }) {
  const items = [
    { field: 'email', label: "Modifier l'adresse e-mail" },
    { field: 'phone', label: 'Modifier le numéro de téléphone' },
    { field: 'password', label: 'Modifier le mot de passe' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: '100%', right: 20, marginTop: 4, zIndex: 30, background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 230, overflow: 'hidden' }}
      >
        {items.map((it, i) => (
          <button
            key={it.field}
            type="button"
            onClick={() => onSelect(it.field)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', border: 'none', background: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

function EditFieldModal({ account, field, functionName, onClose, onSaved }) {
  const [email, setEmail] = useState(account.email || '');
  const initialPhone = decomposePhone(account.phone);
  const [phoneDial, setPhoneDial] = useState(initialPhone.dial);
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    email: "Modifier l'adresse e-mail",
    phone: 'Modifier le numéro de téléphone',
    password: 'Modifier le mot de passe',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const body = { action: 'update', profileId: account.id };

    if (field === 'email') {
      if (!email.trim()) { setError("L'e-mail est obligatoire."); return; }
      body.email = email.trim();
    }
    if (field === 'phone') {
      const composed = composePhone(phoneDial, phoneLocal);
      if (!composed) { setError('Numéro de téléphone invalide.'); return; }
      body.phone = composed;
    }
    if (field === 'password') {
      if (!password || password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
      body.password = password;
    }

    setSubmitting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke(functionName, { body });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title={`${titles[field]} — ${account.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {field === 'email' && (
          <>
            <label style={labelStyle}>Nouvelle adresse e-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
          </>
        )}
        {field === 'phone' && (
          <>
            <label style={labelStyle}>Nouveau numéro de téléphone</label>
            <PhoneInput dial={phoneDial} local={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} style={{ marginBottom: 18 }} />
          </>
        )}
        {field === 'password' && (
          <>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={{ ...inputStyle, marginBottom: 18 }} />
          </>
        )}

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <ModalActions onCancel={onClose} submitting={submitting} submitLabel="Enregistrer" submittingLabel="Enregistrement…" />
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

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
// Zone de clic élargie (min. 36px) : les icônes seules (17px) sont trop
// petites à toucher précisément sur mobile, d'où l'impression que le bouton
// « ne répond pas » alors qu'il suffit de rater le clic de quelques pixels.
const iconButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' };
