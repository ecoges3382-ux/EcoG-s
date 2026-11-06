import { printDocument, slug } from '../../lib/print.js';
import { downloadCsv } from '../../lib/utils.js';
import { ReportShell, MiniStat, SimpleTable, groupByClasse } from './ReportUI.jsx';

export default function EffectifsReport({ school, schoolYear, students, effectifsMouvement }) {
  const parClasse = groupByClasse(students);
  return (
    <ReportShell
      school={school}
      title="Rapport des effectifs"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Inscriptions (enrollments) de l'année sélectionnée"
      onPrint={() => printDocument(`rapport-effectifs-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`effectifs-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Effectif'],
        ...parClasse.map((c) => [c.nom, c.items.length]),
      ])}
    >
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Effectif total" value={students.length} />
        <MiniStat label="Nouveaux élèves" value={effectifsMouvement ? effectifsMouvement.nouveaux.length : '…'} color="var(--success)" />
        <MiniStat label="Réinscriptions" value={effectifsMouvement ? effectifsMouvement.reinscrits.length : '…'} />
      </div>
      <SimpleTable
        columns={['Classe', 'Effectif']}
        rows={parClasse.map((c) => [c.nom, c.items.length])}
      />
    </ReportShell>
  );
}
