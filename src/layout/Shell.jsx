import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: 'ti-layout-dashboard', end: true },
  { to: '/eleves', label: 'Élèves', icon: 'ti-users' },
];

function navLinkStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
    borderRadius: 10, cursor: 'pointer', marginBottom: 3, textDecoration: 'none',
    background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
  };
}

export default function Shell() {
  const { profile, signOut } = useAuth();
  const schoolName = profile?.schools?.name || 'EcoGès';
  const roleLabel = ROLES[profile?.role]?.label || profile?.role || '';

  return (
    <div id="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ background: 'var(--forest)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 15, color: 'var(--forest-dark)', flexShrink: 0 }}>
            {schoolName.split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG'}
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {schoolName}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '7px 14px', borderRadius: 20 }}>
            <i className="ti ti-user-circle" style={{ fontSize: 17, color: '#fff' }} aria-hidden="true"></i>
            <span style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{roleLabel}</span>
          </div>
          <button
            onClick={() => signOut()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px' }}
          >
            <span aria-hidden="true">⏻</span> Se déconnecter
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: 220, background: 'var(--forest-dark)', flexShrink: 0, padding: '18px 12px' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={({ isActive }) => navLinkStyle(isActive)}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 18, color: '#fff' }} aria-hidden="true"></i>
              <span style={{ fontSize: '13.5px', color: '#fff', fontWeight: 500 }}>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1200, margin: '0 auto', color: 'var(--ink)', width: '100%' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
