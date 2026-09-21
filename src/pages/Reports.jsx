import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

export default function Reports() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [staff, setStaff] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité.
  useEffect(() => {
    if (!schoolYear) return;
    Promise.all([
      supabase.from('enrollments').select('classes ( nom )').eq('school_year_id', schoolYear.id),
      supabase.from('staff').select('id'),
      supabase.from('payments').select('id, montant, tranche, students ( full_name )').eq('school_year_id', schoolYear.id),
    ]).then(([{ data: enr, error: enrError }, { data: sf }, { data: pay }]) => {
      if (enrError) { setError(enrError.message); return; }
      setStudents((enr || []).map((e) => ({ niveau: e.classes?.nom || '—' })));
      setStaff(sf || []);
      setPayments(pay || []);
    });
  }, [schoolYear?.id]);

  const parClasse = useMemo(() => {
    const map = new Map();
    (students || []).forEach((s) => map.set(s.niveau, (map.get(s.niveau) || 0) + 1));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  const revenusTotaux = payments.reduce((a, p) => a + Number(p.montant), 0);
  const partiels = payments.filter((p) => p.tranche !== 'complet');

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Rapports & statistiques</p>
        <button onClick={() => window.print()} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
          <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }} className="desktop-grid-3">
        <Stat label="Élèves" value={students.length} />
        <Stat label="Enseignants" value={staff.length} />
        <Stat label="Revenus totaux" value={fmtF(revenusTotaux)} color="var(--success)" />
        <Stat label="Paiements partiels" value={partiels.length} color="var(--amber)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="desktop-grid-3">
        <div>
          <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Élèves par classe</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', padding: '10px 18px', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Classe</span><span>Effectif</span>
            </div>
            {parClasse.map(([niveau, count], i) => (
              <div key={niveau} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', padding: '11px 18px', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
                <span>{niveau}</span><span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
            {parClasse.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève.</p>}
          </div>
        </div>

        <div>
          <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Paiements partiels</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {partiels.slice(0, 12).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13.5 }}>
                <span>{p.students?.full_name || '—'}</span>
                <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{fmtF(p.montant)}</span>
              </div>
            ))}
            {partiels.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement partiel.</p>}
          </div>
        </div>
      </div>

      <p style={{ margin: '18px 0 0', fontSize: 12 }}>
        <Link to="/argent" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Voir le détail dans Argent → Paiements</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
