import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { generateAccessCode, copyText, downloadCsv } from '../lib/utils.js';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import ModalContainer from '../components/ModalContainer.jsx';

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

const PLAN_LABELS = {
  decouverte: { label: 'Découverte', bg: '#F0EDE5', fg: '#5C6E65' },
  essentiel: { label: 'Essentiel', bg: '#E4EEE9', fg: '#0F4C3A' },
  standard: { label: 'Standard', bg: '#FBF1DD', fg: '#A5680E' },
  premium: { label: 'Premium', bg: '#F0E4FA', fg: '#6B2E9E' },
};

const PLAN_OPTIONS = [
  { value: 'decouverte', label: 'Découverte — Gratuit (60 élèves)' },
  { value: 'essentiel', label: 'Essentiel — 80 000 F/an (200 élèves)' },
  { value: 'standard', label: 'Standard — 150 000 F/an (500 élèves)' },
  { value: 'premium', label: 'Premium — 250 000 F/an (illimité)' },
];

const ROLE_LABELS = { fondateur: 'Fondateur', directeur: 'Directeur', secretaire: 'Secrétaire', enseignant: 'Enseignant' };

const ACTION_LABELS = {
  set_statut: 'Changement de statut',
  set_plan: 'Changement de plan',
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

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l9 16H3L12 3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

const TABS = [
  { id: 'ecoles', label: 'Écoles' },
  { id: 'admins', label: 'Administrateurs' },
  { id: 'school-invites', label: 'Codes écoles' },
  { id: 'journal', label: "Journal d'activité" },
];

function healthIssues(school) {
  const issues = [];
  const now = Date.now();
  const created = new Date(school.created_at).getTime();
  const ageDays = Math.floor((now - created) / 86400000);

  if ((school.studentCount || 0) === 0) {
    issues.push({ key: 'no_students', label: 'Aucun élève', severity: 'high' });
  }
  if ((school.staffCount || 0) <= 1) {
    issues.push({ key: 'solo_team', label: 'Équipe incomplète', severity: 'medium' });
  }
  if (school.statut === 'essai' && ageDays > 30) {
    issues.push({ key: 'trial_stale', label: 'Essai stagnant', severity: 'medium' });
  }
  if ((school.statut === 'suspendu' || school.statut === 'resilie')) {
    issues.push({ key: 'inactive', label: school.statut === 'suspendu' ? 'Suspendue' : 'Résiliée', severity: 'low' });
  }
  return issues;
}

function isSchoolHealthy(school) {
  return healthIssues(school).length === 0;
}

export default function PlatformAdmin() {
  const { signOut, profile } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState('ecoles');
  const [schools, setSchools] = useState(null);
  const [tabCounts, setTabCounts] = useState({ admins: null, invites: null });
  const [error, setError] = useState('');
  const [focusSchoolId, setFocusSchoolId] = useState(null);

  useEffect(() => {
    const styleId = 'admin-scroll-fix';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        html, body, #root {
          overflow: auto !important;
          height: auto !important;
          position: static !important;
        }
        @media (max-width: 640px) {
          .admin-school-row {
            flex-wrap: wrap !important;
            align-items: flex-start !important;
          }
          .admin-school-content {
            flex: 1 1 calc(100% - 80px) !important;
            margin-top: 4px !important;
          }
          .admin-school-actions {
            flex: 1 1 100% !important;
            justify-content: flex-end !important;
            padding-top: 12px !important;
            margin-top: 6px !important;
            border-top: 1px dashed rgba(0,0,0,0.1) !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  async function reloadSchools() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'list' });
    if (err) { setError(err); return; }
    setSchools(data.schools);
  }

  useEffect(() => { reloadSchools(); }, []);

  useEffect(() => {
    callPlatformAdmin({ action: 'list_admins' }).then(({ data }) => {
      if (data?.admins) setTabCounts((prev) => ({ ...prev, admins: data.admins.length }));
    });
    supabase.from('school_signup_invites').select('id', { count: 'exact', head: true }).is('used_at', null)
      .then(({ count }) => setTabCounts((prev) => ({ ...prev, invites: count || 0 })));
  }, []);

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  function handleSelectSchool(schoolId) {
    setTab('ecoles');
    setFocusSchoolId(schoolId);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--forest-dark)', padding: '28px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18, color: 'var(--forest-dark)' }}>EG</div>
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

        <GlobalSearchBar onSelectSchool={handleSelectSchool} />

        {schools && <OverviewStats schools={schools} onStatClick={() => setTab('ecoles')} />}

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
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: isActive ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)', color: isActive ? 'var(--forest-dark)' : 'rgba(255,255,255,0.75)' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}

        {tab === 'ecoles' && (
          <EcolesTab
            schools={schools}
            reload={reloadSchools}
            focusSchoolId={focusSchoolId}
            onClearFocus={() => setFocusSchoolId(null)}
          />
        )}
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

function GlobalSearchBar({ onSelectSchool }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error: err } = await callPlatformAdmin({ action: 'search_users', query: query.trim() });
      setLoading(false);
      if (!err) setResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hasResults = results && ((results.schools?.length || 0) + (results.staff?.length || 0) + (results.parents?.length || 0) > 0);
  const showPanel = open && query.trim().length >= 2;

  function handleSelect(id) {
    onSelectSchool(id);
    setOpen(false);
    setQuery('');
    setResults(null);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 20 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un utilisateur, une école, un e-mail, un téléphone…"
          style={{
            width: '100%',
            padding: '11px 40px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 13.5,
            boxSizing: 'border-box',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults(null); setOpen(false); }}
            aria-label="Effacer la recherche"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
          >×</button>
        )}
      </div>

      {showPanel && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--paper)',
          borderRadius: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 20,
        }}>
          {loading && <p style={{ padding: 16, margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Recherche…</p>}
          {!loading && !hasResults && (
            <p style={{ padding: 16, margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Aucun résultat pour « {query} ».</p>
          )}
          {!loading && hasResults && (
            <>
              {results.schools?.length > 0 && (
                <div>
                  <p style={{ margin: 0, padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Écoles</p>
                  {results.schools.map((s) => (
                    <button key={s.id} type="button" onClick={() => handleSelect(s.id)} style={searchItemStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      {s.statut && (
                        <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                          {STATUT_LABELS[s.statut]?.label || s.statut}
                          {s.plan && ` · ${PLAN_LABELS[s.plan]?.label || s.plan}`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {results.staff?.length > 0 && (
                <div>
                  <p style={{ margin: 0, padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personnel</p>
                  {results.staff.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleSelect(p.school_id)} style={searchItemStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11.5 }}>· {ROLE_LABELS[p.role] || p.role}</span></div>
                      <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{p.email || p.phone || '—'} · {p.schools?.name}</div>
                    </button>
                  ))}
                </div>
              )}
              {results.parents?.length > 0 && (
                <div>
                  <p style={{ margin: 0, padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parents</p>
                  {results.parents.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleSelect(p.school_id)} style={searchItemStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{p.phone || '—'} · Code {p.code} · {p.schools?.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const searchItemStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var
