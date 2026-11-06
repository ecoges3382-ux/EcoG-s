import { fmtF, downloadCsv } from '../../lib/utils.js';
import { printDocument, slug } from '../../lib/print.js';
import { ReportShell, MiniStat, SimpleTable } from './ReportUI.jsx';

export default function ImpayesReport({ school, schoolYear, students }) {
  const impayes = students
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .sort((a, b) => b.reste - a.reste);
  const totalImpaye = impayes.reduce((a, s) => a + s.reste, 0);

  return (
    <ReportShell
      school={school}
      title="Rapport des impayés"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Élèves dont le solde (dû - payé) est positif"
      onPrint={() => printDocument(`rapport-impayes-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`impayes-${slug(schoolYear.label)}.csv`, [
        ['Élève', 'Classe', 'Solde'],
        ...impayes.map((s) => [s.full_name, s.niveau, s.reste]),
      ])}
    >
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Élèves avec un solde" value={impayes.length} color={impayes.length > 0 ? 'var(--danger)' : undefined} />
        <MiniStat label="Total impayé" value={fmtF(totalImpaye)} color="var(--danger)" />
      </div>
      <SimpleTable
        columns={['Élève', 'Classe', 'Solde']}
        rows={impayes.slice(0, 100).map((s) => [s.full_name, s.niveau, fmtF(s.reste)])}
      />
      {impayes.length > 100 && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
          100 élèves affichés sur {impayes.length} — voir l'export CSV pour la liste complète.
        </p>
      )}
    </ReportShell>
  );
}
