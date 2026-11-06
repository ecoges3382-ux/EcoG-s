import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF, stickyColStyle } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import { computeRelance } from '../../lib/retard.js';
import { useEnrollmentsForYear } from '../../lib/enrollments.js';
import { SkeletonCard, SkeletonTableRows } from '../../components/Skeleton.jsx';
import OfflineBanner from '../../components/OfflineBanner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { translateError } from '../../lib/errors.js';
import { UsersIcon } from './icons.jsx';

export default function Overview() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [search, setSearch] = useState('');
  
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {translateError(error)}</p>;
  if (!students) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="card-bold">
        <EmptyState
          icon={<UsersIcon />}
          title="Aucun élève inscrit cette année"
          subtitle="Pour suivre les paiements et les soldes, il faut d'abord inscrire des élèves dans l'année scolaire en cours."
          actionLabel="Aller vers Élèves"
          actionTo="/eleves"
        />
      </div>
    );
  }

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  const totalConnexeDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalConnexePaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);

  const calendrierConfigure = !!(schoolYear && (schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3));
  const enrichis = students.map((s) => ({
    ...s,
    reste: Number(s.montant_du) - Number(s.montant_paye),
    relance: computeRelance(s, schoolYear, s.feeSchedule),
  }));
  const avecReste = enrichis.filter((s) => s.reste > 0);
  const enRetard = avecReste.filter((s) => !calendrierConfigure || s.relance.relance);
  const nbAJour = enrichis.length - avecReste.length;

  const filtered = enrichis
    .filter((s) => !debouncedSearch.trim() || s.full_name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()))
    .sort((a, b) => b.reste - a.reste);

  function statutOf(s) {
    if (s.relance.moratoire) return { label: 'Moratoire', color: null };
    if (s.reste <= 0) return { label: 'À jour', color: 'success' };
    if (calendrierConfigure) return s.relance.relance ? { label: 'À relancer', color: 'danger' } : { label: 'Dans les délais', color: 'amber' };
    return { label: 'Solde restant', color: 'amber' };
  }

  const chartData = [
    { name: "Droit d'écolage", Facturé: totalDu, Encaissé: totalPaye },
    { name: 'Frais connexes', Facturé: totalConnexeDu, Encaissé: totalConnexePaye },
  ];

  return (
    <div>
      {offline && <OfflineBanner />}
      <div data-tour="money-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
      </div>
      
      <div className="card-bold" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Facturé vs Encaissé (Vue d'ensemble)</p>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(val) => `${val / 1000}k`} />
              <RechartsTooltip 
                formatter={(value) => fmtF(value)}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Facturé" fill="#D4D4D4" radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="Encaissé" fill="var(--forest)" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
        <Stat label="Élèves à jour" value={nbAJour} color="var(--success)" />
        <Stat label="Élèves avec un solde" value={avecReste.length} color={enRetard.length > 0 ? 'var(--danger)' : undefined} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Élèves</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un élève…"
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 220, boxSizing: 'border-box', color: 'var(--ink)' }}
        />
      </div>
      <div className="card-bold" data-tour="money-list" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.85fr 0.85fr 0.9fr 1.3fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span><span>Dû</span><span>Payé</span><span>Solde</span><span>Statut</span>
          </div>
          {filtered.slice(0, 200).map((s, i) => {
            const st = statutOf(s);
            return (
              <Link
                key={s.id}
                to={`/eleves/${s.id}`}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.85fr 0.85fr 0.9fr 1.3fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < Math.min(filtered.length, 200) - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ ...stickyColStyle('var(--row-bg)'), paddingLeft: 20 }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                </div>
                <span style={{ fontSize: 13 }}>{fmtF(s.montant_du)}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.montant_paye)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(s.reste)}</span>
                <span style={{ background: st.color ? `var(--${st.color}-light)` : '#F0EDE5', color: st.color ? `var(--${st.color})` : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {st.label}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève ne correspond à « {search} ».</p>}
        </div>
        {filtered.length > 200 && (
          <p style={{ padding: '10px 20px', margin: 0, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
            200 élèves affichés sur {filtered.length} — affine la recherche pour voir les autres.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
