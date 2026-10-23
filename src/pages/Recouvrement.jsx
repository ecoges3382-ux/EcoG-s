import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, stickyColStyle, downloadCsv, TYPES_FRAIS } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { SkeletonCard, SkeletonTableRows } from '../components/Skeleton.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const STATUT_RECOUVREMENT = {
  a_jour: { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' },
  a_relancer: { label: 'À relancer', bg: 'var(--danger-light)', fg: 'var(--danger)' },
  dans_les_delais: { label: 'Dans les délais', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  solde_restant: { label: 'Solde restant', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  moratoire: { label: 'Moratoire', bg: '#F0EDE5', fg: 'var(--muted)' },
};

const STATUT_FILTERS = [
  { id: 'tous', label: 'Tous' },
  { id: 'a_jour', label: 'À jour' },
  { id: 'a_relancer', label: 'À relancer' },
  { id: 'dans_les_delais', label: 'Dans les délais' },
  { id: 'solde_restant', label: 'Solde restant' },
  { id: 'moratoire', label: 'Moratoire' },
];

export default function Recouvrement() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [inscriptionByStudent, setInscriptionByStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [filterClasse, setFilterClasse] = useState('toutes');

  const inscriptionTypeId = TYPES_FRAIS.find(
    (t) => /inscription/i.test(t.id || '') || /inscription/i.test(t.label || ''),
  )?.id;

  useEffect(() => {
    if (!schoolYear) return;
    if (!inscriptionTypeId) { setInscriptionByStudent({}); return; }
    let cancelled = false;
    supabase
      .from('payments')
      .select('student_id, montant')
      .eq('school_year_id', schoolYear.id)
      .eq('type_frais', inscriptionTypeId)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach((p) => {
          map[p.student_id] = (map[p.student_id] || 0) + Number(p.montant);
        });
        setInscriptionByStudent(map);
      });
    return () => { cancelled = true; };
  }, [schoolYear?.id, inscriptionTypeId]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students || inscriptionByStudent === null) {
    return (
      <div>
        <SchoolTabs />
        {isHistorical && <HistoricalYearBanner year={schoolYear} />}
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={6} columns={6} /></div>
      </div>
    );
  }

  const calendrierConfigure = !!(schoolYear && (
    schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3 || schoolYear.date_connexe
  ));

  const enrichis = students.map((s) => {
    const resteEcolage = Number(s.montant_du) - Number(s.montant_paye);
    const resteConnexe = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
    const inscriptionPaye = inscriptionByStudent[s.id] || 0;
    const resteTotal = Math.max(resteEcolage, 0) + Math.max(resteConnexe, 0);
    const relance = computeRelance(s, schoolYear, s.feeSchedule);
    let statutKey;
    if (relance.moratoire) statutKey = 'moratoire';
    else if (resteEcolage <= 0 && resteConnexe <= 0) statutKey = 'a_jour';
    else if (calendrierConfigure) statutKey = (relance.relance || relance.relanceConnexe) ? 'a_relancer' : 'dans_les_delais';
    else statutKey = 'solde_restant';
    return { ...s, resteEcolage, resteConnexe, inscriptionPaye, resteTotal, relance, statutKey };
  });

  const totalEcolageDu = enrichis.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalEcolagePaye = enrichis.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalEcolageReste = Math.max(totalEcolageDu - totalEcolagePaye, 0);
  const totalConnexeDu = enrichis.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalConnexePaye = enrichis.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const totalConnexeReste = Math.max(totalConnexeDu - totalConnexePaye, 0);
  const totalInscriptionPaye = enrichis.reduce((a, s) => a + s.inscriptionPaye, 0);
  const totalAttendu = totalEcolageDu + totalConnexeDu;
  const totalEncaisse = totalEcolagePaye + totalConnexePaye;
  const totalReste = totalEcolageReste + totalConnexeReste;
  const tauxGlobal = totalAttendu > 0 ? Math.round((totalEncaisse / totalAttendu) * 100) : 0;
  const tauxEcolage = totalEcolageDu > 0 ? Math.round((totalEcolagePaye / totalEcolageDu) * 100) : 0;
  const tauxConnexe = totalConnexeDu > 0 ? Math.round((totalConnexePaye / totalConnexeDu) * 100) : 0;

  const nbAJour = enrichis.filter((s) => s.statutKey === 'a_jour').length;
  // Élèves avec un reste d'écolage — TRIÉS par montant restant décroissant.
// `enRetard` = délai dépassé sur le calendrier ; si aucun calendrier n'est
// configuré, tout solde restant est considéré prioritaire (fallback).
const ecolagePrioritaires = enrichis
  .filter((s) => s.resteEcolage > 0)
  .map((s) => ({ ...s, enRetard: calendrierConfigure ? !!s.relance.relance : true }))
  .sort((a, b) => b.resteEcolage - a.resteEcolage);

// Idem pour les frais connexes — table de calcul INDÉPENDANTE.
const connexePrioritaires = enrichis
  .filter((s) => s.resteConnexe > 0)
  .map((s) => ({ ...s, enRetard: calendrierConfigure ? !!s.relance.relanceConnexe : true }))
  .sort((a, b) => b.resteConnexe - a.resteConnexe);

const totalEcolagePrioritaire = ecolagePrioritaires.reduce((a, s) => a + s.resteEcolage, 0);
const totalConnexePrioritaire = connexePrioritaires.reduce((a, s) => a + s.resteConnexe, 0);
  const nbAvecSolde = enrichis.length - nbAJour;

  const classes = [...new Set(students.map((s) => s.niveau))].sort();
  const filtered = enrichis
    .filter((s) => !search.trim() || s.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => filterClasse === 'toutes' || s.niveau === filterClasse)
    .filter((s) => filterStatut === 'tous' || s.statutKey === filterStatut)
    .sort((a, b) => b.resteTotal - a.resteTotal);

  function exportCsv() {
    const header = [
      'Élève', 'Classe',
      'Écolage dû', 'Écolage payé', 'Écolage reste',
      'Inscription payée',
      'Connexes dû', 'Connexes payé', 'Connexes reste',
      'Total reste',
      'Statut',
    ];
    const lines = filtered.map((s) => [
      s.full_name, s.niveau,
      Number(s.montant_du), Number(s.montant_paye), s.resteEcolage,
      s.inscriptionPaye,
      Number(s.frais_connexe_du), Number(s.frais_connexe_paye), s.resteConnexe,
      s.resteTotal,
      STATUT_RECOUVREMENT[s.statutKey].label,
    ]);
    downloadCsv(`recouvrement-${schoolYear.label.replace(/\s+/g, '_')}.csv`, [header, ...lines]);
  }

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
          Recouvrement
        </p>
        <span style={{ fontSize: '12.5px', fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>
          Année scolaire {schoolYear.label}
        </span>
      </div>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        <TypeCard
          label="Droit d'écolage"
          du={totalEcolageDu}
          paye={totalEcolagePaye}
          reste={totalEcolageReste}
          taux={tauxEcolage}
        />
        <TypeCard
          label="Frais d'inscription"
          inscription
          paye={totalInscriptionPaye}
          count={enrichis.filter((s) => s.inscriptionPaye > 0).length}
        />
        <TypeCard
          label="Frais connexes"
          du={totalConnexeDu}
          paye={totalConnexePaye}
          reste={totalConnexeReste}
          taux={tauxConnexe}
        />
      </div>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        <Stat label="Attendu (écolage + connexes)" value={fmtF(totalAttendu)} />
        <Stat label="Encaissé" value={fmtF(totalEncaisse)} color="var(--success)" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
      </div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <Stat label="Taux global de recouvrement" value={`${tauxGlobal}%`} color="var(--success)" />
        <Stat label="Élèves à jour" value={nbAJour} color="var(--success)" />
        <Stat label="Élèves avec solde" value={nbAvecSolde} color={nbAvecSolde > 0 ? 'var(--danger)' : undefined} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          Détail par élève
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève…"
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 200, boxSizing: 'border-box', color: 'var(--ink)' }}
          />
          <Dropdown
            value={filterClasse === 'toutes' ? '' : filterClasse}
            onChange={(v) => setFilterClasse(v || 'toutes')}
            options={[
              { value: '', label: 'Toutes classes' },
              ...classes.map((c) => ({ value: c, label: c })),
            ]}
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13 }}
            wrapperStyle={{ width: 'auto', minWidth: 150 }}
          />
          <button
            onClick={exportCsv}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            <i className="ti ti-upload" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUT_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatut(f.id)}
            style={{
              padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filterStatut === f.id ? 'var(--forest)' : 'var(--line-strong)'}`,
              background: filterStatut === f.id ? 'var(--forest)' : 'var(--paper)',
              color: filterStatut === f.id ? '#fff' : 'var(--ink)',
            }}
          >
            {f.label}
            {f.id !== 'tous' && (
              <span style={{ opacity: 0.7, marginLeft: 5 }}>
                {enrichis.filter((s) => s.statutKey === f.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 820 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span>
            <span>Écolage</span>
            <span>Inscription</span>
            <span>Connexes</span>
            <span>Reste total</span>
            <span>Statut</span>
          </div>
          {filtered.map((s, i) => {
            const st = STATUT_RECOUVREMENT[s.statutKey];
            return (
              <Link
                key={s.id}
                to={`/eleves/${s.id}`}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ ...stickyColStyle('var(--row-bg)'), paddingLeft: 20 }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                </div>
                <MoneyCell paye={Number(s.montant_paye)} du={Number(s.montant_du)} reste={s.resteEcolage} />
                <div>
                  {s.inscriptionPaye > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>
                      <i className="ti ti-check" style={{ fontSize: 12 }} aria-hidden="true"></i>
                      {fmtF(s.inscriptionPaye)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>—</span>
                  )}
                </div>
                <MoneyCell paye={Number(s.frais_connexe_paye)} du={Number(s.frais_connexe_du)} reste={s.resteConnexe} />
                <span style={{ fontSize: 13, fontWeight: 700, color: s.resteTotal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {fmtF(s.resteTotal)}
                </span>
                <span style={{ background: st.bg, color: st.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {st.label}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève ne correspond à ces filtres.</p>
          )}
        </div>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Les frais d'inscription sont payés à l'inscription — aucun reste à recouvrer. La colonne « Inscription »
        affiche uniquement ce qui a été encaissé sous ce type de frais dans les paiements de l'année.
        Le « Reste total » ne cumule que l'écolage et les frais connexes.
      </p>
    </div>
  );
}

function TypeCard({ label, du, paye, reste, taux, inscription, count }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      {inscription ? (
        <>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
            {fmtF(paye)}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {count} élève{count > 1 ? 's' : ''} · payé à l'inscription
          </p>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {fmtF(paye)} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>/ {fmtF(du)}</span>
          </p>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', margin: '6px 0 4px' }}>
            <div style={{ height: '100%', width: `${taux}%`, background: reste > 0 ? 'var(--amber)' : 'var(--success)' }} />
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {taux}% recouvré · reste {fmtF(reste)}
          </p>
        </>
      )}
    </div>
  );
}

function MoneyCell({ paye, du, reste }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{fmtF(paye)}</p>
      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--muted)' }}>
        / {fmtF(du)}{reste > 0 ? ` · reste ${fmtF(reste)}` : ''}
      </p>
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
