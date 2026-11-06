import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { initials } from '../lib/utils.js';
import { PERIODES_BULLETIN } from '../lib/bulletin.js';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import FinancialStatement from '../components/FinancialStatement.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { saveCache, loadCache } from '../lib/offlineCache.js';
import { computeEcheances } from '../lib/retard.js';
import { toCalcEnrollment } from '../lib/parentPortal.js';

// Composants isolés
import ParentLogin from '../components/parent/ParentLogin.jsx';
import ChildList from '../components/parent/ChildList.jsx';
import ChildFinance from '../components/parent/ChildFinance.jsx';
import ChildAttendance from '../components/parent/ChildAttendance.jsx';
import ChildBulletin from '../components/parent/ChildBulletin.jsx';

const STORAGE_KEY = 'ecoges_parent_access_code';

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
    if (data?.error) { setDetailError(data.error); return; }
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

  if (!summary) {
    return <ParentLogin codeInput={codeInput} setCodeInput={setCodeInput} handleSubmitCode={handleSubmitCode} error={error} loading={loading} />;
  }

  if (selectedId && !detail) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)', paddingTop: 40, textAlign: 'center' }}>
        <SkeletonRow count={5} />
      </div>
    );
  }

  if (selectedId && detail) {
    const student = summary.students.find((s) => s.id === selectedId);
    return (
      <ChildDetail 
        detail={detail} 
        student={student} 
        periode={periode} 
        setPeriode={setPeriode} 
        backToList={backToList} 
        onChangeYear={changeYear}
        offline={offline}
        detailError={detailError}
      />
    );
  }

  return <ChildList summary={summary} offline={offline} changeCode={changeCode} openStudent={openStudent} />;
}

// Sous-composant gérant l'assemblage de la fiche d'un enfant
function ChildDetail({ detail, student, periode, setPeriode, backToList, onChangeYear, offline, detailError }) {
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [showStatement, setShowStatement] = useState(false);

  if (detailError) return <p style={{ color: 'var(--danger)', padding: 20 }}>{detailError}</p>;
  if (!detail.enrollment) return <p style={{ padding: 20 }}>Aucune inscription pour cette année scolaire.</p>;

  const { enrollment } = detail;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
        <button onClick={backToList} style={{ background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
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

        <ChildFinance enrollment={enrollment} payments={detail.payments} schoolYear={detail.school_year} setReceiptPayment={setReceiptPayment} setShowStatement={setShowStatement} />
        
        <ChildBulletin detail={detail} periode={periode} setPeriode={setPeriode} onChangeYear={onChangeYear} />
        
        <ChildAttendance absence_events={detail.absence_events} late_events={detail.late_events} attendance={detail.attendance} />

        {detail.announcements?.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Annonces</p>
            <div className="card-bold" style={{ overflow: 'hidden' }}>
              {detail.announcements.map((a, i) => (
                <div key={a.id} style={{ padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 600 }}>{a.titre}</p>
                  {a.contenu && <p style={{ margin: '0 0 5px', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{a.contenu}</p>}
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{a.auteur} · {a.role}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {receiptPayment && (
          <PaymentReceipt
            payment={receiptPayment}
            studentName={student?.full_name}
            classeNom={enrollment.classe?.nom}
            schoolYearLabel={detail.school_year?.label}
            school={detail.school}
            montantDu={enrollment.montant_du}
            montantPaye={enrollment.montant_paye}
            onClose={() => setReceiptPayment(null)}
          />
        )}

        {showStatement && (
          <FinancialStatement
            studentName={student?.full_name}
            classeNom={enrollment.classe?.nom}
            schoolYearLabel={detail.school_year?.label}
            montantDu={Number(enrollment.montant_du || 0)}
            montantPaye={Number(enrollment.montant_paye || 0)}
            resteFrais={Number(enrollment.frais_connexe_du || 0) - Number(enrollment.frais_connexe_paye || 0)}
            echeances={computeEcheances(toCalcEnrollment(enrollment), detail.school_year, null)}
            payments={detail.payments}
            school={detail.school}
            onClose={() => setShowStatement(false)}
          />
        )}
      </div>
    </div>
  );
}
