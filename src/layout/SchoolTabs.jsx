import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const TABS = [
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
];

// Barre de sous-onglets visible seulement en dessous de 780px (voir
// .school-tabs-mobile dans styles.css) : sur desktop ces pages sont déjà
// toutes accessibles depuis la barre latérale complète.
export default function SchoolTabs() {
  const location = useLocation();
  const containerRef = useRef(null);

  // La barre est recréée à chaque page : sans ça, elle réaffiche toujours
  // le début (Élèves) même quand l'onglet actif (ex. Rapports) est plus loin.
  useEffect(() => {
    containerRef.current?.querySelector('a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [location.pathname]);

  return (
    <div className="school-tabs-mobile" ref={containerRef}>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} aria-hidden="true"></i>
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
