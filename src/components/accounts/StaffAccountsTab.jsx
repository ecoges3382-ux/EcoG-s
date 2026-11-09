import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { initials, ROLES, sortByRole } from '../../lib/utils.js';
import PhoneInput, { decomposePhone, composePhone } from '../PhoneInput.jsx';
import { useToast } from '../Toast.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import Dropdown from '../Dropdown.jsx';
import OfflineBanner from '../OfflineBanner.jsx';
import { guardedFetch } from '../../lib/offlineCache.js';
import { SkeletonRow } from '../Skeleton.jsx';
import ModalContainer from '../ModalContainer.jsx';

const CREATABLE_STAFF_ROLES = ['directeur', 'censeur', 'secretaire', 'enseignant'];

// 🧠 RÈGLE D'OR : Les permissions par défaut selon le rôle
const ROLE_PERMISSIONS = {
  directeur: {
    dashboard: true, eleves: true, parents: true, personnel: true, classes: true, matieres: true,
    notes: true, bulletins: true, emploi_du_temps: true, presences: true, annonces: true,
    documents: true, rapports: true, finance: true, parametres: true // Le directeur a TOUT (sauf comptes)
  },
  censeur: {
    dashboard: true, eleves: true, parents: true, personnel: false, classes: true, matieres: true,
    notes: true, bulletins: true, emploi_du_temps: true, presences: true, annonces: true,
    documents: true, rapports: true, finance: false, parametres: false
  },
  secretaire: {
    dashboard: true, eleves: true, parents: true, personnel: false, classes: true, matieres: false,
    notes: false, bulletins: false, emploi_du_temps: false, presences: false, annonces: true,
    documents: true, rapports: false, finance: true, parametres: true
  },
  enseignant: {
    dashboard: true, eleves: false, parents: false, personnel: false, classes: false, matieres: false,
    notes: true, bulletins: true, emploi_du_temps: true, presences: true, annonces: true,
    documents: true, rapports: false, finance: false, parametres: false
  }
};

// 👇 CORRECTION ICI : J'ai ajouté "classes" et "matieres" pour que toutes les pages soient gérables
const PERMISSIONS_LABELS = {
  dashboard: 'Tableau de bord', 
  eleves: 'Gestion des élèves', 
  parents: 'Portail parents',
  personnel: 'Gestion du personnel', 
  classes: 'Gestion des classes', 
  matieres: 'Gestion des matières',
  notes: 'Notes & évaluations', 
  bulletins: 'Bulletins',
  finance: 'Gestion financière (Argent)', 
  presences: 'Présences', 
  emploi_du_temps: 'Emploi du temps',
  annonces: 'Annonces', 
  documents: 'Documents', 
  rapports: 'Rapports', 
  parametres: 'Accès aux paramètres',
};

async function describeFunctionError(fnError) {
  if (!fnError) return null;
  try {
    const body = await fnError.context.json();
    if (body?.error) return body.error;
  } catch { /* corps non lisible */ }
  return fnError.message;
}

function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
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

export default function StaffAccountsTab() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const isFondateur = profile.role === 'fondateur';

  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  async function reload() {
    await guardedFetch({
      cacheKey: `staff_accounts_${profile.school_id}`,
      hasData: accounts !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase.from('profiles').select('*').order('full_name');
        return fetchError ? { error: fetchError } : { data: sortByRole(data) };
      },
      setData: setAccounts,
      setOffline,
      onError: (err) => setError(err.message),
      onSuccess: () => setError(''),
    });
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(account) {
    if (!(await confirm(`Supprimer le compte de ${account.full_name} ? Cette action est définitive.`, { confirmLabel: 'Supprimer' }))) return;
    const { data, error: fnError } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'delete', profileId: account.id },
    });
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    reload();
  }

  function openEdit(account) {
    setEditingAccount(account);
    setModalOpen(true);
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
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Gérez les accès de votre équipe. Un e-mail d'invitation sera envoyé.</p>
        <button onClick={() => { setEditingAccount(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', flexShrink: 0 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouveau compte
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {offline && <OfflineBanner />}
      {!accounts && <div className="card-bold"><SkeletonRow count={5} /></div>}

      {accounts && (
        <div className="card-bold">
          {accounts.map((a, i) => (
            <AccountRow
              key={a.id} account={a} avatarBg="var(--forest-light)" avatarColor="var(--forest)"
              subtitle={`${a.email || '—'}${a.phone ? ` · ${a.phone}` : ''}`}
              isLast={i === accounts.length - 1} onEdit={() => openEdit(a)}
              canDelete={a.role !== 'fondateur' && a.id !== profile.id} onDelete={() => handleDelete(a)}
              badge={<span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>{ROLES[a.role]?.label || a.role}</span>}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <StaffAccountModal
          editing={editingAccount}
          onClose={() => { setModalOpen(false); setEditingAccount(null); }}
          onSaved={() => { setModalOpen(false); setEditingAccount(null); reload(); }}
        />
      )}
    </div>
  );
}

function StaffAccountModal({ editing, onClose, onSaved }) {
  const showToast = useToast();
  const isEditing = !!editing;

  const [fullName, setFullName] = useState(editing?.full_name || '');
  const [role, setRole] = useState(editing?.role || CREATABLE_STAFF_ROLES[0]);
  const [email, setEmail] = useState(editing?.email || '');
  
  const initialPhone = decomposePhone(editing?.phone || '');
  const [phoneDial, setPhoneDial] = useState(initialPhone.dial);
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local);
  
  const [permissions, setPermissions] = useState(editing?.permissions || ROLE_PERMISSIONS[role]);
  const [customize, setCustomize] = useState(!!editing); 

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (!customize) {
      setPermissions(ROLE_PERMISSIONS[newRole] || {});
    }
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) { setError('Le nom et l\'e-mail sont obligatoires.'); return; }
    
    setSubmitting(true);
    setError('');

    const body = { 
      action: isEditing ? 'update' : 'create', 
      full_name: fullName.trim(), 
      email: email.trim(), 
      phone: composePhone(phoneDial, phoneLocal), 
      role,
      permissions
    };
    
    if (isEditing) body.profileId = editing.id;

    const { data, error: fnError } = await supabase.functions.invoke('manage-staff-account', { body });
    
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || (await describeFunctionError(fnError)));
      return;
    }
    
    showToast(isEditing ? 'Compte mis à jour' : 'Invitation envoyée par e-mail !');
    onSaved();
  }

  return (
    <ModalContainer onClose={onClose} maxWidth={480}>
      <div style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{isEditing ? "Modifier le compte" : "Nouveau compte"}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Nom complet</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Rôle</label>
          <Dropdown value={role} onChange={handleRoleChange} options={CREATABLE_STAFF_ROLES.map((r) => ({ value: r, label: ROLES[r].label }))} style={{ ...inputStyle, marginBottom: 4 }} />

          <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
            <i className="ti ti-info-circle" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
            Les droits d'accès par défaut seront automatiquement appliqués selon ce rôle.
          </p>

          <label style={labelStyle}>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} disabled={isEditing} title={isEditing ? "L'e-mail ne peut pas être modifié" : ""} />

          <label style={labelStyle}>Téléphone (facultatif)</label>
          <PhoneInput dial={phoneDial} local={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} style={{ marginBottom: 12 }} />

          {!isEditing && (
            <p style={{ margin: '0 0 18px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              <i className="ti ti-mail" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
              Un e-mail sera envoyé à cette adresse pour que l'utilisateur crée son propre mot de passe.
            </p>
          )}

          <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--cream)', borderRadius: 12, border: '1px solid var(--line)' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: customize ? 14 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Personnaliser les droits d'accès</span>
              
              <div style={{ position: 'relative', width: 44, height: 24, background: customize ? 'var(--forest)' : 'var(--line-strong)', borderRadius: 24, transition: 'background 0.3s' }}>
                <div style={{ 
                  position: 'absolute', top: 2, left: customize ? 22 : 2, 
                  width: 20, height: 20, background: '#fff', borderRadius: '50%', 
                  transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
                }} />
              </div>
              
              <input 
                type="checkbox" 
                checked={customize} 
                onChange={(e) => {
                  setCustomize(e.target.checked);
                  if (!e.target.checked) setPermissions(ROLE_PERMISSIONS[role] || {});
                }} 
                style={{ display: 'none' }} 
              />
            </label>

            {customize && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                {Object.entries(PERMISSIONS_LABELS).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, cursor: 'pointer', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>
                    <input 
                      type="checkbox" 
                      checked={!!permissions[key]} 
                      onChange={() => togglePermission(key)} 
                      style={{ accentColor: 'var(--forest)', width: 15, height: 15, marginTop: 2, flexShrink: 0 }} 
                    />
                    <span style={{ paddingTop: 1 }}>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Enregistrement…' : (isEditing ? 'Enregistrer' : 'Envoyer l\'invitation')}
            </button>
          </div>
        </form>
      </div>
    </ModalContainer>
  );
}

function AccountRow({ account, avatarBg, avatarColor, subtitle, isLast, onEdit, canDelete, onDelete, badge }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
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
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ ...iconButtonStyle, color: 'var(--muted)' }} title="Modifier ce compte">
          <PencilIcon />
        </button>
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ ...iconButtonStyle, color: 'var(--danger)' }} title="Supprimer">
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const iconButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer' };
