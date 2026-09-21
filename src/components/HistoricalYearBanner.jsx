import { useSchoolYearSelector } from '../lib/schoolYear.jsx';

// Affiché en haut des écrans annuels (Élèves, Notes, Bulletins, Présences,
// Argent, Rapports, Dashboard, fiche élève) quand l'année consultée n'est
// pas l'année active — pour qu'il n'y ait jamais de doute sur les données
// affichées, sans avoir à revenir au sélecteur global dans la barre du
// haut.
export default function HistoricalYearBanner({ year }) {
  const { resetToActive } = useSchoolYearSelector();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderRadius: 10, background: 'var(--gold-light)', border: '1px solid var(--gold)', marginBottom: 18 }}>
      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', fontWeight: 600 }}>
        <i className="ti ti-history" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true"></i>
        Consultation de l'année {year?.label} (clôturée) — l'année en cours de l'école n'a pas changé.
      </p>
      <button
        type="button"
        onClick={resetToActive}
        style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--paper)', color: 'var(--clay-dark)', cursor: 'pointer', flexShrink: 0 }}
      >
        Revenir à l'année en cours
      </button>
    </div>
  );
}
