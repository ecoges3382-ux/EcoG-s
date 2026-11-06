import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { hasFeature } from '../lib/plan.js';

// Équivalent de la sidebar de Shell.jsx, mais pour mobile (barre d'onglets
// horizontale). Le filtrage doit être strictement identique, sinon un
// utilisateur en Découverte verrait sur téléphone des onglets qu'il ne voit
// pas sur ordinateur — il cliquerait puis tomberait sur PlanLocked. Un
// onglet qu'on ne peut pas utiliser ne doit pas apparaître du tout.
const TABS = [
  { to: '/eleves', label: 'Élèves', icon: 'ti-users', perm: 'eleves' },
  { to: '/parents', label: 'Parents', icon: 'ti-users-group', perm: 'parents', feature: 'parent_portal' },
  { to: '/personnel', label: 'Personnel', icon: 'ti-id-badge-2', perm: 'personnel', feature: 'personnel' },
  { to: '/classes', label: 'Classes', icon: 'ti-building', perm: 'classes' },
  { to: '/matieres', label: 'Matières', icon: 'ti-book-2', perm: 'matieres' },
  { to: '/notes', label: 'Notes', icon: 'ti-pencil', perm: 'notes' },
  { to: '/bulletins', label: 'Bulletins', icon: 'ti-certificate', perm: 'bulletins' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'ti-calendar-time', perm: 'emploi_du_temps', feature: 'emploi_du_temps' },
  { to: '/presences', label: 'Présences', icon: 'ti-clipboard-check', perm: 'presences' },
  { to: '/annonces', label: 'Annonces', icon: 'ti-speakerphone', perm: 'annonces' },
  { to: '/documents', label: 'Documents', icon: 'ti-file', perm: 'documents', feature: 'documents' },
  { to: '/rapports', label: 'Rapports', icon: 'ti-chart-bar', perm: 'rapports', feature: 'rapports_avances' },
];

export default function SchoolTabs() {
  const location = useLocation();
  const containerRef = useRef(null);
  const { profile } = useAuth();
  const plan = profile?.schools?.plan || 'decouverte';

  useEffect(() => {
    containerRef.current?.querySelector('a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [location.pathname]);

  const visibleTabs = TABS.filter((t) => {
    if (profile?.role === 'fondateur') return true;
    if (t.feature && !hasFeature(plan, t.feature)) return false;
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
