import { downloadCsv } from '../../lib/utils.js';
import { printDocument, slug } from '../../lib/print.js';
import { SkeletonTableRows } from '../Skeleton.jsx';
import { ReportShell, MiniStat, SimpleTable } from './ReportUI.jsx';

export default function ResultatsReport({ school, schoolYear, classResults }) {
  if (!classResults) {
    return <div className="card-bold"><SkeletonTableRows count={4} columns={4} /></div>;
  }
  
  const avecNotes = classResults.reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0);
  const ponderees = classResults.filter((c) => c.moyenne_generale != null);
  const moyenneEcole = ponderees.length > 0
    ? ponderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / ponderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <ReportShell
      school={school}
      title="Rapport des résultats scolaires"
      periode={`Année scolaire ${schoolYear.label} (moyenne annuelle)`}
      donnees="Notes (grades), moyenne annuelle calculée avec la même formule que le bulletin et le rollover"
      onPrint={() => printDocument(`rapport-resultats-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`resultats-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Effectif', 'Élèves avec notes', 'Moyenne générale'],
        ...classResults.map((c) => [c.classe_nom, c.effectif, c.nb_avec_notes, c.moyenne_generale != null ? Number(c.moyenne_generale).toFixed(2) : '']),
      ])}
    >
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Moyenne générale de l'école" value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'} />
        <MiniStat label="Élèves avec des notes" value={avecNotes} />
      </div>
      {classResults.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune classe avec des élèves inscrits cette année.</p>
      ) : (
        <SimpleTable
          columns={['Classe', 'Effectif', 'Avec notes', 'Moyenne']}
          rows={classResults.map((c) => [c.classe_nom, c.effectif, c.nb_avec_notes, c.moyenne_generale != null ? `${Number(c.moyenne_generale).toFixed(2)}/20` : '—'])}
        />
      )}
    </ReportShell>
  );
}
