import { Section, Stat } from './ChildFinance.jsx';

export default function ChildAttendance({ absence_events, late_events, attendance }) {
  const absences = absence_events || [];
  const retards = late_events || [];
  
  const nbAbsences = (attendance || []).filter((a) => a.statut === 'absent').length;
  const nbRetards = (attendance || []).filter((a) => a.statut === 'retard').length;
  const nbPresent = (attendance || []).filter((a) => a.statut === 'present').length;
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((nbPresent + nbRetards) / totalAppels) * 100) : null;

  if (absences.length === 0 && retards.length === 0 && totalAppels === 0) {
    return (
      <Section title="Assiduité (Absences et retards)">
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune absence ni retard enregistré.</p>
      </Section>
    );
  }

  return (
    <Section title="Assiduité (Absences et retards)">
      <div style={{ display: 'grid', gap: 16 }}>
        {absences.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--danger)' }}>Absences détaillées</p>
            <div className="card-bold" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 500 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px', gap: 8, padding: '10px 16px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
                  <span>Date</span>
                  <span>Motif</span>
                  <span>Durée</span>
                  <span>Justifié</span>
                </div>
                {absences.map((a, i) => (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px', gap: 8, padding: '10px 16px', alignItems: 'center', borderBottom: i < absences.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                    <span>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                    <span>{a.absence_motifs ? `${a.absence_motifs.code}. ${a.absence_motifs.libelle}` : (a.motif_libre || '—')}</span>
                    <span style={{ fontWeight: 600 }}>{Number(a.duree_heures)}h</span>
                    <span style={{ color: a.justifie ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{a.justifie ? 'Oui' : 'Non'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {retards.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--amber)' }}>Retards détaillés</p>
            <div className="card-bold" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 500 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px', gap: 8, padding: '10px 16px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
                  <span>Date</span>
                  <span>Motif</span>
                  <span>Durée</span>
                  <span>Justifié</span>
                </div>
                {retards.map((l, i) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px', gap: 8, padding: '10px 16px', alignItems: 'center', borderBottom: i < retards.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                    <span>{new Date(l.date).toLocaleDateString('fr-FR')}</span>
                    <span>{l.absence_motifs ? `${l.absence_motifs.code}. ${l.absence_motifs.libelle}` : (l.motif_libre || '—')}</span>
                    <span style={{ fontWeight: 600 }}>{l.duree_minutes} min</span>
                    <span style={{ color: l.justifie ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{l.justifie ? 'Oui' : 'Non'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {totalAppels > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Appel rapide quotidien</p>
            <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <Stat label="Absences (appel)" value={nbAbsences} color="var(--danger)" />
              <Stat label="Retards (appel)" value={nbRetards} color="var(--amber)" />
              <Stat label="Taux de présence" value={`${tauxPresence}%`} color="var(--success)" />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
