import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  { id: 'avec_solde', label: 'Avec solde' },
  { id: 'a_jour', label: 'À jour' },
  { id: 'a_relancer', label: 'À relancer' },
  { id: 'dans_les_delais', label: 'Dans les délais' },
  { id: 'solde_restant', label: 'Solde restant' },
  { id: 'moratoire', label: 'Moratoire' },
];

function matchStatut(s, statut) {
  if (statut === 'tous') return true;
  if (statut === 'avec_solde') return s.resteEcolage > 0 || s.resteConnexe > 0;
  return s.statutKey === statut;
}

export default function Recouvrement() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [inscriptionByStudent, setInscriptionByStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('toutes');

  // Le filtre de statut vient de l'URL (?statut=…) — permet le drill-down
  // depuis le Dashboard ("Reste à recouvrer" → ?statut=avec_solde). Changer
  // le filtre met à jour l'URL, ce qui rend le lien partageable et permet
  // au bouton "retour" du navigateur de revenir au filtre précédent.
  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatut = searchParams.get('statut') || 'tous';

  function setFilterStatut(next) {
    const newParams = new URLSearchParams(searchParams);
    if (next === 'tous') newParams.delete('statut');
    else newParams.set('statut', next);
    setSearchParams(newParams, { replace: true });
  }

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
    const relance = computeRelance(s, schoolYear, s.feeSchedule);
    let statutKey;
    if (relance.moratoire) statutKey = 'moratoire';
    else if (resteEcolage <= 0 && resteConnexe <= 0) statutKey = 'a_jour';
    else if (calendrierConfigure) statutKey = (relance.relance || relance.relanceConnexe) ? 'a_relancer' : 'dans_les_delais';
    else statutKey = 'solde_restant';
    return { ...s, resteEcolage, resteConnexe, inscriptionPaye, relance, statutKey };
  });

  const totalEcolageDu = enrichis.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalEcolagePaye = enrichis.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalEcolageReste = Math.max(totalEcolageDu - totalEcolagePaye, 0);
  const tauxEcolage = totalEcolageDu > 0 ? Math.round((totalEcolagePaye / totalEcolageDu) * 100) : 0;

  const totalConnexeDu = enrichis.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalConnexePaye = enrichis.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const totalConnexeReste = Math.max(totalConnexeDu - totalConnexePaye, 0);
  const tauxConnexe = totalConnexeDu > 0 ? Math.round((totalConnexePaye / totalConnexeDu) * 100) : 0;

  const totalInscriptionPaye = enrichis.reduce((a, s) => a + s.inscriptionPaye, 0);
  const nbInscriptionPayes = enrichis.filter((s) => s.inscriptionPaye > 0).length;

  const ecolagePrioritaires = enrichis
    .filter((s) => s.resteEcolage > 0)
    .map((s) => ({ ...s, enRetard: calendrierConfigure ? !!s.relance.relance : true }))
    .sort((a, b) => b.resteEcolage - a.resteEcolage);
  const connexePrioritaires = enrichis
    .filter((s) => s.resteConnexe > 0)
    .map((s) => ({ ...s, enRetard: calendrierConfigure ? !!s.relance.relanceConnexe : true }))
    .sort((a, b) => b.resteConnexe - a.resteConnexe);
  const totalEcolagePrioritaire = ecolagePrioritaires.reduce((a, s) => a + s.resteEcolage, 0);
  const totalConnexePrioritaire = connexePrioritaires.reduce((a, s) => a + s.resteConnexe, 0);

  const totalAttendu = totalEcolageDu + totalConnexeDu;
  const totalEncaisse = totalEcolagePaye + totalConnexePaye;
  const totalReste = totalEcolageReste + totalConnexeReste;
  const tauxGlobal = totalAttendu > 0 ? Math.round((totalEncaisse / totalAttendu) * 100) : 0;
  const nbAJour = enrichis.filter((s) => s.statutKey === 'a_jour').length;
  const nbAvecSolde = enrichis.length - nbAJour;

  const classes = [...new Set(students.map((s) => s.niveau))].sort();
  const filtered = enrichis
    .filter((s) => !search.trim() || s.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => filterClasse === 'toutes' || s.niveau === filterClasse)
    .filter((s) => matchStatut(s, filterStatut))
    .sort((a, b) => (b.resteEcolage + b.resteConnexe) - (a.resteEcolage + a.resteConnexe));

  function exportCsv() {
    const header = [
      'Élève', 'Classe',
      'Écolage dû', 'Écolage payé', 'Écolage reste',
      'Inscription payée',
      'Connexes dû', 'Connexes payé', 'Connexes reste',
      'Statut',
    ];
    const lines = filtered.map((s) => [
      s.full_name, s.niveau,
      Number(s.montant_du), Number(s.montant_paye), s.resteEcolage,
      s.inscriptionPaye,
      Number(s.frais_connexe_du), Number(s.frais_connexe_paye), s.resteConnexe,
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
        <TypeCard label="Droit d'écolage" du={totalEcolageDu} paye={totalEcolagePaye} reste={totalEcolageReste} taux={tauxEcolage} />
        <TypeCard label="Frais d'inscription" inscription paye={totalInscriptionPaye} count={nbInscriptionPayes} />
        <TypeCard label="Frais connexes" du={totalConnexeDu} paye={totalConnexePaye} reste={totalConnexeReste} taux={tauxConnexe} />
      </div>

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <PriorityCard
          title="Priorité — Écolage"
          icon="ti-cash"
          accent="var(--forest)"
          accentDark="var(--forest-dark)"
          accentLight="var(--forest-light)"
          students={ecolagePrioritaires}
          getReste={(s) => s.resteEcolage}
          totalReste={totalEcolagePrioritaire}
        />
        <PriorityCard
          title="Priorité — Frais connexes"
          icon="ti-receipt-2"
          accent="var(--clay)"
          accentDark="var(--clay-dark)"
          accentLight="var(--clay-light)"
          students={connexePrioritaires}
          getReste={(s) => s.resteConnexe}
          totalReste={totalConnexePrioritaire}
        />
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

      {/* Ajout de hide-scrollbar ici pour cacher la barre sous les boutons de filtres */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
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
                {enrichis.filter((s) => matchStatut(s, f.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 820 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span>
            <span>Écolage</span>
            <span>Inscription</span>
            <span>Connexes</span>
            <span>Statut</span>
          </div>
          {filtered.map((s, i) => {
            const st = STATUT_RECOUVREMENT[s.statutKey];
            return (
              <Link
                key={s.id}
                to={`/eleves/${s.id}`}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
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

      <div className="card-bold" style={{ padding: '20px 22px', marginTop: 24, background: 'linear-gradient(135deg, var(--forest-light), #FAF6EC)', borderColor: 'var(--forest)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <i className="ti ti-sum" style={{ fontSize: 20, color: 'var(--forest)' }} aria-hidden="true"></i>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, color: 'var(--forest-dark)' }}>
            Synthèse globale — écolage + connexes
          </p>
        </div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
          <SynthesisStat label="Attendu total" value={fmtF(totalAttendu)} />
          <SynthesisStat label="Encaissé total" value={fmtF(totalEncaisse)} color="var(--success)" />
          <SynthesisStat label="Reste total à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
        </div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <SynthesisStat label="Taux global de recouvrement" value={`${tauxGlobal}%`} color="var(--success)" />
          <SynthesisStat label="Élèves à jour (tout confondu)" value={nbAJour} color="var(--success)" />
          <SynthesisStat label="Élèves avec au moins un solde" value={nbAvecSolde} color={nbAvecSolde > 0 ? 'var(--danger)' : undefined} />
        </div>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Les frais d'inscription sont payés à l'inscription — aucun reste à recouvrer. La colonne « Inscription »
        affiche uniquement ce qui a été encaissé sous ce type de frais. Les blocs « Écolage » et « Connexes »
        sont toujours séparés ; seule la synthèse en bas les additionne, pour la vue comptable.
      </p>
    </div>
  );
}

function TypeCard({ label, du, paye, reste, taux, inscription, count }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Attendu</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtF(du)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Encaissé</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtF(paye)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Reste</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(reste)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 6px' }}>
            <div style={{ height: '100%', width: `${taux}%`, background: reste > 0 ? 'var(--amber)' : 'var(--success)' }} />
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {taux}% recouvré
          </p>
        </>
      )}
    </div>
  );
}

function PriorityCard({ title, icon, accent, accentDark, accentLight, students, getReste, totalReste }) {
  const enRetard = students.filter((s) => s.enRetard);
  const aJour = students.length - enRetard.length;
  const top = students.slice(0, 8);

  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 18, color: accent }} aria-hidden="true"></i>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: accentDark, background: accentLight, padding: '3px 10px', borderRadius: 20 }}>
          {students.length} élève{students.length > 1 ? 's' : ''}
        </span>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
        Total restant : <strong style={{ color: accentDark, fontSize: 14 }}>{fmtF(totalReste)}</strong>
        {enRetard.length > 0 && (
          <> · <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{enRetard.length} en retard</span></>
        )}
        {enRetard.length === 0 && aJour > 0 && (
          <> · <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{aJour} dans les délais</span></>
        )}
      </p>

      {students.length === 0 ? (
        <p style={{ margin: 0, padding: '14px 0', fontSize: 12.5, color: 'var(--success)', fontWeight: 600, textAlign: 'center' }}>
          <i className="ti ti-check" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
          Tout est à jour
        </p>
      ) : (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 4 }}>
          {top.map((s, i) => (
            <Link
              key={s.id}
              to={`/eleves/${s.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', textDecoration: 'none', color: 'inherit',
                borderBottom: i < top.length - 1 ? '1px solid var(--line)' : 'none', gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.full_name}
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>{s.niveau}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: s.enRetard ? 'var(--danger)' : 'var(--amber)' }}>
                  {fmtF(getReste(s))}
                </span>
                {s.enRetard && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--danger)', padding: '2px 7px', borderRadius: 10, background: 'var(--danger-light)', whiteSpace: 'nowrap' }}>
                    RETARD
                  </span>
                )}
              </div>
            </Link>
          ))}
          {students.length > top.length && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic' }}>
              + {students.length - top.length} autre{students.length - top.length > 1 ? 's' : ''} — voir le détail ci-dessous
            </p>
          )}
        </div>
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

function SynthesisStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
