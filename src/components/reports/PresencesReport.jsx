import { useState } from 'react';
import { todayIso, startOfWeekIso, endOfWeekIso, startOfMonthIso, endOfMonthIso, downloadCsv } from '../../lib/utils.js';
import { printDocument, slug } from '../../lib/print.js';
import { ReportShell, MiniStat, SimpleTable, groupByClasse } from './ReportUI.jsx';

const PERIODES = [
  { id: 'annee', label: 'Année complète' },
  { id: 'mois', label: 'Ce mois' },
  { id: 'semaine', label: 'Cette semaine' },
  { id: 'jour', label: "Aujourd'hui" },
];

export default function PresencesReport({ school, schoolYear, students, attendance }) {
  const [periode, setPeriode] = useState('annee');
  const today = todayIso();
  
  const bounds = periode === 'jour' ? [today, today]
    : periode === 'semaine' ? [startOfWeekIso(today), endOfWeekIso(today)]
    : periode === 'mois' ? [startOfMonthIso(today), endOfMonthIso(today)]
    : null;

  const filtered = bounds ? (attendance || []).filter((a) => a.date >= bounds[0] && a.date <= bounds[1]) : (attendance || []);
  const counts = { present: 0, absent: 0, retard: 0 };
  filtered.forEach((a) => { counts[a.statut] = (counts[a.statut] || 0) + 1; });
  const total = filtered.length;
  const tauxPresence = total > 0 ? Math.round(((counts.present + counts.retard) / total) * 100) : null;

  const byStudent = new Map();
  filtered.forEach((a) => {
    const c = byStudent.get(a.student_id) || { absent: 0, retard: 0 };
    if (a.statut === 'absent') c.absent += 1; else if (a.statut === 'retard') c.retard += 1;
    byStudent.set(a.student_id, c);
  });
  
  const parClasse = groupByClasse(students).map((c) => {
    const absent = c.items.reduce((a, s) => a + (byStudent.get(s.id)?.absent || 0), 0);
    const retard = c.items.reduce((a, s) => a + (byStudent.get(s.id)?.retard || 0), 0);
    return { nom: c.nom, absent, retard };
  });

  return (
    <ReportShell
      school={school}
      title="Rapport des présences (appel rapide)"
      periode={bounds ? `du ${new Date(bounds[0]).toLocaleDateString('fr-FR')} au ${new Date(bounds[1]).toLocaleDateString('fr-FR')}` : `Année scolaire ${schoolYear.label} (complète)`}
      donnees="Appels quotidiens enregistrés (attendance_records) — pour le détail des motifs et durées, voir 'Absences & retards'"
      onPrint={() => printDocument(`rapport-presences-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`presences-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Absences', 'Retards'],
        ...parClasse.map((c) => [c.nom, c.absent, c.retard]),
      ])}
    >
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIODES.map((p) => (
          <button
            key={p.id} onClick={() => setPeriode(p.id)}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${periode === p.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: periode === p.id ? 'var(--forest)' : 'var(--paper)', color: periode === p.id ? '#fff' : 'var(--ink)' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
        <MiniStat label="Absences" value={counts.absent} color="var(--danger)" />
        <MiniStat label="Retards" value={counts.retard} color="var(--amber)" />
      </div>
      {total === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun appel enregistré sur cette période.</p>
      ) : (
        <SimpleTable columns={['Classe', 'Absences', 'Retards']} rows={parClasse.map((c) => [c.nom, c.absent, c.retard])} />
      )}
    </ReportShell>
  );
}
