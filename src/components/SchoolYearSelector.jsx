import { useSchoolYearSelector } from '../lib/schoolYear.jsx';
import Dropdown from './Dropdown.jsx';

// Sélecteur global (barre du haut, voir Shell.jsx) : année active + années
// clôturées, jamais l'année en préparation (accessible uniquement depuis
// l'assistant de rollover, pas comme année de travail normale). Change
// uniquement la sélection locale à la session — ne touche jamais
// school_years.is_current.
export default function SchoolYearSelector() {
  const { activeYear, selectedYear, selectableYears, isHistorical, selectYear, loading } = useSchoolYearSelector();

  if (loading || !activeYear) return null;

  // Même apparence que tous les autres menus déroulants de l'app (champ
  // blanc bordé, liste attachée juste en dessous) au lieu d'un bouton-pilule
  // coloré propre à la barre du haut — seul le fond passe au doré quand on
  // consulte une année clôturée, pour garder ce repère visuel important.
  return (
    <Dropdown
      value={selectedYear?.id || ''}
      onChange={selectYear}
      options={selectableYears.map((y) => ({ value: y.id, label: `${y.label}${y.is_current ? '' : ' · clôturée'}` }))}
      title={isHistorical ? `Consultation de ${selectedYear?.label} (clôturée)` : `Année en cours : ${selectedYear?.label}`}
      style={isHistorical ? { background: 'var(--gold)', borderColor: 'var(--gold)' } : undefined}
      wrapperStyle={{ flexShrink: 1, minWidth: 0, maxWidth: 140, width: 'auto' }}
    />
  );
}
