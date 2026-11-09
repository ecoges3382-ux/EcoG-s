import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import Dropdown from '../components/Dropdown.jsx';
import UpdateButton from '../components/UpdateButton.jsx';

// Sous-composants
import { 
  callPlatformAdmin, 
  BuildingIcon, 
  UsersIcon, 
  IdIcon, 
  TrendIcon, 
  AlertIcon, 
  StatCard,
  SearchIcon
} from '../components/platform-admin/PlatformAdminUI.jsx';
import EcolesTab from '../components/platform-admin/EcolesTab.jsx';
import AdminsTab from '../components/platform-admin/AdminsTab.jsx';
import SchoolInvitesTab from '../components/platform-admin/SchoolInvitesTab.jsx';
import JournalTab from '../components/platform-admin/JournalTab.jsx';

const TABS = [
  { id: 'ecoles', label: 'Écoles' },
  { id: 'admins', label: 'Administrateurs' },
  { id: 'school-invites', label: 'Codes écoles' },
  { id: 'journal', label: "Journal d'activité" },
];

function OverviewStats({ schools, onStatClick }) {
  const actives = schools.filter((s) => s.statut === 'actif' || s.statut === 'essai').length;
  const suspendues = schools.filter((s) => s.statut === 'suspendu' || s.statut === 'resilie').length;
  const totalEleves = schools.reduce((a, s) => a + (s.studentCount || 0), 0);
  const totalPersonnel = schools.reduce((a, s) => a + (s.staffCount || 0), 0);
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const nouvellesCeMois = schools.filter((s) => new Date(s.created_at) >= debutMois).length;
  
  const aSurveiller = schools.filter((s) => s.statut !== 'resilie' && (s.studentCount === 0 || s.staffCount <= 1 || (s.statut === 'essai' && (Date.now() - new Date(s.created_at).getTime()) / 86400000 > 30))).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 22 }} className="desktop-grid-4">
      <StatCard icon={<BuildingIcon />} accent="var(--gold)" label="Écoles actives" value={actives} sub={suspendues > 0 ? `${suspendues} suspendue${suspendues > 1 ? 's' : ''} ou résiliée${suspendues > 1 ? 's' : ''}` : 'Tout va bien'} onClick={onStatClick} />
      <StatCard icon={<UsersIcon />} accent="#3DDC97" label="Élèves (toutes écoles)" value={totalEleves} />
      <StatCard icon={<IdIcon />} accent="#EBCB82" label="Comptes personnel" value={totalPersonnel} />
      <StatCard icon={<TrendIcon />} accent="#7FE0B0" label="Nouvelles écoles ce mois" value={nouvellesCeMois} sub={nouvellesCeMois > 0 ? `+${nouvellesCeMois} ce mois-ci` : 'Aucune ce mois'} />
      <StatCard icon={<AlertIcon />} accent="#FCA5A5" label="À surveiller" value={aSurveiller} sub={aSurveiller > 0 ? 'Écoles qui ont besoin d\'attention' : 'Tout est sain'} highlight={aSurveiller > 0} onClick={onStatClick} />
    </div>
  );
}

function GlobalSearchBar({ onSelectSchool }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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

  const hasResults = results && ((results.schools?.length || 0) + (results.staff?.length || 0) + (results.parents?.length || 0) > 0);

  function handleSelect(id) {
    onSelectSchool(id);
    setOpen(false);
    setQuery('');
    setResults(null);
  }

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un utilisateur, une école, un e-mail, un téléphone…"
          style={{ width: '100%', padding: '11px 40px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13.5, boxSizing: 'border-box' }}
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--paper)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: 400, overflowY: 'auto', zIndex: 20 }}>
          {loading && <p style={{ padding: 16, margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Recherche…</p>}
          {!loading && !hasResults && <p style={{ padding: 16, margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Aucun résultat pour « {query} ».</p>}
          {!loading && hasResults && (
            <>
              {results.schools?.length > 0 && (
                <div>
                  <p style={{ margin: 0, padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Écoles</p>
                  {results.schools.map((s) => (
                    <button key={s.id} type="button" onClick={() => handleSelect(s.id)} style={searchItemStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    </button>
                  ))}
                </div>
              )}
              {results.staff?.length > 0 && (
                <div>
                  <p style={{ margin: 0, padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personnel</p>
                  {results.staff.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleSelect(p.school_id)} style={searchItemStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{p.email || p.phone || '—'} · {p.schools?.name}</div>
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

const searchItemStyle = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink)', borderBottom: '1px solid var(--line)' };

export default function PlatformAdmin() {
  const { signOut, profile } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState('ecoles');
  const [schools, setSchools] = useState(null);
  const [tabCounts, setTabCounts] = useState({ admins: null, invites: null });
  const [error, setError] = useState('');
  const [focusSchoolId, setFocusSchoolId] = useState(null);

  // 👇 LA SOLUTION EST ICI : On force le navigateur à réactiver le défilement 👇
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
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

  return (
    // 👇 J'ai retiré height: 100vh et overflowY. On laisse le navigateur gérer. 👇
    <div style={{ minHeight: '100vh', background: 'var(--forest-dark)', padding: '28px 20px', boxSizing: 'border-box' }}>
      
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

        <GlobalSearchBar onSelectSchool={(id) => { setTab('ecoles'); setFocusSchoolId(id); }} />

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
        
        <div style={{ marginTop: 40, paddingBottom: 40, display: 'flex', justifyContent: 'center' }}>
          <UpdateButton />
        </div>

      </div>
    </div>
  );
}
