import { fmtF } from '../../lib/utils.js';
import { printDocument, slug } from '../../lib/print.js';
import { ReportShell, MiniStat, SectionTitle } from './ReportUI.jsx';

export default function SyntheseReport({ school, schoolYear, students, attendance, classResults, effectifsMouvement, personnel }) {
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
  const impayes = students.filter((s) => Number(s.montant_du) - Number(s.montant_paye) > 0).length;

  const counts = { present: 0, absent: 0, retard: 0 };
  (attendance || []).forEach((a) => { counts[a.statut] = (counts[a.statut] || 0) + 1; });
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((counts.present + counts.retard) / totalAppels) * 100) : null;

  const ponderees = (classResults || []).filter((c) => c.moyenne_generale != null);
  const moyenneEcole = ponderees.length > 0
    ? ponderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / ponderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <ReportShell
      school={school}
      title="Synthèse générale de l'année"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Résumé des rapports effectifs, financier, présences et résultats"
      onPrint={() => printDocument(`synthese-${slug(schoolYear.label)}`)}
    >
      <SectionTitle>Effectifs</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Total inscrits" value={students.length} />
        <MiniStat label="Nouveaux" value={effectifsMouvement ? effectifsMouvement.nouveaux.length : '…'} />
        <MiniStat label="Réinscriptions" value={effectifsMouvement ? effectifsMouvement.reinscrits.length : '…'} />
      </div>

      <SectionTitle>Finances</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
        <MiniStat label="Reste à recouvrer" value={fmtF(totalDu - totalPaye)} color="var(--danger)" />
        <MiniStat label="Élèves avec un solde" value={impayes} color={impayes > 0 ? 'var(--danger)' : undefined} />
      </div>

      <SectionTitle>Présences</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
        <MiniStat label="Absences" value={counts.absent} color="var(--danger)" />
        <MiniStat label="Retards" value={counts.retard} color="var(--amber)" />
      </div>

      <SectionTitle>Résultats scolaires</SectionTitle>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Moyenne générale" value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'} />
        <MiniStat label="Élèves avec des notes" value={(classResults || []).reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0)} />
      </div>

      <SectionTitle>Personnel</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <MiniStat label="Masse salariale versée" value={personnel ? fmtF(personnel.masseSalariale) : '…'} color="var(--success)" />
        <MiniStat label="Avances en cours" value={personnel ? fmtF(personnel.avancesEnCours) : '…'} color={personnel && personnel.avancesEnCours > 0 ? 'var(--amber)' : undefined} />
        <MiniStat label="Dépenses" value={personnel ? fmtF(personnel.depenses) : '…'} color="var(--danger)" />
      </div>
    </ReportShell>
  );
}
