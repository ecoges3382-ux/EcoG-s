import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { fmtF } from '../../lib/utils.js';
import { SkeletonCard } from '../Skeleton.jsx';
import { Stat } from './DashboardUI.jsx';

export default function PersonnelSection({ schoolYear }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setData(null);
    Promise.all([
      supabase.from('staff').select('id, salaire_mensuel, date_entree').eq('statut', 'actif'),
      supabase.from('staff_salaries').select('staff_id, montant').eq('school_year_id', schoolYear.id),
      supabase.from('salary_advances').select('montant, solde').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
      supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id),
    ]).then(([{ data: staff }, { data: salaries }, { data: advances }, { data: expenses }]) => {
      if (cancelled) return;

      const today = new Date();
      let startDate;
      if (schoolYear.date_debut) {
        startDate = new Date(schoolYear.date_debut);
      } else {
        const match = schoolYear.label?.match(/^(\d{4})-(\d{4})$/);
        const startYear = match ? Number(match[1]) : today.getFullYear();
        startDate = new Date(startYear, 8, 1);
      }

      const monthsElapsed = Math.max(
        1,
        (today.getFullYear() - startDate.getFullYear()) * 12
        + (today.getMonth() - startDate.getMonth())
        + 1,
      );

      const masseTheorique = (staff || []).reduce((sum, s) => {
        if (!s.salaire_mensuel) return sum;
        let empStart = startDate;
        if (s.date_entree) {
          const entree = new Date(s.date_entree);
          if (entree > startDate) empStart = entree;
        }
        const months = Math.max(
          0,
          (today.getFullYear() - empStart.getFullYear()) * 12
          + (today.getMonth() - empStart.getMonth())
          + 1,
        );
        return sum + Number(s.salaire_mensuel) * months;
      }, 0);

      const masseSalariale = (salaries || []).reduce((a, s) => a + Number(s.montant), 0);
      const versementsDistincts = new Set((salaries || []).map((s) => s.staff_id)).size;
      const avancesTotales = (advances || []).reduce((a, s) => a + Number(s.montant), 0);
      const avancesEnCours = (advances || []).reduce((a, s) => a + Number(s.solde), 0);
      const depenses = (expenses || []).reduce((a, s) => a + Number(s.montant), 0);

      setData({
        effectifPersonnel: (staff || []).length,
        masseSalariale,
        masseTheorique,
        versementsDistincts,
        avancesTotales,
        avancesEnCours,
        totalDecaisse: masseSalariale + avancesTotales,
        depenses,
        monthsElapsed,
      });
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  const versementsLabel = data
    ? `${data.versementsDistincts} / ${data.effectifPersonnel} membres couverts${data.versementsDistincts < data.effectifPersonnel ? ' ⚠️' : ''}`
    : undefined;

  const ecart = data ? (data.masseSalariale - data.masseTheorique) : 0;
  const ecartLabel = data && data.masseTheorique > 0
    ? ecart >= 0
      ? `+${fmtF(ecart)} (au-dessus du théorique)`
      : `${fmtF(ecart)} (manquant)`
    : undefined;

  const decaisseSub = data
    ? `${fmtF(data.masseSalariale)} salaires + ${fmtF(data.avancesTotales)} avances`
    : undefined;

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Personnel</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Membres actifs" value={data ? data.effectifPersonnel : '…'} to="/personnel" />
        <Stat
          label="Masse salariale versée"
          value={data ? fmtF(data.masseSalariale) : '…'}
          color="var(--success)"
          sub={versementsLabel}
          subColor={data && data.versementsDistincts < data.effectifPersonnel ? 'var(--danger)' : undefined}
          to="/personnel"
        />
        <Stat
          label={`Salaires théoriques (${data ? data.monthsElapsed : '…'} mois)`}
          value={data ? fmtF(data.masseTheorique) : '…'}
          color="var(--ink)"
          sub={ecartLabel}
          subColor={ecart < 0 ? 'var(--danger)' : 'var(--success)'}
          to="/personnel"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="desktop-grid-3">
        <Stat
          label="Total décaissé personnel"
          value={data ? fmtF(data.totalDecaisse) : '…'}
          color="var(--clay-dark)"
          sub={decaisseSub}
          to="/personnel"
        />
        <Stat
          label="Avances en cours"
          value={data ? fmtF(data.avancesEnCours) : '…'}
          color={data && data.avancesEnCours > 0 ? 'var(--amber)' : undefined}
          sub={data && data.avancesTotales > 0 ? `sur ${fmtF(data.avancesTotales)} avancés` : undefined}
          to="/argent"
        />
        <Stat label="Autres dépenses" value={data ? fmtF(data.depenses) : '…'} color="var(--danger)" to="/argent" />
      </div>
    </div>
  );
}
