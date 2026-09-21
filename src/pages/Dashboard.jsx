import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [absentsAujourdhui, setAbsentsAujourdhui] = useState(0);
  const [paiementsDuJour, setPaiementsDuJour] = useState({ montant: 0, count: 0 });
  const [revenusDuMois, setRevenusDuMois] = useState(0);
  const [error, setError] = useState('');

  // Le dû/payé et la classe d'un élève sont propres à l'année scolaire en
  // cours (enrollments) — students ne garde que son identité.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    const today = todayIso();
    const debutMois = `${today.slice(0, 7)}-01`;

    Promise.all([
      supabase.from('enrollments').select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id),
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('school_year_id', schoolYear.id).eq('date', today).eq('statut', 'absent'),
      supabase.from('payments').select('montant').eq('school_year_id', schoolYear.id).eq('date', today),
      supabase.from('payments').select('montant').eq('school_year_id', schoolYear.id).gte('date', debutMois),
    ]).then(([enrRes, absentsRes, todayPayRes, monthPayRes]) => {
      if (cancelled) return;
      if (enrRes.error) { setError(enrRes.error.message); return; }
      setStudents((enrRes.data || []).map((e) => ({
        id: e.students.id,
        full_name: e.students.full_name,
        niveau: e.classes?.nom || '—',
        montant_du: e.montant_du,
        montant_paye: e.montant_paye,
        frais_connexe_du: e.frais_connexe_du,
        frais_connexe_paye: e.frais_connexe_paye,
        note_arrangement: e.note_arrangement,
      })));
      setAbsentsAujourdhui(absentsRes.count || 0);
      const todayRows = todayPayRes.data || [];
      setPaiementsDuJour({ montant: todayRows.reduce((a, p) => a + Number(p.montant), 0), count: todayRows.length });
      setRevenusDuMois((monthPayRes.data || []).reduce((a, p) => a + Number(p.montant), 0));
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>;
  }
  if (!students) {
    return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;
  }

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  const totalFraisDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalFraisPaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const tauxFrais = totalFraisDu > 0 ? Math.round((totalFraisPaye / totalFraisDu) * 100) : 0;

  // Une fois un calendrier de paiement configuré, "en retard" veut dire un
  // délai dépassé (voir computeRelance) plutôt que juste "reste à payer" —
  // et exclut les élèves avec un moratoire actif.
  const calendrierConfigure = !!(schoolYear && (schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3));
  const enRetard = students
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .filter((s) => !calendrierConfigure || computeRelance(s, schoolYear).relance)
    .sort((a, b) => b.reste - a.reste)
    .slice(0, 5);

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 22px', fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
        Tableau de bord
      </p>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 22 }}>
        <div className="card-bold" style={{ padding: '22px 24px', background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Taux de recouvrement — scolarité</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{tauxRecouv}%</p>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.65)' }}>de {fmtF(totalDu)} attendus</p>
          </div>
          <div style={{ height: 9, background: 'rgba(255,255,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tauxRecouv}%`, background: 'var(--gold)' }}></div>
          </div>
        </div>
        <div className="card-bold" style={{ padding: '22px 24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Frais connexes</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, color: 'var(--clay-dark)' }}>{tauxFrais}%</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>encaissés séparément du droit d'écolage</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Encaissé</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color: 'var(--success)' }}>{fmtF(totalPaye)}</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Reste dû</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(totalReste)}</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Élèves</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700 }}>{students.length}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }}>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Absents aujourd'hui</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color: absentsAujourdhui > 0 ? 'var(--danger)' : 'var(--ink)' }}>{absentsAujourdhui}</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Paiements du jour</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700 }}>{fmtF(paiementsDuJour.montant)}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{paiementsDuJour.count} paiement{paiementsDuJour.count > 1 ? 's' : ''}</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Revenus du mois</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color: 'var(--success)' }}>{fmtF(revenusDuMois)}</p>
        </div>
      </div>

      <div className="card-bold" style={{ padding: '20px 22px', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Priorité du jour</p>
          <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{enRetard.length} élèves</span>
        </div>
        {enRetard.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun retard de paiement.</p>}
        {enRetard.map((s, i) => (
          <Link
            key={s.id}
            to={`/eleves/${s.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < enRetard.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600, color: 'var(--clay-dark)', flexShrink: 0 }}>
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
