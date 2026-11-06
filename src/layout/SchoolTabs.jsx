import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

const TABS = [
  { to: '/eleves', label: 'Élèves', icon: 'ti-users', perm: 'eleves' },
  { to: '/parents', label: 'Parents', icon: 'ti-users-group', perm: 'parents' },
  { to: '/personnel', label: 'Personnel', icon: 'ti-id-badge-2', perm: 'personnel' },
  { to: '/classes', label: 'Classes', icon: 'ti-building', perm: 'classes' },
  { to: '/matieres', label: 'Matières', icon: 'ti-book-2', perm: 'matieres' },
  { to: '/notes', label: 'Notes', icon: 'ti-pencil', perm: 'notes' },
  { to: '/bulletins', label: 'Bulletins', icon: 'ti-certificate', perm: 'bulletins' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'ti-calendar-time', perm: 'emploi_du_temps' },
  { to: '/presences', label: 'Présences', icon: 'ti-clipboard-check', perm: 'presences' },
  { to: '/annonces', label: 'Annonces', icon: 'ti-speakerphone', perm: 'annonces' },
  { to: '/documents', label: 'Documents', icon: 'ti-file', perm: 'documents' },
  { to: '/rapports', label: 'Rapports', icon: 'ti-chart-bar', perm: 'rapports' },
];

export default function SchoolTabs() {
  const location = useLocation();
  const containerRef = useRef(null);
  const { profile } = useAuth();

  useEffect(() => {
    containerRef.current?.querySelector('a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [location.pathname]);

  const visibleTabs = TABS.filter((t) => {
    if (profile?.role === 'fondateur') return true;
    return profile?.permissions?.[t.perm] === true;
  });

  if (visibleTabs.length === 0) return null;

  return (
    <div className="school-tabs-mobile hide-scrollbar" ref={containerRef}>
      {visibleTabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} aria-hidden="true"></i>
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
