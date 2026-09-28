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

  return (
    <Dropdown
      value={selectedYear?.id || ''}
      onChange={selectYear}
      options={selectableYears.map((y) => ({ value: y.id, label: `${y.label}${y.is_current ? '' : ' · clôturée'}` }))}
      title={isHistorical ? `Consultation de ${selectedYear?.label} (clôturée)` : `Année en cours : ${selectedYear?.label}`}
      textColor={isHistorical ? 'var(--clay-dark)' : '#fff'}
      chevronColor={isHistorical ? 'var(--clay-dark)' : 'rgba(255,255,255,0.75)'}
      style={{
        fontSize: '12.5px', fontWeight: 600, padding: '7px 10px', borderRadius: 20,
        border: 'none',
        background: isHistorical ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
      }}
      wrapperStyle={{ flexShrink: 1, minWidth: 0, maxWidth: 118, width: 'auto' }}
    />
  );
}
