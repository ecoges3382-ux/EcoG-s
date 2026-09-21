import { useSchoolYearSelector } from '../lib/schoolYear.jsx';

// Sélecteur global (barre du haut, voir Shell.jsx) : année active + années
// clôturées, jamais l'année en préparation (accessible uniquement depuis
// l'assistant de rollover, pas comme année de travail normale). Change
// uniquement la sélection locale à la session — ne touche jamais
// school_years.is_current.
export default function SchoolYearSelector() {
  const { activeYear, selectedYear, selectableYears, isHistorical, selectYear, loading } = useSchoolYearSelector();

  if (loading || !activeYear) return null;

  return (
    <select
      value={selectedYear?.id || ''}
      onChange={(e) => selectYear(e.target.value)}
      title={isHistorical ? `Consultation de ${selectedYear?.label} (clôturée)` : `Année en cours : ${selectedYear?.label}`}
      style={{
        fontSize: '12.5px', fontWeight: 600, padding: '7px 10px', borderRadius: 20, cursor: 'pointer',
        border: 'none', flexShrink: 1, minWidth: 0, maxWidth: 118, overflow: 'hidden', textOverflow: 'ellipsis',
        background: isHistorical ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
        color: isHistorical ? 'var(--clay-dark)' : '#fff',
      }}
    >
      {selectableYears.map((y) => (
        <option key={y.id} value={y.id}>
          {y.label}{y.is_current ? '' : ' · clôturée'}
        </option>
      ))}
    </select>
  );
}
