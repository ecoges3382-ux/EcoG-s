import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmtF, initials, trancheLabel } from '../lib/utils.js';
import { computeEcheances } from '../lib/retard.js';
import { PERIODES_BULLETIN, subjectPeriodeMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, subjectAnnualMoyenne, appreciation } from '../lib/bulletin.js';
import { printDocument, slug } from '../lib/print.js';
import DocumentHeader from '../components/DocumentHeader.jsx';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import FinancialStatement from '../components/FinancialStatement.jsx';
import Dropdown from '../components/Dropdown.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { saveCache, loadCache } from '../lib/offlineCache.js';
import { Monogram } from '../components/Logo.jsx';

const STORAGE_KEY = 'ecoges_parent_access_code';
const PERIODE_OPTIONS = [...PERIODES_BULLETIN, 'annuel'];
function periodeLabel(p) { return p === 'annuel' ? 'Année complète' : p; }

function toCalcEnrollment(e) {
  return {
    montant_du: e.montant_du,
    montant_paye: e.montant_paye,
    frais_connexe_du: e.frais_connexe_du,
    frais_connexe_paye: e.frais_connexe_paye,
    note_arrangement: e.has_arrangement ? 'arrangement actif' : null,
  };
}

export default function ParentAccess() {
  const [searchParams] = useSearchParams();
  const [codeInput, setCodeInput] = useState(searchParams.get('code') || '');
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [periode, setPeriode] = useState('Trimestre 1');
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const detailRequestId = useRef(0);

  // 🔥 CORRECTION 1 : Forcer le scroll du body quand on est sur cette page publique.
  // L'application principale (le dashboard) bloque souvent le scroll global.
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  async function loadSummary(theCode) {
    setLoading(true);
    setError('');
    const cacheKey = `parent_portal_summary_${theCode}`;
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', { body: { code: theCode } });
    setLoading(false);
    if (data?.error) {
      setError(data.error);
      setSummary(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (fnError) {
      const cached = loadCache(cacheKey);
      if (cached) {
        setCode(theCode);
        setSummary(cached.data);
        setOffline(true);
        sessionStorage.setItem(STORAGE_KEY, theCode);
        return;
      }
      setError('Impossible de vérifier ce code. Vérifie ta connexion.');
      setSummary(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setCode(theCode);
    setSummary(data);
    setOffline(false);
    saveCache(cacheKey, data);
    sessionStorage.setItem(STORAGE_KEY, theCode);
  }

  useEffect(() => {
    const initial = searchParams.get('code') || sessionStorage.getItem(STORAGE_KEY);
    if (initial) loadSummary(initial.trim().toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmitCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    loadSummary(codeInput.trim().toUpperCase());
  }

  function changeCode() {
    detailRequestId.current += 1;
    sessionStorage.removeItem(STORAGE_KEY);
    setSummary(null);
    setSelectedId(null);
    setDetail(null);
    setCode('');
    setCodeInput('');
  }

  async function fetchDetail(studentId, schoolYearId) {
    const requestId = ++detailRequestId.current;
    const cacheKey = `parent_portal_detail_${studentId}_${schoolYearId || 'current'}`;
    setDetail(null);
    setDetailError('');
    setOffline(false);
    setPeriode('Trimestre 1');
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', {
      body: { code, action: 'detail', student_id: studentId, school_year_id: schoolYearId || undefined },
    });
    if (requestId !== detailRequestId.current) return;
    if (data?.error) {
      setDetailError(data.error);
      return;
    }
    if (fnError) {
      const cached = loadCache(cacheKey);
      if (cached) { setDetail(cached.data); setOffline(true); return; }
      setDetailError('Erreur de chargement.');
      return;
    }
    setDetail(data);
    saveCache(cacheKey, data);
  }

  function openStudent(student) {
    setSelectedId(student.id);
    fetchDetail(student.id, null);
  }

  function changeYear(schoolYearId) {
    fetchDetail(selectedId, schoolYearId);
  }

  function backToList() {
    detailRequestId.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  }

  // --- Écran 1 : saisie du code ---
  if (!summary) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 60px', background: 'var(--cream)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Monogram size={56} style={{ margin: '0 auto 16px' }} />
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Espace parent</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Saisis le code fourni par l'école</p>
          </div>

          <form onSubmit={handleSubmitCode} className="card-bold" style={{ padding: '26px 24px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Code d'accès</p>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="ex. K7XR4PQD"
              autoCapitalize="characters"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 18, letterSpacing: '0.08em', textAlign: 'center', marginBottom: 16, boxSizing: 'border-box', color: 'var(--ink)', textTransform: 'uppercase' }}
            />
            {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Vérification…' : 'Continuer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Écran 3 : détail d'un enfant ---
  if (selectedId) {
    const student = summary.students.find((s) => s.id === selectedId);
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--cream)', padding: '20px 16px 80px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <button
            onClick={backToList}
            style={{ background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}
          >
            ← Retour aux enfants
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
              {student?.photo_url ? <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(student?.full_name)}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>{student?.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{detail?.enrollment?.classe?.nom || student?.niveau || '—'}{student?.matricule ? ` · ${student.matricule}` : ''}</p>
            </div>
          </div>

          {offline && <OfflineBanner />}
          {detailError && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{detailError}</p>}
          {!detailError && !detail && <SkeletonRow count={3} />}

          {detail && (
            <ChildDetail detail={detail} periode={periode} setPeriode={setPeriode} onChangeYear={changeYear} />
          )}
        </div>
      </div>
    );
  }

  // --- Écran 2 : accueil parent (liste des enfants) ---
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)', padding: '20px 16px 80px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {offline && <OfflineBanner />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>Bonjour, {summary.full_name}</p>
          <button onClick={changeCode} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Changer de code</button>
        </div>

        {summary.announcements?.length > 0 && (
          <div className="card-bold" style={{ padding: '14px 16px', marginBottom: 18, background: 'var(--forest-light)', borderColor: 'transparent' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>Dernières annonces</p>
            {summary.announcements.map((a, i) => (
              <div key={a.id} style={{ marginTop: i > 0 ? 8 : 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{a.titre}</p>
              </div>
            ))}
          </div>
        )}

        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>
          {summary.students.length} enfant{summary.students.length > 1 ? 's' : ''} rattaché{summary.students.length > 1 ? 's' : ''}
          {summary.school_year ? ` · Année scolaire ${summary.school_year.label}` : ''}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {summary.students.map((s) => (
            <ChildCard key={s.id} s={s} schoolYear={summary.school_year} feeSchedules={summary.fee_schedules} onClick={() => openStudent(s)} />
          ))}
          {summary.students.length === 0 && (
            <div className="card-bold" style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              Aucun enfant n'est encore rattaché à ce code. Contacte le secrétariat de l'école.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ... (Le reste des composants ChildCard, ChildDetail, YearSelector, Stat, Section, EcheanceBadge restent EXACTEMENT identiques)
