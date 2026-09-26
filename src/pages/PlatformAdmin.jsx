import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { generateAccessCode } from '../lib/utils.js';
import { useToast } from '../components/Toast.jsx';

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

async function callPlatformAdmin(body) {
  const { data, error: fnError } = await supabase.functions.invoke('platform-admin', { body });
  if (fnError || data?.error) {
    return { data: null, error: data?.error || (await describeFunctionError(fnError)) };
  }
  return { data, error: null };
}

const STATUT_LABELS = {
  essai: { label: 'Essai', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
  actif: { label: 'Actif', bg: 'var(--success-light)', fg: 'var(--success)' },
  suspendu: { label: 'Suspendu', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  resilie: { label: 'Résilié', bg: 'var(--danger-light)', fg: 'var(--danger)' },
};

const ROLE_LABELS = { fondateur: 'Fondateur', directeur: 'Directeur', secretaire: 'Secrétaire', enseignant: 'Enseignant' };

const ACTION_LABELS = {
  set_statut: 'Changement de statut',
  set_note: 'Note modifiée',
  delete: 'École supprimée',
  impersonate: 'Connexion à la place d’un compte',
  reset_password: 'Lien de réinitialisation généré',
  add_admin: 'Administrateur ajouté',
  remove_admin: 'Administrateur retiré',
  create_school_invite: 'Code d’inscription créé',
  revoke_school_invite: 'Code d’inscription révoqué',
};

const TABS = [
  { id: 'ecoles', label: 'Écoles' },
  { id: 'admins', label: 'Administrateurs' },
  { id: 'school-invites', label: 'Codes écoles' },
  { id: 'journal', label: "Journal d'activité" },
];

export default function PlatformAdmin() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState('ecoles');
  const [schools, setSchools] = useState(null);
  const [error, setError] = useState('');

  async function reloadSchools() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'list' });
    if (err) { setError(err); return; }
    setSchools(data.schools);
  }

  useEffect(() => { reloadSchools(); }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-dark)', padding: '28px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
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

        {schools && <OverviewStats schools={schools} />}

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${tab === t.id ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`,
                background: tab === t.id ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
                color: tab === t.id ? 'var(--forest-dark)' : 'rgba(255,255,255,0.85)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}

        {tab === 'ecoles' && <EcolesTab schools={schools} reload={reloadSchools} />}
        {tab === 'admins' && <AdminsTab />}
        {tab === 'school-invites' && <SchoolInvitesTab />}
        {tab === 'journal' && <JournalTab />}
      </div>
    </div>
  );
}

function SchoolInvitesTab() {
  const { profile } = useAuth();
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  async function reload() {
    setError('');
    const { data, error: loadError } = await supabase
      .from('school_signup_invites')
      .select('id, code, created_at, expires_at, used_at, used_by')
      .order('created_at', { ascending: false });
    if (loadError) { setError(loadError.message); return; }
    setInvites(data || []);
  }

  useEffect(() => { reload(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNewInvite(null);
    const code = generateAccessCode(12);
    const { error: insertError } = await supabase.from('school_signup_invites').insert({
      code,
      created_by: profile?.id,
    });
    setCreating(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ code });
    await reload();
  }

  async function handleRevoke(invite) {
    if (!window.confirm('Révoquer ce code ? Il ne pourra plus créer de compte.')) return;
    setRevokingId(invite.id);
    setError('');
    const { error: deleteError } = await supabase.from('school_signup_invites').delete().eq('id', invite.id).is('used_at', null);
    setRevokingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    await reload();
  }

  return (
    <div>
      {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Invitations pour créer une école</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Chaque code est individuel, utilisable une seule fois et valable 7 jours. Communique-le directement à la personne invitée.
      </p>
      {newInvite && (
        <div className="card-bold" style={{ padding: '14px 16px', background: 'var(--gold-light)', borderColor: 'var(--gold)', marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>Code à transmettre à la personne invitée</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button type="button" onClick={() => navigator.clipboard?.writeText(newInvite.code)} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '6px 11px' }}>Copier</button>
          </div>
        </div>
      )}
      <form onSubmit={handleCreate} className="card-bold" style={{ padding: '16px 18px', background: 'var(--paper)', marginBottom: 18 }}>
        <button type="submit" disabled={creating} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Génération…' : 'Générer un code individuel'}
        </button>
      </form>
      {!invites && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>}
      {invites?.length === 0 && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Aucun code créé.</p>}
      {invites && invites.length > 0 && (
        <div className="card-bold" style={{ overflow: 'hidden', background: 'var(--paper)' }}>
          {invites.map((inv, i) => {
            const expired = new Date(inv.expires_at) < new Date();
            const status = inv.used_at ? 'Utilisé' : expired ? 'Expiré' : 'Disponible';
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === invites.length - 1 ? 'none' : '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '0.06em' }}>{inv.code} <span style={{ fontFamily: 'inherit', letterSpacing: 0, fontWeight: 400, color: 'var(--muted)' }}>· {status}</span></p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Créé le {new Date(inv.created_at).toLocaleDateString('fr-FR')} · expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}</p>
                </div>
                {!inv.used_at && !expired && (
                  <button type="button" onClick={() => handleRevoke(inv)} disabled={revokingId === inv.id} style={{ ...btnStyle('var(--danger)'), fontSize: 12 }}>Révoquer</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OverviewStats({ schools }) {
  const actives = schools.filter((s) => s.statut === 'actif' || s.statut === 'essai').length;
  const suspendues = schools.filter((s) => s.statut === 'suspendu' || s.statut === 'resilie').length;
  const totalEleves = schools.reduce((a, s) => a + s.studentCount, 0);
  const totalPersonnel = schools.reduce((a, s) => a + s.staffCount, 0);
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const nouvellesCeMois = schools.filter((s) => new Date(s.created_at) >= debutMois).length;

  return (
    <div className="desktop-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
      <StatCard label="Écoles actives" value={actives} sub={suspendues > 0 ? `${suspendues} suspendue${suspendues > 1 ? 's' : ''}/résiliée${suspendues > 1 ? 's' : ''}` : undefined} />
      <StatCard label="Élèves (toutes écoles)" value={totalEleves} />
      <StatCard label="Comptes personnel" value={totalPersonnel} />
      <StatCard label="Nouvelles écoles ce mois" value={nouvellesCeMois} />
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px', background: 'var(--paper)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--amber)' }}>{sub}</p>}
    </div>
  );
}

const SORTS = [
  { id: 'recent', label: 'Plus récentes' },
  { id: 'nom', label: 'Nom (A→Z)' },
  { id: 'effectif', label: 'Effectif (élèves)' },
];

function EcolesTab({ schools, reload }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [detailId, setDetailId] = useState(null);
  const [busyRowId, setBusyRowId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [rowError, setRowError] = useState('');

  // Bascule rapide directement depuis la liste, sans ouvrir la fiche — même
  // action que le bouton Suspendre/Réactiver de SchoolDetailModal, juste un
  // raccourci. "actif" est délibérément le seul état de réactivation (une
  // école en 'essai' réactivée depuis ici redevient 'actif', jamais
  // 'essai' — les deux se comportent identiquement aujourd'hui, voir
  // schema.sql) : cohérent avec la même simplification déjà faite dans
  // SchoolDetailModal (son bouton ne teste que statut !== 'suspendu').
  async function handleQuickToggle(school) {
    setRowError('');
    setBusyRowId(school.id);
    const nextStatut = school.statut === 'suspendu' ? 'actif' : 'suspendu';
    const { error: err } = await callPlatformAdmin({ action: 'set_statut', schoolId: school.id, statut: nextStatut });
    setBusyRowId(null);
    if (err) { setRowError(err); return; }
    reload();
  }

  async function handleQuickDelete(school) {
    setRowError('');
    setBusyRowId(school.id);
    const { error: err } = await callPlatformAdmin({ action: 'delete', schoolId: school.id });
    setBusyRowId(null);
    setConfirmingDeleteId(null);
    if (err) { setRowError(err); return; }
    reload();
  }

  const filtered = useMemo(() => {
    if (!schools) return [];
    const term = search.trim().toLowerCase();
    let list = term ? schools.filter((s) => s.name.toLowerCase().includes(term)) : schools;
    list = [...list];
    if (sort === 'nom') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'effectif') list.sort((a, b) => b.studentCount - a.studentCount);
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [schools, search, sort]);

  if (!schools) return <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>;

  const detailSchool = schools.find((s) => s.id === detailId) || null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une école…"
          style={{ flex: '2 1 220px', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13 }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ flex: '1 1 160px', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13 }}
        >
          {SORTS.map((s) => <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.label}</option>)}
        </select>
      </div>

      {rowError && <p style={{ color: '#ffb4a8', marginBottom: 10, fontWeight: 600, fontSize: 12.5 }}>{rowError}</p>}

      {filtered.length === 0 && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Aucune école ne correspond.</p>}

      {filtered.length > 0 && (
        <div className="card-bold" style={{ overflowX: 'hidden', background: 'var(--paper)' }}>
          {filtered.map((s, i) => {
            const st = STATUT_LABELS[s.statut] || STATUT_LABELS.actif;
            const canDelete = s.statut === 'suspendu' || s.statut === 'resilie';
            const isActive = s.statut !== 'suspendu';
            const busy = busyRowId === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '12px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--line)',
                }}
              >
                <div
                  onClick={() => setDetailId(s.id)}
                  style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</p>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {s.staffCount} compte{s.staffCount !== 1 ? 's' : ''} · {s.studentCount} élève{s.studentCount !== 1 ? 's' : ''} · créée le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <StatutSwitch active={isActive} disabled={busy} onChange={() => handleQuickToggle(s)} />

                  {confirmingDeleteId === s.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        title="Annuler"
                        style={iconBtnStyle('var(--muted)')}
                      >
                        <i className="ti ti-x" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDelete(s)}
                        disabled={busy}
                        title="Confirmer la suppression définitive"
                        style={iconBtnStyle('var(--danger)')}
                      >
                        <i className="ti ti-check" aria-hidden="true"></i>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (canDelete ? setConfirmingDeleteId(s.id) : null)}
                      disabled={!canDelete || busy}
                      title={canDelete ? 'Supprimer définitivement' : "Suspends d'abord cette école pour pouvoir la supprimer."}
                      style={{ ...iconBtnStyle(canDelete ? 'var(--danger)' : 'var(--line-strong)'), cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.5 }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailSchool && (
        <SchoolDetailModal
          school={detailSchool}
          onClose={() => setDetailId(null)}
          onChanged={() => { reload(); }}
        />
      )}
    </div>
  );
}

function SchoolDetailModal({ school, onClose, onChanged }) {
  const showToast = useToast();
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [link, setLink] = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(school.note_administrative || '');

  async function loadStaff() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'school_detail', schoolId: school.id });
    if (err) { setError(err); return; }
    setStaff(data.staff);
  }

  useEffect(() => { loadStaff(); }, [school.id]);

  const st = STATUT_LABELS[school.statut] || STATUT_LABELS.actif;
  const canDelete = school.statut === 'suspendu' || school.statut === 'resilie';

  async function handleSetStatut(statut) {
    setBusyId('statut');
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'set_statut', schoolId: school.id, statut });
    setBusyId(null);
    if (err) { setError(err); return; }
    onChanged();
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'delete', schoolId: school.id });
    setDeleting(false);
    if (err) { setError(err); return; }
    onChanged();
    onClose();
  }

  async function saveNote() {
    setBusyId('note');
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'set_note', schoolId: school.id, note: noteDraft });
    setBusyId(null);
    if (err) { setError(err); return; }
    setEditingNote(false);
    showToast('Enregistré');
    onChanged();
  }

  async function handleSupportAction(action, profileId) {
    setBusyId(`${action}-${profileId}`);
    setError('');
    setLink(null);
    const { data, error: err } = await callPlatformAdmin({ action, schoolId: school.id, profileId });
    setBusyId(null);
    if (err) { setError(err); return; }
    setLink({ action, url: data.link });
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 20px', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 560, width: '100%', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <span style={{ display: 'inline-block', marginBottom: 16, fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>

        {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {school.statut !== 'suspendu' ? (
            <button type="button" onClick={() => handleSetStatut('suspendu')} disabled={busyId === 'statut'} style={btnStyle('var(--amber)')}>Suspendre</button>
          ) : (
            <button type="button" onClick={() => handleSetStatut('actif')} disabled={busyId === 'statut'} style={btnStyle('var(--success)')}>Réactiver</button>
          )}
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => (canDelete ? setConfirmingDelete(true) : null)}
              disabled={!canDelete}
              title={canDelete ? undefined : "Suspends d'abord cette école pour pouvoir la supprimer définitivement."}
              style={{ ...btnStyle(canDelete ? 'var(--danger)' : 'var(--line-strong)'), color: canDelete ? 'var(--danger)' : 'var(--muted)', cursor: canDelete ? 'pointer' : 'not-allowed' }}
            >
              Supprimer définitivement
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmingDelete(false)} style={btnStyle('var(--line-strong)')}>Annuler</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ ...btnStyle('var(--danger)'), background: 'var(--danger)', color: '#fff' }}>
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Note administrative</p>
          {editingNote ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Plan convenu, contact, motif de suspension…"
                style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 12.5, color: 'var(--ink)' }}
              />
              <button type="button" onClick={saveNote} disabled={busyId === 'note'} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff' }}>Enregistrer</button>
              <button type="button" onClick={() => setEditingNote(false)} style={btnStyle('var(--line-strong)')}>Annuler</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setNoteDraft(school.note_administrative || ''); setEditingNote(true); }}
              style={{ padding: 0, border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', fontStyle: school.note_administrative ? 'normal' : 'italic' }}
            >
              {school.note_administrative || 'Ajouter une note administrative…'}
            </button>
          )}
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Personnel</p>
        {!staff && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>}
        {staff && staff.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun compte.</p>}
        {staff && staff.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            {staff.map((p, i) => (
              <div key={p.id} style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{p.full_name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {ROLE_LABELS[p.role] || p.role}</span></p>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{p.email || p.phone || '—'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleSupportAction('impersonate', p.id)}
                      disabled={!p.email || busyId === `impersonate-${p.id}`}
                      title={p.email ? "Générer un lien de connexion à la place de ce compte" : "Ce compte n'a pas d'e-mail"}
                      style={{ ...btnStyle('var(--forest)'), fontSize: 11.5, padding: '6px 10px', opacity: p.email ? 1 : 0.4, cursor: p.email ? 'pointer' : 'not-allowed' }}
                    >
                      Se connecter en tant que
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSupportAction('reset_password', p.id)}
                      disabled={!p.email || busyId === `reset_password-${p.id}`}
                      title={p.email ? 'Générer un lien de réinitialisation de mot de passe' : "Ce compte n'a pas d'e-mail"}
                      style={{ ...btnStyle('var(--line-strong)'), fontSize: 11.5, padding: '6px 10px', opacity: p.email ? 1 : 0.4, cursor: p.email ? 'pointer' : 'not-allowed' }}
                    >
                      Mot de passe
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {link && (
          <div className="card-bold" style={{ padding: '12px 14px', background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
              {link.action === 'impersonate' ? 'Lien de connexion à usage unique' : 'Lien de réinitialisation de mot de passe'} — ne le partage qu'avec la personne concernée.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ flex: '1 1 220px', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 11.5, color: 'var(--ink)' }} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(link.url)}
                style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '7px 12px' }}
              >
                Copier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(borderColor) {
  return { padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: 'none', color: borderColor, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' };
}

function iconBtnStyle(color) {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none', background: 'none', color, fontSize: 16, cursor: 'pointer' };
}

// Interrupteur à glissière (actif = vert à droite / suspendu = gris à
// gauche) — raccourci direct depuis la liste des écoles, sans ouvrir la
// fiche détail, pour l'action la plus fréquente (suspendre/réactiver).
function StatutSwitch({ active, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Suspendre cette école' : 'Réactiver cette école'}
      title={active ? 'Suspendre' : 'Réactiver'}
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 42, height: 24, borderRadius: 20, border: 'none', padding: 2, flexShrink: 0,
        background: active ? 'var(--success)' : 'var(--line-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transform: active ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.15s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
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

function AdminsTab() {
  const showToast = useToast();
  const { profile } = useAuth();
  const [admins, setAdmins] = useState(null);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  async function reload() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'list_admins' });
    if (err) { setError(err); return; }
    setAdmins(data.admins);
  }

  async function reloadInvites() {
    const { data, error: err } = await supabase
      .from('platform_admin_invites')
      .select('id, email, code, used_at, expires_at, created_at')
      .is('used_at', null)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setInvites(data || []);
  }

  useEffect(() => { reload(); reloadInvites(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'add_admin', email: email.trim() });
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail('');
    showToast('Enregistré');
    reload();
  }

  async function handleRemove(a) {
    if (!window.confirm(`Retirer ${a.email || a.user_id} des administrateurs de la plateforme ?`)) return;
    setRemovingId(a.user_id);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'remove_admin', userId: a.user_id });
    setRemovingId(null);
    if (err) { setError(err); return; }
    reload();
  }

  // Insert direct (RLS), même principe que les codes d'accès parent
  // (parent_access) : un administrateur en place génère un code, le
  // communique hors système à la personne à inviter, qui l'utilise sur
  // /inscription-administrateur — jamais besoin que cette personne ait déjà
  // un compte, contrairement à "Promouvoir un compte existant" ci-dessous.
  async function handleCreateInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setCreatingInvite(true);
    setError('');
    setNewInvite(null);
    const code = generateAccessCode();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const { error: insertError } = await supabase.from('platform_admin_invites').insert({
      email: cleanEmail, code, created_by: profile?.id,
    });
    setCreatingInvite(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ email: cleanEmail, code });
    setInviteEmail('');
    reloadInvites();
  }

  async function handleRevoke(invite) {
    if (!window.confirm(`Révoquer l'invitation pour ${invite.email} ?`)) return;
    setRevokingId(invite.id);
    setError('');
    const { error: deleteError } = await supabase.from('platform_admin_invites').delete().eq('id', invite.id);
    setRevokingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    reloadInvites();
  }

  return (
    <div>
      {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Administrateurs actuels</p>
      {!admins && <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>}
      {admins && (
        <div className="card-bold" style={{ overflow: 'hidden', background: 'var(--paper)', marginBottom: 24 }}>
          {admins.map((a, i) => (
            <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === admins.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{a.email || a.user_id}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Depuis le {new Date(a.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(a)}
                disabled={removingId === a.user_id || admins.length <= 1}
                title={admins.length <= 1 ? 'Impossible de retirer le dernier administrateur' : undefined}
                style={{ ...btnStyle('var(--danger)'), fontSize: 12, opacity: admins.length <= 1 ? 0.4 : 1, cursor: admins.length <= 1 ? 'not-allowed' : 'pointer' }}
              >
                Retirer
              </button>
            </div>
          ))}
          {admins.length === 0 && <p style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Aucun administrateur.</p>}
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Inviter un nouvel administrateur</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Génère un code à usage unique, à communiquer toi-même (téléphone, WhatsApp…) à la personne. Elle crée son compte
        sur l'écran "Créer un compte administrateur" (au bas de la page de connexion) avec ce code — son compte
        n'est lié à aucune école.
      </p>

      {newInvite && (
        <div className="card-bold" style={{ padding: '14px 16px', background: 'var(--gold-light)', borderColor: 'var(--gold)', marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
            Code pour {newInvite.email} — à communiquer, ne le laisse pas affiché à l'écran.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(newInvite.code)}
              style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '6px 11px' }}
            >
              Copier
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateInvite} className="card-bold" style={{ padding: '16px 18px', background: 'var(--paper)', display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <input
          type="email"
          required
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="E-mail de la personne à inviter"
          style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }}
        />
        <button type="submit" disabled={creatingInvite} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', opacity: creatingInvite ? 0.7 : 1 }}>
          {creatingInvite ? 'Génération…' : 'Générer un code'}
        </button>
      </form>

      {invites && invites.length > 0 && (
        <div className="card-bold" style={{ overflow: 'hidden', background: 'var(--paper)', marginBottom: 24 }}>
          {invites.map((inv, i) => {
            const expired = new Date(inv.expires_at) < new Date();
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === invites.length - 1 ? 'none' : '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{inv.email} <span style={{ fontWeight: 400, color: 'var(--muted)', fontFamily: 'var(--serif)', letterSpacing: '0.06em' }}>· {inv.code}</span></p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: expired ? 'var(--danger)' : 'var(--muted)' }}>
                    {expired ? 'Expirée' : `Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv)}
                  disabled={revokingId === inv.id}
                  style={{ ...btnStyle('var(--danger)'), fontSize: 12 }}
                >
                  Révoquer
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Promouvoir un compte existant</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Pour donner le statut d'administrateur à un compte qui a déjà un profil d'école (ex. un fondateur) — sans passer
        par une invitation.
      </p>
      <form onSubmit={handleAdd} className="card-bold" style={{ padding: '16px 18px', background: 'var(--paper)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail d'un compte EcoGès existant"
          style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }}
        />
        <button type="submit" disabled={submitting} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

function JournalTab() {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    callPlatformAdmin({ action: 'list_actions' }).then(({ data, error: err }) => {
      if (err) { setError(err); return; }
      setActions(data.actions);
    });
  }, []);

  if (error) return <p style={{ color: '#ffb4a8', fontWeight: 600, fontSize: 13.5 }}>{error}</p>;
  if (!actions) return <p style={{ color: 'rgba(255,255,255,0.65)' }}>Chargement…</p>;

  return (
    <div className="card-bold" style={{ overflow: 'hidden', background: 'var(--paper)' }}>
      {actions.map((a, i) => (
        <div key={a.id} style={{ padding: '12px 16px', borderBottom: i === actions.length - 1 ? 'none' : '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ACTION_LABELS[a.action] || a.action}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{new Date(a.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {a.admin_email} {a.school_name ? `· ${a.school_name}` : ''} {a.target_label ? `· ${a.target_label}` : ''}
          </p>
          {a.details && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{a.details}</p>}
        </div>
      ))}
      {actions.length === 0 && <p style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Aucune action enregistrée pour l'instant.</p>}
    </div>
  );
}
