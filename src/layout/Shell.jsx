import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';

const SIDEBAR_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: 'ti-layout-dashboard', end: true },
  { to: '/argent', label: 'Argent', icon: 'ti-wallet' },
  { to: '/eleves', label: 'Élèves', icon: 'ti-users' },
  { to: '/personnel', label: 'Personnel', icon: 'ti-id-badge-2' },
  { to: '/bulletins', label: 'Bulletins', icon: 'ti-certificate' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'ti-calendar-time' },
  { to: '/annonces', label: 'Annonces', icon: 'ti-speakerphone' },
  { to: '/parametres', label: 'Paramètres', icon: 'ti-settings' },
  { to: '/comptes', label: 'Comptes', icon: 'ti-users-group' },
];

const SCHOOL_GROUP_PATHS = ['/eleves', '/personnel', '/bulletins', '/emploi-du-temps', '/annonces'];

const BOTTOM_NAV_ITEMS = [
  { to: '/', shortLabel: 'Accueil', icon: 'ti-layout-dashboard', end: true },
  { to: '/argent', shortLabel: 'Argent', icon: 'ti-wallet' },
  { to: '/eleves', shortLabel: 'École', icon: 'ti-building-bank', group: SCHOOL_GROUP_PATHS },
  { to: '/parent', shortLabel: 'Parent', icon: 'ti-device-mobile' },
  { to: '/parametres', shortLabel: 'Paramètres', icon: 'ti-settings' },
];

function sidebarLinkStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
    borderRadius: 10, cursor: 'pointer', marginBottom: 3, textDecoration: 'none',
    background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
  };
}

export default function Shell() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const schoolName = profile?.schools?.name || 'EcoGès';
  const roleLabel = ROLES[profile?.role]?.label || profile?.role || '';

  // Fond sombre pour l'appli une fois connecté (cohérent avec la maquette
  // d'origine, qui bascule body.app-mode après connexion).
  useEffect(() => {
    document.body.classList.add('app-mode');
    return () => document.body.classList.remove('app-mode');
  }, []);

  return (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: 20 }}>
            <i className="ti ti-user-circle" style={{ fontSize: 17, color: '#fff' }} aria-hidden="true"></i>
            <span className="role-badge-label" style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{roleLabel}</span>
          </div>
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
          <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '14px 6px' }}></div>
          <NavLink to="/parent" className="navlink" style={({ isActive }) => sidebarLinkStyle(isActive)}>
            <i className="ti ti-device-mobile" style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)' }} aria-hidden="true"></i>
            <span className="sidebar-label" style={{ color: 'rgba(255,255,255,0.65)' }}>Vue parent</span>
          </NavLink>
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
  );
}
