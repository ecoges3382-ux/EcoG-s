import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';
import { applySchoolColor, resetSchoolColor, getInitialTheme, applyTheme, toggleTheme } from '../lib/theme.js';
import { SchoolYearProvider, useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import SchoolYearSelector from '../components/SchoolYearSelector.jsx';
import { SkeletonScreen } from '../components/Skeleton.jsx';
import { supabase } from '../lib/supabase.js';
import { hasFeature } from '../lib/plan.js';
import GlobalSearch from '../components/GlobalSearch.jsx';
import UpdateButton from '../components/UpdateButton.jsx';

const SIDEBAR_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: 'ti-layout-dashboard', perm: 'dashboard', end: true },
  { to: '/chat', label: 'Messagerie', icon: 'ti-message-circle', perm: null },
  { to: '/argent', label: 'Argent', icon: 'ti-wallet', perm: 'finance' },
  { to: '/recouvrement', label: 'Recouvrement', icon: 'ti-report-money', perm: 'finance', tourId: 'sidebar-recouvrement' },
  { to: '/eleves', label: 'Élèves', icon: 'ti-users', perm: 'eleves', countKey: 'students', tourId: 'sidebar-eleves' },
  { to: '/parents', label: 'Parents', icon: 'ti-users-group', perm: 'parents', countKey: 'parents', feature: 'parent_portal' },
  { to: '/personnel', label: 'Personnel', icon: 'ti-id-badge-2', perm: 'personnel', countKey: 'staff', feature: 'personnel' },
  { to: '/classes', label: 'Classes', icon: 'ti-building', perm: 'classes', countKey: 'classes' },
  { to: '/matieres', label: 'Matières', icon: 'ti-book-2', perm: 'matieres', countKey: 'subjects' },
  { to: '/notes', label: 'Notes', icon: 'ti-pencil', perm: 'notes' },
  { to: '/bulletins', label: 'Bulletins', icon: 'ti-certificate', perm: 'bulletins' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'ti-calendar-time', perm: 'emploi_du_temps', feature: 'emploi_du_temps' },
  { to: '/presences', label: 'Présences', icon: 'ti-clipboard-check', perm: 'presences' },
  { to: '/annonces', label: 'Annonces', icon: 'ti-speakerphone', perm: 'annonces' },
  { to: '/documents', label: 'Documents', icon: 'ti-file', perm: 'documents', feature: 'documents' },
  { to: '/rapports', label: 'Rapports', icon: 'ti-chart-bar', perm: 'rapports', feature: 'rapports_avances' },
  { to: '/parametres', label: 'Paramètres', icon: 'ti-settings', perm: 'parametres', tourId: 'sidebar-parametres' },
];

const SCHOOL_GROUP_PATHS = ['/eleves', '/parents', '/personnel', '/classes', '/matieres', '/notes', '/bulletins', '/emploi-du-temps', '/presences', '/annonces', '/documents', '/rapports'];

const BOTTOM_NAV_ITEMS = [
  { to: '/', shortLabel: 'Accueil', icon: 'ti-layout-dashboard', perm: 'dashboard', end: true },
  { to: '/argent', shortLabel: 'Argent', icon: 'ti-wallet', perm: 'finance' },
  { to: '/recouvrement', shortLabel: 'Recouvr.', icon: 'ti-report-money', perm: 'finance', tourId: 'bottomnav-recouvrement' },
  { to: '/chat', shortLabel: 'Chat', icon: 'ti-message-circle', perm: null },
  { to: '/eleves', shortLabel: 'École', icon: 'ti-building-bank', perm: 'eleves', group: SCHOOL_GROUP_PATHS, tourId: 'bottomnav-eleves' },
  { to: '/parametres', shortLabel: 'Paramètres', icon: 'ti-settings', perm: 'parametres', tourId: 'bottomnav-parametres' },
];

const NO_YEAR_ALLOWED_PATHS = ['/parametres', '/premiers-pas', '/comptes', '/aide', '/chat'];

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 3l8 3v6c0 4.5 -3 7.5 -8 9c-5 -1.5 -8 -4.5 -8 -9v-6l8 -3z" /><path d="M12 11m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" /><path d="M12 12.5v2.5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.75.35-1.25 1.1-1.25 2.2" /><path d="M12 17.5v.01" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function sidebarLinkStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px',
    borderRadius: 10, cursor: 'pointer', marginBottom: 2, textDecoration: 'none',
    background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
    color: '#fff',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.15s ease',
  };
}

function SchoolYearGuard({ children }) {
  const location = useLocation();
  const { activeYear, loading, refresh } = useSelectedSchoolYear();
  const [retrying, setRetrying] = useState(false);

  const isAllowed = NO_YEAR_ALLOWED_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );
  if (isAllowed) return children;

  if (loading) return <SkeletonScreen minHeight="60vh" />;

  if (!activeYear) {
    const handleRetry = async () => {
      setRetrying(true);
      try { await refresh(); } finally { setRetrying(false); }
    };
    return (
      <div style={{ maxWidth: 520, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <i className="ti ti-calendar-off" style={{ fontSize: 34, color: 'var(--amber)' }}></i>
        </div>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
          Aucune année scolaire active
        </p>
        <p style={{ margin: '10px 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          Cette école n'a pas d'année scolaire en cours. Le fondateur ou le directeur doit en créer une depuis les paramètres.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.6 : 1 }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 14, marginRight: 6 }}></i>
            {retrying ? 'Vérification…' : 'Réessayer'}
          </button>
          <Link
            to="/parametres/annee-scolaire"
            style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}
          >
            Gérer les années
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

export default function Shell() {
  const { profile, signOut, isPlatformAdmin } = useAuth();
  const confirm = useConfirm();
  const location = useLocation();
  const schoolName = profile?.schools?.name || 'EcoGès';
  const roleLabel = ROLES[profile?.role]?.label || profile?.role || '';
  const plan = profile?.schools?.plan || 'decouverte';
  
  const [searchOpen, setSearchOpen] = useState(false);
  
  // 👇 INITIALISATION DU THÈME AVEC L'ID UTILISATEUR 👇
  const [theme, setTheme] = useState(() => getInitialTheme(profile?.id));

  // 👇 ON RE-CHARGE LE THÈME SI L'UTILISATEUR CHANGE 👇
  useEffect(() => {
    if (profile?.id) {
      const userTheme = getInitialTheme(profile.id);
      setTheme(userTheme);
    }
  }, [profile?.id]);

  // 👇 APPLICATION DU THÈME 👇
  useEffect(() => {
    if (profile?.id) {
      applyTheme(theme, profile.id);
    }
  }, [theme, profile?.id]);

  const handleToggleTheme = () => {
    if (profile?.id) {
      const next = toggleTheme(profile.id);
      setTheme(next);
    }
  };

  const hasAccess = (perm) => {
    if (!perm) return true;
    if (profile?.role === 'fondateur') return true;
    return profile?.permissions?.[perm] === true;
  };

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    document.body.classList.add('app-mode');
    return () => document.body.classList.remove('app-mode');
  }, []);

  useEffect(() => {
    applySchoolColor(profile?.schools?.color);
    return () => resetSchoolColor();
  }, [profile?.schools?.color]);

  const handleLogout = async () => {
    if (await confirm('Voulez-vous vraiment vous déconnecter ?', { confirmLabel: 'Se déconnecter', danger: false })) signOut();
  };

  return (
    <SchoolYearProvider schoolId={profile?.school_id}>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <div id="app">
        <div className="topbar-row">
          <div className="topbar-inner">
            
            <div className="topbar-brand">
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 15, color: 'var(--forest-dark)', flexShrink: 0, overflow: 'hidden' }}>
                {profile?.schools?.logo_url
                  ? <img src={profile.schools.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (schoolName.split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG')}
              </div>
              <p className="topbar-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {schoolName}
              </p>
            </div>

            <div className="topbar-right">
              
              <div className="topbar-pc-tools hide-on-mobile">
                <button onClick={() => setSearchOpen(true)} className="topbar-search-btn">
                  <i className="ti ti-search" style={{ fontSize: 16 }} aria-hidden="true"></i>
                  <span>Rechercher...</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <kbd style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>Ctrl</kbd>
                    <kbd style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>K</kbd>
                  </div>
                </button>
                
                <button onClick={handleToggleTheme} className="topbar-action-btn" title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>

                <Link to="/aide" title="Centre d'aide" className="topbar-action-btn">
                  <HelpIcon />
                </Link>
              </div>

              <div className="topbar-context">
                <SchoolYearSelector />
                
                {isPlatformAdmin && (
                  <NavLink to="/admin" className="topbar-admin-badge">
                    <ShieldIcon />
                    <span className="hide-on-mobile">Administration</span>
                    <span className="show-on-mobile">Admin</span>
                  </NavLink>
                )}

                <div className="topbar-role-badge">
                  <i className="ti ti-user-circle" style={{ fontSize: 17, color: '#fff' }} aria-hidden="true"></i>
                  <span>{roleLabel}</span>
                </div>
              </div>

              <button onClick={handleLogout} className="topbar-action-btn hide-on-mobile" title="Se déconnecter">
                <span aria-hidden="true" style={{ fontSize: 16, fontWeight: 700 }}>⏻</span>
              </button>
            </div>
          </div>

          <div className="topbar-mobile-row show-on-mobile">
            <button onClick={() => setSearchOpen(true)} className="topbar-mobile-search">
              <i className="ti ti-search" style={{ fontSize: 18 }} aria-hidden="true"></i>
              <span>Rechercher un élève, une classe...</span>
            </button>

            <div className="topbar-mobile-icons">
              <button onClick={handleToggleTheme} className="topbar-action-btn" title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>

              <Link to="/aide" title="Centre d'aide" className="topbar-action-btn">
                <HelpIcon />
              </Link>

              <button onClick={handleLogout} className="topbar-action-btn" title="Se déconnecter">
                <span aria-hidden="true" style={{ fontSize: 16, fontWeight: 700 }}>⏻</span>
              </button>
            </div>
          </div>
        </div>

        <div id="layout">
          <div id="sidebar" data-tour="sidebar">
            <SidebarMenu plan={plan} hasAccess={hasAccess} />
          </div>
          <div id="screen">
            <div key={location.pathname} className="page-transition" style={{ paddingBottom: '48px' }}>
              <SchoolYearGuard>
                <Suspense fallback={<SkeletonScreen minHeight="60vh" />}>
                  <Outlet />
                </Suspense>
              </SchoolYearGuard>
            </div>
          </div>
        </div>

        <div id="bottomnav">
          {BOTTOM_NAV_ITEMS.map((item) => {
            if (!hasAccess(item.perm)) return null;
            const isActive = item.group
              ? item.group.some((p) => location.pathname.startsWith(p))
              : (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
            return (
              <NavLink key={item.to} to={item.to} className={`navlink${isActive ? ' active' : ''}`} data-tour={item.tourId}>
                <i className={`ti ${item.icon}`} aria-hidden="true"></i>
                <span>{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </div>

        <UpdateButton />
        
      </div>
    </SchoolYearProvider>
  );
}

function SidebarMenu({ plan, hasAccess }) {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile?.school_id);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;

    async function loadCounts() {
      const [
        { count: cStudents },
        { count: cParents },
        { count: cStaff },
        { count: cClasses },
        { count: cSubjects }
      ] = await Promise.all([
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('school_year_id', schoolYear.id),
        supabase.from('parent_access').select('id', { count: 'exact', head: true }),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true })
      ]);

      if (!cancelled) {
        setCounts({
          students: cStudents || 0,
          parents: cParents || 0,
          staff: cStaff || 0,
          classes: cClasses || 0,
          subjects: cSubjects || 0,
        });
      }
    }

    loadCounts();
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.feature && !hasFeature(plan, item.feature)) return false;
    if (!hasAccess(item.perm)) return false;
    return true;
  });

  return (
    <>
      {visibleItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="navlink" style={({ isActive }) => sidebarLinkStyle(isActive)} data-tour={item.tourId}>
          <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: '#fff' }} aria-hidden="true"></i>
          <span className="sidebar-label" style={{ flex: 1 }}>{item.label}</span>
          {item.countKey && counts[item.countKey] !== undefined && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 10 }}>
              {counts[item.countKey]}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );
}
