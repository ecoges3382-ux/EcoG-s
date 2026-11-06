import { fmtF, downloadCsv } from '../../lib/utils.js';
import { printDocument, slug } from '../../lib/print.js';
import { ReportShell, MiniStat, SimpleTable, SectionTitle, groupByClasse } from './ReportUI.jsx';

export default function FinancierReport({ school, schoolYear, students, personnel }) {
  const parClasse = groupByClasse(students);
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <ReportShell
      school={school}
      title="Rapport financier"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Montants dus/payés des inscriptions (enrollments) — même calcul que l'onglet Argent"
      onPrint={() => printDocument(`rapport-financier-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`financier-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Dû', 'Payé', 'Reste', 'Taux de recouvrement'],
        ...parClasse.map((c) => {
          const du = c.items.reduce((a, s) => a + Number(s.montant_du), 0);
          const paye = c.items.reduce((a, s) => a + Number(s.montant_paye), 0);
          return [c.nom, du, paye, du - paye, du > 0 ? `${Math.round((paye / du) * 100)}%` : '0%'];
        }),
        [],
        ['Masse salariale versée', personnel ? personnel.masseSalariale : ''],
        ['Avances sur salaire en cours', personnel ? personnel.avancesEnCours : ''],
        ['Dépenses', personnel ? personnel.depenses : ''],
      ])}
    >
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 10 }}>
        <MiniStat label="Attendu" value={fmtF(totalDu)} />
        <MiniStat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <MiniStat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
      </div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
      </div>

      <SectionTitle>Personnel</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Masse salariale versée" value={personnel ? fmtF(personnel.masseSalariale) : '…'} color="var(--success)" />
        <MiniStat label="Avances en cours" value={personnel ? fmtF(personnel.avancesEnCours) : '…'} color={personnel && personnel.avancesEnCours > 0 ? 'var(--amber)' : undefined} />
        <MiniStat label="Dépenses" value={personnel ? fmtF(personnel.depenses) : '…'} color="var(--danger)" />
      </div>

      <SectionTitle>Recouvrement par classe</SectionTitle>
      <SimpleTable
        columns={['Classe', 'Dû', 'Payé', 'Reste', 'Taux']}
        rows={parClasse.map((c) => {
          const du = c.items.reduce((a, s) => a + Number(s.montant_du), 0);
          const paye = c.items.reduce((a, s) => a + Number(s.montant_paye), 0);
          const taux = du > 0 ? Math.round((paye / du) * 100) : 0;
          return [c.nom, fmtF(du), fmtF(paye), fmtF(du - paye), `${taux}%`];
        })}
      />
    </ReportShell>
  );
}
