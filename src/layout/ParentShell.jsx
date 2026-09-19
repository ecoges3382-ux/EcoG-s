import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

// Coquille minimale pour les comptes parents : pas de barre latérale, pas
// d'onglets — un parent n'a qu'une seule chose à voir (ses enfants), pas
// besoin de navigation.
export default function ParentShell() {
  const { profile, signOut } = useAuth();
  const schoolName = profile?.schools?.name || 'EcoGès';

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
        <button
          onClick={() => signOut()}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.85)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', flexShrink: 0 }}
        >
          <span aria-hidden="true">⏻</span> <span className="logout-label">Se déconnecter</span>
        </button>
      </div>

      <div id="screen" style={{ maxWidth: 720 }}>
        <Outlet />
      </div>
    </div>
  );
}
