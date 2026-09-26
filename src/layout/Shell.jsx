import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES, supportWhatsappLink } from '../lib/utils.js';
import { applySchoolColor, resetSchoolColor } from '../lib/theme.js';
import { SchoolYearProvider } from '../lib/schoolYear.jsx';
import SchoolYearSelector from '../components/SchoolYearSelector.jsx';

const SIDEBAR_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: 'ti-layout-dashboard', end: true },
  { to: '/argent', label: 'Argent', icon: 'ti-wallet' },
  { to: '/eleves', label: 'Élèves', icon: 'ti-users' },
  { to: '/parents', label: 'Parents', icon: 'ti-users-group' },
  { to: '/personnel', label: 'Personnel', icon: 'ti-id-badge-2' },
  { to: '/classes', label: 'Classes', icon: 'ti-building' },
  { to: '/matieres', label: 'Matières', icon: 'ti-book-2' },
  { to: '/notes', label: 'Notes', icon: 'ti-pencil' },
  { to: '/bulletins', label: 'Bulletins', icon: 'ti-certificate' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'ti-calendar-time' },
  { to: '/presences', label: 'Présences', icon: 'ti-clipboard-check' },
  { to: '/annonces', label: 'Annonces', icon: 'ti-speakerphone' },
  { to: '/documents', label: 'Documents', icon: 'ti-file' },
  { to: '/rapports', label: 'Rapports', icon: 'ti-chart-bar' },
  { to: '/parametres', label: 'Paramètres', icon: 'ti-settings' },
  { to: '/comptes', label: 'Comptes', icon: 'ti-users-group' },
];

const SCHOOL_GROUP_PATHS = ['/eleves', '/parents', '/personnel', '/classes', '/matieres', '/notes', '/bulletins', '/emploi-du-temps', '/presences', '/annonces', '/documents', '/rapports'];

const BOTTOM_NAV_ITEMS = [
  { to: '/', shortLabel: 'Accueil', icon: 'ti-layout-dashboard', end: true },
  { to: '/argent', shortLabel: 'Argent', icon: 'ti-wallet' },
  { to: '/eleves', shortLabel: 'École', icon: 'ti-building-bank', group: SCHOOL_GROUP_PATHS },
  { to: '/comptes', shortLabel: 'Comptes', icon: 'ti-users-group' },
  { to: '/parametres', shortLabel: 'Paramètres', icon: 'ti-settings' },
];

// Dessinée directement (plutôt qu'une classe de police d'icônes) pour être
// certaine de s'afficher, y compris sur mobile où seule l'icône reste
// visible (le texte "Administration" se cache sur petit écran).
function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 3l8 3v6c0 4.5 -3 7.5 -8 9c-5 -1.5 -8 -4.5 -8 -9v-6l8 -3z" />
      <path d="M12 11m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
      <path d="M12 12.5v2.5" />
    </svg>
  );
}

// Même raison que ShieldIcon ci-dessus : "ti-lifebuoy" ne s'affichait pas
// (bouton vide) — icône de police non fiable, alors qu'un tracé SVG
// s'affiche toujours.
function HelpIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.75.35-1.25 1.1-1.25 2.2" />
      <path d="M12 17.5v.01" />
    </svg>
  );
}

function sidebarLinkStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
    borderRadius: 10, cursor: 'pointer', marginBottom: 3, textDecoration: 'none',
    background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
  };
}

export default function Shell() {
  const { profile, signOut, isPlatformAdmin } = useAuth();
  const location = useLocation();
  const schoolName = profile?.schools?.name || 'EcoGès';
  const roleLabel = ROLES[profile?.role]?.label || profile?.role || '';

  // Fond sombre pour l'appli une fois connecté (cohérent avec la maquette
  // d'origine, qui bascule body.app-mode après connexion).
  useEffect(() => {
    document.body.classList.add('app-mode');
    return () => document.body.classList.remove('app-mode');
  }, []);

  useEffect(() => {
    applySchoolColor(profile?.schools?.color);
    return () => resetSchoolColor();
  }, [profile?.schools?.color]);

  return (
    <SchoolYearProvider schoolId={profile?.school_id}>
    <div id="app">
      <div className="topbar-row" style={{ background: 'var(--forest)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 15, color: 'var(--forest-dark)', flexShrink: 0, overflow: 'hidden' }}>
            {profile?.schools?.logo_url
              ? <img src={profile.schools.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (schoolName.split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG')}
          </div>
          <p className="topbar-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {schoolName}
          </p>
        </div>
        <div className="topbar-role-group" style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
          <SchoolYearSelector />
          {isPlatformAdmin && (
            <NavLink
              to="/admin"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: 20, color: '#fff', textDecoration: 'none', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <ShieldIcon />
              <span className="logout-label">Administration</span>
            </NavLink>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: 20 }}>
            <i className="ti ti-user-circle" style={{ fontSize: 17, color: '#fff' }} aria-hidden="true"></i>
            <span className="role-badge-label" style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{roleLabel}</span>
          </div>
          <a
            href={supportWhatsappLink("Bonjour, j'ai besoin d'aide sur EcoGès.")}
            target="_blank"
            rel="noreferrer"
            title="Besoin d'aide ? Discuter sur WhatsApp"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', flexShrink: 0 }}
          >
            <HelpIcon />
          </a>
          <button
            onClick={() => signOut()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', flexShrink: 0 }}
          >
            <span aria-hidden="true">⏻</span> <span className="logout-label">Se déconnecter</span>
          </button>
        </div>
      </div>

      <div id="layout">
        <div id="sidebar">
          {SIDEBAR_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="navlink" style={({ isActive }) => sidebarLinkStyle(isActive)}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 18, color: '#fff' }} aria-hidden="true"></i>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div id="screen">
          <Outlet />
        </div>
      </div>

      <div id="bottomnav">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = item.group
            ? item.group.some((p) => location.pathname.startsWith(p))
            : (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
          return (
            <NavLink key={item.to} to={item.to} className={`navlink${isActive ? ' active' : ''}`}>
              <i className={`ti ${item.icon}`} aria-hidden="true"></i>
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
    </SchoolYearProvider>
  );
}
