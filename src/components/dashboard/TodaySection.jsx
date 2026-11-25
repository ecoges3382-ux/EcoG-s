import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { fmtF, initials, todayIso } from '../../lib/utils.js';
import { calendrierConfigure, statutRecouvrement } from '../../lib/retard.js';
import { SkeletonCard, SkeletonRow } from '../Skeleton.jsx';
import { Stat } from './DashboardUI.jsx';
import { lireTout } from '../../lib/fetchAll.js';

export default function TodaySection({ activeYear, students }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const today = todayIso();
    const debutMois = `${today.slice(0, 7)}-01`;
    Promise.all([
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('school_year_id', activeYear.id).eq('date', today).eq('statut', 'absent'),
      supabase.from('payments').select('montant').eq('school_year_id', activeYear.id).eq('date', today),
      lireTout(supabase, 'payments', 'montant', (q) => q.eq('school_year_id', activeYear.id).gte('date', debutMois), { keyOf: null }),
    ]).then(([absentsRes, todayPayRes, monthPayRes]) => {
      if (cancelled) return;
      const todayRows = todayPayRes.data || [];
      setData({
        absentsAujourdhui: absentsRes.count || 0,
        paiementsDuJour: { montant: todayRows.reduce((a, p) => a + Number(p.montant), 0), count: todayRows.length },
        revenusDuMois: (monthPayRes.data || []).reduce((a, p) => a + Number(p.montant), 0),
      });
    });
    return () => { cancelled = true; };
  }, [activeYear.id]);

  // Même définition que la page Recouvrement (statutRecouvrement) : le nombre affiché ici est exactement celui de la liste qu'ouvre le lien.
  // Calendrier de paiement renseigné : « en retard » = statut « À relancer ». Sinon, on ne peut parler que de solde restant.
  const avecCalendrier = calendrierConfigure(activeYear);
  const filtreLien = avecCalendrier ? 'a_relancer' : 'avec_solde';
  const tousEnRetard = (students || [])
    .map((s) => {
      const { statutKey, resteEcolage, resteConnexe } = statutRecouvrement(s, activeYear, s.feeSchedule);
      return { ...s, statutKey, reste: resteEcolage + resteConnexe, resteEcolage, resteConnexe };
    })
    .filter((s) => (avecCalendrier ? s.statutKey === 'a_relancer' : (s.resteEcolage > 0 || s.resteConnexe > 0)))
    .sort((a, b) => b.reste - a.reste);
  const enRetard = tousEnRetard.slice(0, 5);

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Aujourd'hui — {activeYear.label}</p>
      {!data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="desktop-grid-3">
          <Stat label="Absents aujourd'hui" value={data.absentsAujourdhui} color={data.absentsAujourdhui > 0 ? 'var(--danger)' : undefined} to="/presences" />
          <Stat label="Paiements du jour" value={fmtF(data.paiementsDuJour.montant)} sub={`${data.paiementsDuJour.count} paiement${data.paiementsDuJour.count > 1 ? 's' : ''}`} to="/argent" />
          <Stat label="Revenus du mois" value={fmtF(data.revenusDuMois)} color="var(--success)" to="/argent" />
        </div>
      )}

      <div className="card-bold" style={{ padding: '20px 22px', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Priorité du jour</p>
          {students && tousEnRetard.length > 0 && (
            <Link to={`/recouvrement?statut=${filtreLien}`} style={{ fontSize: '12.5px', color: 'var(--forest-text)', fontWeight: 600, textDecoration: 'none' }}>
              Voir les {tousEnRetard.length} élève{tousEnRetard.length > 1 ? 's' : ''} {avecCalendrier ? 'à relancer' : 'avec solde'} →
            </Link>
          )}
        </div>
        {!students ? <SkeletonRow count={3} /> : null}
        {students && enRetard.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun retard de paiement.</p>}
        {enRetard.map((s, i) => (
          <Link
            key={s.id}
            to={`/eleves/${s.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < enRetard.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600, color: 'var(--clay-text)', flexShrink: 0 }}>
                {initials(s.full_name)}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{s.niveau}</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--danger)', fontWeight: 700 }}>{fmtF(s.reste)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
