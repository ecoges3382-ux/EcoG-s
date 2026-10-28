import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { generateAccessCode, copyText } from '../lib/utils.js';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';

async function describeFunctionError(fnError) {
  if (!fnError) return null;
  try {
    const body = await fnError.context.json();
    if (body?.error) return body.error;
  } catch {
    // corps non lisible en JSON
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
  essai: { label: 'Essai', bg: '#FEF3E2', fg: '#8F4620' },
  actif: { label: 'Actif', bg: '#D4F0E2', fg: '#0A7A4F' },
  suspendu: { label: 'Suspendu', bg: '#FCEEDC', fg: '#B4670E' },
  resilie: { label: 'Résilié', bg: '#FBE3DF', fg: '#B33B2A' },
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

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" /><path d="M9 20v-4h6v4" /><path d="M8 7.5h1.2M8 11h1.2M14.8 7.5H16M14.8 11H16" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" /><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 14c2.4.2 4.2 2.4 4.4 4.7" />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2.4" /><circle cx="12" cy="10.5" r="2.4" /><path d="M8.3 16.5c.5-1.7 1.9-2.6 3.7-2.6s3.2.9 3.7 2.6" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const TABS = [
  { id: 'ecoles', label: 'Écoles' },
  { id: 'admins', label: 'Administrateurs' },
  { id: 'school-invites', label: 'Codes écoles' },
  { id: 'journal', label: "Journal d'activité" },
];

export default function PlatformAdmin() {
  const { signOut, profile } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState('ecoles');
  const [schools, setSchools] = useState(null);
  const [tabCounts, setTabCounts] = useState({ admins: null, invites: null });
  const [error, setError] = useState('');

  async function reloadSchools() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'list' });
    if (err) { setError(err); return; }
    setSchools(data.schools);
  }

  useEffect(() => { reloadSchools(); }, []);

  // Compteurs d'onglets (légers, chargés une fois)
  useEffect(() => {
    callPlatformAdmin({ action: 'list_admins' }).then(({ data }) => {
      if (data?.admins) setTabCounts((prev) => ({ ...prev, admins: data.admins.length }));
    });
    supabase.from('school_signup_invites').select('id', { count: 'exact', head: true }).is('used_at', null)
      .then(({ count }) => setTabCounts((prev) => ({ ...prev, invites: count || 0 })));
  }, []);

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-dark)', padding: '28px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18, color: 'var(--forest-dark)' }}>
              EG
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#fff' }}>Administration</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
                {profile?.email ? `Connecté en tant que ${profile.email}` : 'Console plateforme'} · {today}
              </p>
            </div>
          </div>
          <button
            onClick={async () => { if (await confirm('Voulez-vous vraiment vous déconnecter ?', { confirmLabel: 'Se déconnecter', danger: false })) signOut(); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffb4a8', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', padding: '9px 14px', flexShrink: 0 }}
          >
            Se déconnecter
          </button>
        </div>

        {schools && <OverviewStats schools={schools} onStatClick={(statut) => { setTab('ecoles'); }} />}

        {/* Tabs avec compteurs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {TABS.map((t) => {
            let count = null;
            if (t.id === 'ecoles' && schools) count = schools.length;
            if (t.id === 'admins') count = tabCounts.admins;
            if (t.id === 'school-invites') count = tabCounts.invites;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1px solid ${isActive ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`,
                  background: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
                  color: isActive ? 'var(--forest-dark)' : 'rgba(255,255,255,0.85)',
                }}
              >
                {t.label}
                {count !== null && count !== undefined && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                    background: isActive ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)',
                    color: isActive ? 'var(--forest-dark)' : 'rgba(255,255,255,0.75)',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}

        {tab === 'ecoles' && <EcolesTab schools={schools} reload={reloadSchools} />}
        {tab === 'admins' && <AdminsTab onChanged={() => {
          callPlatformAdmin({ action: 'list_admins' }).then(({ data }) => {
            if (data?.admins) setTabCounts((prev) => ({ ...prev, admins: data.admins.length }));
          });
        }} />}
        {tab === 'school-invites' && <SchoolInvitesTab onChanged={() => {
          supabase.from('school_signup_invites').select('id', { count: 'exact', head: true }).is('used_at', null)
            .then(({ count }) => setTabCounts((prev) => ({ ...prev, invites: count || 0 })));
        }} />}
        {tab === 'journal' && <JournalTab />}
      </div>
    </div>
  );
}

async function copyWithToast(text, showToast) {
  if (await copyText(text)) showToast('Copié');
  else showToast('Copie impossible, sélectionne le texte à la main', 'error');
}

function OverviewStats({ schools, onStatClick }) {
  const actives = schools.filter((s) => s.statut === 'actif' || s.statut === 'essai').length;
  const suspendues = schools.filter((s) => s.statut === 'suspendu' || s.statut === 'resilie').length;
  const totalEleves = schools.reduce((a, s) => a + (s.studentCount || 0), 0);
  const totalPersonnel = schools.reduce((a, s) => a + (s.staffCount || 0), 0);
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const nouvellesCeMois = schools.filter((s) => new Date(s.created_at) >= debutMois).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }} className="desktop-grid-4">
      <StatCard
        icon={<BuildingIcon />}
        accent="var(--gold)"
        label="Écoles actives"
        value={actives}
        sub={suspendues > 0 ? `${suspendues} suspendue${suspendues > 1 ? 's' : ''} ou résiliée${suspendues > 1 ? 's' : ''}` : 'Tout va bien'}
        onClick={() => onStatClick('actif')}
      />
      <StatCard
        icon={<UsersIcon />}
        accent="#3DDC97"
        label="Élèves (toutes écoles)"
        value={totalEleves}
      />
      <StatCard
        icon={<IdIcon />}
        accent="#EBCB82"
        label="Comptes personnel"
        value={totalPersonnel}
      />
      <StatCard
        icon={<TrendIcon />}
        accent="#7FE0B0"
        label="Nouvelles écoles ce mois"
        value={nouvellesCeMois}
        sub={nouvellesCeMois > 0 ? `+${nouvellesCeMois} ce mois-ci` : 'Aucune ce mois'}
      />
    </div>
  );
}

function StatCard({ icon, accent, label, value, sub, onClick }) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
      onMouseLeave={(e) => { if (isClickable) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ color: accent, display: 'flex' }}>{icon}</div>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, color: '#fff' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{sub}</p>}
    </div>
  );
}

const SORTS = [
  { id: 'recent', label: 'Plus récentes' },
  { id: 'nom', label: 'Nom (A→Z)' },
  { id: 'effectif', label: 'Effectif (élèves)' },
];

const STATUT_FILTERS = [
  { id: 'tous', label: 'Toutes' },
  { id: 'actif', label: 'Actives' },
  { id: 'essai', label: 'En essai' },
  { id: 'suspendu', label: 'Suspendues' },
  { id: 'resilie', label: 'Résiliées' },
];

function EcolesTab({ schools, reload }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [detailId, setDetailId] = useState(null);
  const [busyRowId, setBusyRowId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [rowError, setRowError] = useState('');

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

  const counts = useMemo(() => {
    if (!schools) return {};
    const c = { tous: schools.length, actif: 0, essai: 0, suspendu: 0, resilie: 0 };
    schools.forEach((s) => { if (c[s.statut] !== undefined) c[s.statut]++; });
    return c;
  }, [schools]);

  const filtered = useMemo(() => {
    if (!schools) return [];
    const term = search.trim().toLowerCase();
    let list = schools;
    if (filterStatut !== 'tous') list = list.filter((s) => s.statut === filterStatut);
    if (term) list = list.filter((s) => s.name.toLowerCase().includes(term));
    list = [...list];
    if (sort === 'nom') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'effectif') list.sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [schools, search, sort, filterStatut]);

  if (!schools) return <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}><SkeletonRow count={6} avatar={false} /></div>;

  const detailSchool = schools.find((s) => s.id === detailId) || null;

  return (
    <div>
      {/* Filtres par statut */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUT_FILTERS.map((f) => {
          const isActive = filterStatut === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilterStatut(f.id)}
              style={{
                padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isActive ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`,
                background: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                color: isActive ? 'var(--forest-dark)' : 'rgba(255,255,255,0.85)',
              }}
            >
              {f.label}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.id] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* Recherche + tri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '2 1 220px' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une école…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        <Dropdown
          value={sort}
          onChange={setSort}
          options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
          textColor="#fff"
          chevronColor="rgba(255,255,255,0.75)"
          style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', fontSize: 13 }}
          wrapperStyle={{ flex: '1 1 160px', width: 'auto' }}
        />
      </div>

      {rowError && <p style={{ color: '#ffb4a8', marginBottom: 10, fontWeight: 600, fontSize: 12.5 }}>{rowError}</p>}

      {filtered.length === 0 && (
        <EmptySchoolsState
          hasFilter={filterStatut !== 'tous' || search.trim() !== ''}
          onReset={() => { setFilterStatut('tous'); setSearch(''); }}
        />
      )}

      {filtered.length > 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((s, i) => {
            const st = STATUT_LABELS[s.statut] || STATUT_LABELS.actif;
            const canDelete = s.statut === 'suspendu' || s.statut === 'resilie';
            const isActive = s.statut !== 'suspendu';
            const busy = busyRowId === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--line)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8F4'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 13, color: 'var(--forest-dark)', flexShrink: 0 }}>
                  {(s.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG'}
                </div>
                <div onClick={() => setDetailId(s.id)} style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}>
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
                  <button
                    type="button"
                    onClick={() => setDetailId(s.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none', background: 'rgba(15,76,58,0.08)', color: 'var(--forest)', cursor: 'pointer' }}
                    title="Voir le détail"
                  >
                    <ChevronIcon />
                  </button>
                  {confirmingDeleteId === s.id ? (
                    <>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)} title="Annuler" style={iconBtnStyle('var(--muted)')}>
                        <i className="ti ti-x" aria-hidden="true"></i>
                      </button>
                      <button type="button" onClick={() => handleQuickDelete(s)} disabled={busy} title="Confirmer" style={iconBtnStyle('var(--danger)')}>
                        <i className="ti ti-check" aria-hidden="true"></i>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (canDelete ? setConfirmingDeleteId(s.id) : null)}
                      disabled={!canDelete || busy}
                      title={canDelete ? 'Supprimer définitivement' : "Suspends d'abord cette école."}
                      style={{ ...iconBtnStyle(canDelete ? 'var(--danger)' : 'var(--line-strong)'), cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.4 }}
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
        <SchoolDetailModal school={detailSchool} onClose={() => setDetailId(null)} onChanged={() => { reload(); }} />
      )}
    </div>
  );
}

function EmptySchoolsState({ hasFilter, onReset }) {
  return (
    <div style={{ background: 'var(--paper)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--forest-light)', color: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <BuildingIcon />
      </div>
      <p style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
        {hasFilter ? 'Aucune école ne correspond' : 'Aucune école pour l\'instant'}
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
        {hasFilter ? 'Essaie un autre mot-clé ou change de filtre.' : 'Les écoles apparaîtront ici dès qu\'elles seront créées.'}
      </p>
      {hasFilter && (
        <button
          type="button"
          onClick={onReset}
          style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Effacer les filtres
        </button>
      )}
    </div>
  );
}

function SchoolDetailModal({ school, onClose, onChanged }) {
  const showToast = useToast();
  const [tab, setTab] = useState('infos');
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

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 20px', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 620, width: '100%', padding: 26 }}>
        {/* En-tête modal */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 14, color: 'var(--forest-dark)' }}>
              {(school.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG'}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</p>
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Sous-onglets */}
        <div style={{ display: 'flex', gap: 6, marginTop: 18, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
          {[
            { id: 'infos', label: 'Infos & actions' },
            { id: 'personnel', label: 'Personnel' },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  color: active ? 'var(--forest)' : 'var(--muted)',
                  borderBottom: `2px solid ${active ? 'var(--forest)' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
                {t.id === 'personnel' && staff && (
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'var(--forest-light)', color: 'var(--forest)' }}>{staff.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        {tab === 'infos' && (
          <>
            {/* Cartes infos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--forest-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Élèves</p>
                <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--forest-dark)' }}>{school.studentCount}</p>
              </div>
              <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--forest-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Comptes personnel</p>
                <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--forest-dark)' }}>{school.staffCount}</p>
              </div>
            </div>

            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Créée le</p>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, fontWeight: 600 }}>{new Date(school.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

            {/* Note admin */}
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

            {/* Actions */}
            <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          </>
        )}

        {tab === 'personnel' && (
          <>
            {!staff && <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}><SkeletonRow count={2} avatar={false} /></div>}
            {staff && staff.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun compte personnel dans cette école.</p>}
            {staff && staff.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {staff.map((p, i) => (
                  <div key={p.id} style={{ padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
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
              <div className="card-bold" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
                  {link.action === 'impersonate' ? 'Lien de connexion à usage unique' : 'Lien de réinitialisation de mot de passe'} — ne le partage qu'avec la personne concernée.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ flex: '1 1 220px', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 11.5, color: 'var(--ink)' }} />
                  <button
                    type="button"
                    onClick={() => copyWithToast(link.url, showToast)}
                    style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '7px 12px' }}
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function btnStyle(borderColor) {
  return { padding: '8px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: 'none', color: borderColor, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' };
}

function iconBtnStyle(color) {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none', background: 'none', color, fontSize: 16, cursor: 'pointer' };
}

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
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: active ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }} />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function SchoolInvitesTab({ onChanged }) {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
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
    const { error: insertError } = await supabase.from('school_signup_invites').insert({ code, created_by: profile?.id });
    setCreating(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ code });
    await reload();
    onChanged?.();
  }

  async function handleRevoke(invite) {
    if (!(await confirm('Révoquer ce code ? Il ne pourra plus créer de compte.', { confirmLabel: 'Révoquer' }))) return;
    setRevokingId(invite.id);
    setError('');
    const { error: deleteError } = await supabase.from('school_signup_invites').delete().eq('id', invite.id).is('used_at', null);
    setRevokingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    await reload();
    onChanged?.();
  }

  return (
    <div>
      {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Invitations pour créer une école</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Chaque code est individuel, utilisable une seule fois et valable 7 jours. Communique-le directement à la personne invitée.
      </p>
      {newInvite && (
        <div style={{ padding: '14px 16px', background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>Code à transmettre à la personne invitée</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button type="button" onClick={() => copyWithToast(newInvite.code, showToast)} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '6px 11px' }}>Copier</button>
          </div>
        </div>
      )}
      <form onSubmit={handleCreate} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, marginBottom: 18 }}>
        <button type="submit" disabled={creating} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Génération…' : 'Générer un code individuel'}
        </button>
      </form>
      {!invites && <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={3} avatar={false} /></div>}
      {invites?.length === 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Aucun code pour l'instant</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Génère un code pour inviter une nouvelle école à s'inscrire.</p>
        </div>
      )}
      {invites && invites.length > 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
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

function AdminsTab({ onChanged }) {
  const showToast = useToast();
  const confirm = useConfirm();
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
    onChanged?.();
  }

  async function handleRemove(a) {
    if (!(await confirm(`Retirer ${a.email || a.user_id} des administrateurs de la plateforme ?`, { confirmLabel: 'Retirer' }))) return;
    setRemovingId(a.user_id);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'remove_admin', userId: a.user_id });
    setRemovingId(null);
    if (err) { setError(err); return; }
    reload();
    onChanged?.();
  }

  async function handleCreateInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setCreatingInvite(true);
    setError('');
    setNewInvite(null);
    const code = generateAccessCode();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const { error: insertError } = await supabase.from('platform_admin_invites').insert({ email: cleanEmail, code, created_by: profile?.id });
    setCreatingInvite(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ email: cleanEmail, code });
    setInviteEmail('');
    reloadInvites();
  }

  async function handleRevoke(invite) {
    if (!(await confirm(`Révoquer l'invitation pour ${invite.email} ?`, { confirmLabel: 'Révoquer' }))) return;
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
      {!admins && <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={3} avatar={false} /></div>}
      {admins && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
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
        Génère un code à usage unique, à communiquer toi-même à la personne. Elle crée son compte
        sur l'écran "Créer un compte administrateur" avec ce code.
      </p>

      {newInvite && (
        <div style={{ padding: '14px 16px', background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
            Code pour {newInvite.email} — à communiquer, ne le laisse pas affiché à l'écran.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button type="button" onClick={() => copyWithToast(newInvite.code, showToast)} style={{ ...btnStyle('var(--forest)'), background: 'var(--forest)', color: '#fff', fontSize: 11.5, padding: '6px 11px' }}>Copier</button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateInvite} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
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
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
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
                <button type="button" onClick={() => handleRevoke(inv)} disabled={revokingId === inv.id} style={{ ...btnStyle('var(--danger)'), fontSize: 12 }}>Révoquer</button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Promouvoir un compte existant</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Pour donner le statut d'administrateur à un compte qui a déjà un profil d'école (ex. un fondateur) — sans passer par une invitation.
      </p>
      <form onSubmit={handleAdd} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
  if (!actions) return <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={5} avatar={false} /></div>;

  return (
    <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
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
      {actions.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Aucune action enregistrée pour l'instant.</p>}
    </div>
  );
}
