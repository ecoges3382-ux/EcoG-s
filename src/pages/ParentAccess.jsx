import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmtF, initials, trancheLabel } from '../lib/utils.js';
import { computeEcheances } from '../lib/retard.js';
import { PERIODES_BULLETIN, subjectPeriodeMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, subjectAnnualMoyenne, appreciation } from '../lib/bulletin.js';
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

const normalizeType = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function classifyNote(n) {
  const t = normalizeType(n.type);
  if (t.includes('devoir')) return 'devoir';
  if (t.includes('examen')) return 'examen';
  return 'interro';
}

function toCalcEnrollment(e) {
  return {
    montant_du: e.montant_du,
    montant_paye: e.montant_paye,
    frais_connexe_du: e.frais_connexe_du,
    frais_connexe_paye: e.frais_connexe_paye,
    note_arrangement: e.has_arrangement ? 'arrangement actif' : null,
  };
}

function slug(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const existing = document.querySelector('script[data-html2pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('CDN html2pdf inaccessible.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.setAttribute('data-html2pdf', 'true');
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('CDN html2pdf inaccessible.'));
    document.head.appendChild(script);
  });
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

  if (!summary) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: 380, paddingBottom: 40 }}>
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

  if (selectedId) {
    const student = summary.students.find((s) => s.id === selectedId);
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
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

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
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

function ChildCard({ s, schoolYear, feeSchedules, onClick }) {
  const feeSchedule = (feeSchedules || []).find((f) => f.niveau === s.classe_niveau) || null;
  const echeances = schoolYear ? computeEcheances(toCalcEnrollment(s), schoolYear, feeSchedule) : [];
  const enRetard = echeances.some((e) => e.enRetard);
  const reste = Number(s.montant_du) - Number(s.montant_paye);

  let badge = null;
  if (s.has_arrangement) badge = { label: 'Arrangement', bg: '#F0EDE5', fg: 'var(--muted)' };
  else if (enRetard) badge = { label: 'Solde à régler', bg: 'var(--danger-light)', fg: 'var(--danger)' };
  else if (reste > 0) badge = { label: `${fmtF(reste)} dû`, bg: 'var(--amber-light)', fg: 'var(--amber)' };
  else badge = { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' };

  const alertes = (s.absences_recentes || 0) + (s.retards_recents || 0);

  return (
    <button
      onClick={onClick}
      className="card-bold"
      style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%', gap: 10, flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
          {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            {s.niveau || '—'}{alertes > 0 ? ` · ${alertes} absence${alertes > 1 ? 's' : ''}/retard${alertes > 1 ? 's' : ''} (30j)` : ''}
          </p>
        </div>
      </div>
      <span style={{ background: badge.bg, color: badge.fg, fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge.label}</span>
    </button>
  );
}

function ChildDetail({ detail, periode, setPeriode, onChangeYear }) {
  const { student, school, school_year: schoolYear, enrollment, years, payments, attendance, grades, subjects, rangs, announcements } = detail;
  const isHistorical = schoolYear && years?.length && !schoolYear.is_current;
  const annuel = periode === 'annuel';
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFilename, setPdfFilename] = useState(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);

  if (!enrollment) {
    return (
      <>
        {years?.length > 1 && <YearSelector years={years} current={schoolYear?.id} onChange={onChangeYear} />}
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune inscription pour cette année scolaire.</p>
      </>
    );
  }

  const reste = Number(enrollment.montant_du) - Number(enrollment.montant_paye);
  const resteFrais = Number(enrollment.frais_connexe_du) - Number(enrollment.frais_connexe_paye);
  const echeances = computeEcheances(toCalcEnrollment(enrollment), schoolYear, detail.fee_schedule);

  const lignes = (subjects || []).map((su) => (
    annuel
      ? { ...su, t1: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 1'), t2: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 2'), t3: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 3'), moyenne: subjectAnnualMoyenne(grades, student.id, su.id) }
      : { ...su, moyenne: subjectPeriodeMoyenne(grades, student.id, su.id, periode) }
  ));
  const moyenneGenerale = annuel ? annualMoyenneGenerale(subjects, grades, student.id) : periodeMoyenneGenerale(subjects, grades, student.id, periode);
  const rang = rangs?.[periode] || null;

  const nbAbsences = (attendance || []).filter((a) => a.statut === 'absent').length;
  const nbRetards = (attendance || []).filter((a) => a.statut === 'retard').length;
  const nbPresent = (attendance || []).filter((a) => a.statut === 'present').length;
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((nbPresent + nbRetards) / totalAppels) * 100) : null;
  const absencesEtRetards = (attendance || []).filter((a) => a.statut !== 'present').slice(0, 15);

  const notesDetaillees = (() => {
    const gradesPourPeriode = annuel
      ? (grades || [])
      : (grades || []).filter((g) => g.periode === periode);

    const parMatiere = {};
    gradesPourPeriode.forEach((g) => {
      if (!parMatiere[g.subject_id]) parMatiere[g.subject_id] = [];
      parMatiere[g.subject_id].push(g);
    });

    return Object.entries(parMatiere)
      .map(([subjectId, notes]) => {
        const subject = (subjects || []).find((s) => s.id === subjectId) || notes[0]?.subjects || null;
        const sortedNotes = [...notes].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        return { subjectId, subject, notes: sortedNotes };
      })
      .sort((a, b) => (a.subject?.nom || '').localeCompare(b.subject?.nom || ''));
  })();

  async function buildPdfBlob() {
    const html2pdf = await loadHtml2Pdf();
    const element = document.getElementById('bulletin-print');
    if (!element) throw new Error('Élément bulletin introuvable.');

    const filename = `bulletin-${slug(student.full_name)}-${slug(periodeLabel(periode))}.pdf`;
    const opt = {
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
    return { blob, filename };
  }

  // 🔥 PRÉ-GÉNÉRATION DU PDF : dès que la fiche est prête, on génère le blob en arrière-plan.
  // Ça résout le problème iOS "not allowed by user agent" car au moment du clic
  // sur Partager, le blob est déjà prêt → navigator.share est appelé sans await.
  useEffect(() => {
    if (!enrollment) return;
    let cancelled = false;
    setPdfBlob(null);
    setPdfFilename(null);
    setPdfBuilding(true);

    const timer = setTimeout(async () => {
      try {
        const { blob, filename } = await buildPdfBlob();
        if (!cancelled) {
          setPdfBlob(blob);
          setPdfFilename(filename);
        }
      } catch (err) {
        console.error('Pré-génération PDF:', err);
      }
      if (!cancelled) setPdfBuilding(false);
    }, 800);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, enrollment?.id, student.full_name]);

  // 🔥 TÉLÉCHARGER : PC = showSaveFilePicker, Mobile = a.download
  async function downloadBulletinPDF() {
    setPdfLoading(true);
    try {
      let blob = pdfBlob;
      let filename = pdfFilename;

      if (!blob) {
        const result = await buildPdfBlob();
        blob = result.blob;
        filename = result.filename;
      }

      const mobile = isMobileDevice();

      // PC Chrome/Edge : boîte "Enregistrer sous" native
      if (!mobile && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setPdfLoading(false);
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') { setPdfLoading(false); return; }
        }
      }

      // Mobile + PC fallback : a.download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 3000);
    } catch (err) {
      console.error('Erreur PDF:', err);
      alert('Impossible de générer le PDF : ' + (err.message || 'inconnue'));
    }
    setPdfLoading(false);
  }

  // 🔥 PARTAGER : utilise le blob DÉJÀ PRÊT (pré-généré) pour ne pas perdre
  // la "user activation" requise par iOS pour navigator.share
  async function shareBulletinPDF() {
    if (!pdfBlob) {
      alert('Le PDF est en cours de préparation, réessayez dans 2 secondes.');
      return;
    }

    setPdfLoading(true);
    const file = new File([pdfBlob], pdfFilename, { type: 'application/pdf' });

    // navigator.share avec fichier — appelé IMMÉDIATEMENT (pas d'await avant)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Bulletin scolaire',
          text: `Bulletin de ${student.full_name} — ${periodeLabel(periode)}`,
        });
        setPdfLoading(false);
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          // L'utilisateur a annulé le partage, ce n'est pas une erreur
          setPdfLoading(false);
          return;
        }
        console.error('Erreur navigator.share:', err);
        // On continue vers le fallback
      }
    }

    // Fallback : téléchargement
    const mobile = isMobileDevice();
    try {
      if (!mobile && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: pdfFilename,
            types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(pdfBlob);
          await writable.close();
          setPdfLoading(false);
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') { setPdfLoading(false); return; }
        }
      }

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 3000);

      if (mobile) {
        alert("Le partage direct n'est pas disponible sur cet appareil.\nLe PDF a été téléchargé dans vos fichiers — vous pouvez l'envoyer manuellement.");
      }
    } catch (err) {
      console.error('Fallback partage PDF:', err);
      alert('Impossible de partager le PDF.');
    }
    setPdfLoading(false);
  }

  const shareDisabled = pdfLoading || pdfBuilding;

  return (
    <>
      {years?.length > 1 && <YearSelector years={years} current={schoolYear?.id} onChange={onChangeYear} />}
      {isHistorical && (
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-light)', padding: '8px 12px', borderRadius: 9 }}>
          Année scolaire antérieure — consultation de l'historique {schoolYear.label}.
        </p>
      )}
      {(enrollment.statut === 'redouble' || enrollment.statut === 'parti') && (
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          Statut d'inscription : {enrollment.statut === 'redouble' ? 'Redouble cette classe' : "N'est plus inscrit à l'école"}
        </p>
      )}

      <Section title="Situation financière">
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
          <Stat label="Reste à payer (écolage)" value={fmtF(reste)} color={reste > 0 ? 'var(--danger)' : 'var(--success)'} />
          <Stat label="Reste (frais connexes)" value={fmtF(resteFrais)} color={resteFrais > 0 ? 'var(--amber)' : 'var(--success)'} />
        </div>
        {enrollment.has_arrangement && (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
            Un arrangement de paiement est en cours pour cet élève — contacte le secrétariat pour le détail.
          </p>
        )}
        {echeances.length > 0 && (
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {echeances.map((ec, i) => (
              <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ec.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                    {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <EcheanceBadge statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowStatement(true)}
          style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
        >
          <i className="ti ti-file-invoice" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
          Imprimer la situation financière
        </button>
      </Section>

      <Section title="Paiements enregistrés">
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {(payments || []).slice(0, 10).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div>
                <span style={{ fontSize: 13 }}>{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 8 }}>{trancheLabel(p.tranche)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtF(p.montant)}</span>
                <button
                  type="button"
                  onClick={() => setReceiptPayment(p)}
                  title="Imprimer le reçu"
                  style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <i className="ti ti-receipt" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </button>
              </div>
            </div>
          ))}
          {(payments || []).length === 0 && <p style={{ padding: '14px 18px', color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré.</p>}
        </div>
      </Section>

      <Section title="Bulletin">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODE_OPTIONS.map((p) => (
            <button
              key={p} onClick={() => setPeriode(p)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${periode === p ? 'var(--forest)' : 'var(--line-strong)'}`, background: periode === p ? 'var(--forest)' : 'var(--paper)', color: periode === p ? '#fff' : 'var(--ink)' }}
            >
              {periodeLabel(p)}
            </button>
          ))}
        </div>

        <div id="bulletin-print" className="card-bold" style={{ padding: '18px 20px', overflow: 'hidden', backgroundColor: 'white' }}>
          <DocumentHeader
            school={school}
            title="Bulletin scolaire"
            subtitle={`${periodeLabel(periode)} · Année scolaire ${schoolYear?.label || ''}`}
          />
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600 }}>
            {student.full_name} · {enrollment.classe?.nom || '—'}
          </p>
          {lignes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune matière pour cette classe.</p>}
          {lignes.length > 0 && (
            annuel ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.5fr 0.5fr 0.6fr', padding: '0 0 8px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  <span>Matière</span><span>T1</span><span>T2</span><span>T3</span><span>Annuelle</span>
                </div>
                {lignes.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.5fr 0.5fr 0.6fr', padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center' }}>
                    <span>{l.nom}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t1 != null ? l.t1.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t2 != null ? l.t2.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t3 != null ? l.t3.toFixed(2) : '—'}</span>
                    <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr', padding: '0 0 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  <span>Matière</span><span>Moyenne /20</span><span>Appréciation</span>
                </div>
                {lignes.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
                    <span>{l.nom}</span>
                    <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{appreciation(l.moyenne) || '—'}</span>
                  </div>
                ))}
              </>
            )
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', background: 'var(--forest-light)', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: 'var(--forest-dark)' }}>Moyenne générale</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--forest-dark)' }}>{moyenneGenerale != null ? `${moyenneGenerale.toFixed(2)} / 20` : '—'}</p>
            </div>
            <div style={{ flex: '1 1 140px', background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Rang</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{rang ? `${rang.rang}${rang.rang === 1 ? 'er' : 'e'} / ${rang.total}` : 'Non classé'}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={downloadBulletinPDF}
            disabled={pdfLoading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: pdfLoading ? 'default' : 'pointer', opacity: pdfLoading ? 0.6 : 1 }}
          >
            <i className="ti ti-download" style={{ fontSize: 18 }} aria-hidden="true"></i>
            {pdfLoading ? 'Génération…' : 'Télécharger en PDF'}
          </button>
          <button
            type="button"
            onClick={shareBulletinPDF}
            disabled={shareDisabled}
            title={pdfBuilding ? 'PDF en cours de préparation…' : ''}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: shareDisabled ? 'default' : 'pointer', opacity: shareDisabled ? 0.6 : 1 }}
          >
            <i className="ti ti-share" style={{ fontSize: 18 }} aria-hidden="true"></i>
            {pdfBuilding ? 'Préparation…' : (pdfLoading ? 'Envoi…' : 'Partager')}
          </button>
        </div>
      </Section>

      <Section title={`Détail des notes — ${periodeLabel(periode)}`}>
        {notesDetaillees.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Aucune note enregistrée pour cette période.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {notesDetaillees.map(({ subjectId, subject, notes }) => {
              const devoirs = notes.filter((n) => classifyNote(n) === 'devoir');
              const examens = notes.filter((n) => classifyNote(n) === 'examen');
              const interros = notes.filter((n) => classifyNote(n) === 'interro');

              return (
                <div key={subjectId} className="card-bold" style={{ padding: '14px 18px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {subject?.nom || 'Matière inconnue'}
                    {subject?.coefficient && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-light)', padding: '2px 8px', borderRadius: 20 }}>
                        Coef. {subject.coefficient}
                      </span>
                    )}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: examens.length > 0 ? 12 : 0 }}>
                    <ColonneNotes
                      titre="Interrogations"
                      couleur="var(--forest)"
                      fond="var(--forest-light)"
                      notes={interros}
                    />
                    <ColonneNotes
                      titre="Devoirs"
                      couleur="var(--clay-dark)"
                      fond="var(--gold-light)"
                      notes={devoirs}
                    />
                  </div>

                  {examens.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <ColonneNotes
                        titre="Examens"
                        couleur="var(--danger)"
                        fond="var(--danger-light)"
                        notes={examens}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Présences">
        {totalAppels === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun appel enregistré pour cette année.</p>
        ) : (
          <>
            <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
              <Stat label="Absences" value={nbAbsences} color="var(--danger)" />
              <Stat label="Retards" value={nbRetards} color="var(--amber)" />
              <Stat label="Taux de présence" value={`${tauxPresence}%`} color="var(--success)" />
            </div>
            {absencesEtRetards.length > 0 && (
              <div className="card-bold" style={{ overflow: 'hidden' }}>
                {absencesEtRetards.map((a, i) => (
                  <div key={`${a.date}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: a.statut === 'absent' ? 'var(--danger-light)' : 'var(--amber-light)', color: a.statut === 'absent' ? 'var(--danger)' : 'var(--amber)' }}>
                      {a.statut === 'absent' ? 'Absent' : 'Retard'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {announcements?.length > 0 && (
        <Section title="Annonces">
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {announcements.map((a, i) => (
              <div key={a.id} style={{ padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 600 }}>{a.titre}</p>
                {a.contenu && <p style={{ margin: '0 0 5px', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{a.contenu}</p>}
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{a.auteur} · {a.role}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {receiptPayment && (
        <PaymentReceipt
          payment={receiptPayment}
          studentName={student.full_name}
          classeNom={enrollment.classe?.nom}
          schoolYearLabel={schoolYear?.label}
          school={school}
          montantDu={enrollment.montant_du}
          montantPaye={enrollment.montant_paye}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {showStatement && (
        <FinancialStatement
          studentName={student.full_name}
          classeNom={enrollment.classe?.nom}
          schoolYearLabel={schoolYear?.label}
          montantDu={Number(enrollment.montant_du || 0)}
          montantPaye={Number(enrollment.montant_paye || 0)}
          resteFrais={resteFrais}
          echeances={echeances}
          payments={payments}
          school={school}
          onClose={() => setShowStatement(false)}
        />
      )}
    </>
  );
}

function ColonneNotes({ titre, couleur, fond, notes }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: couleur, background: fond, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {titre}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
          {notes.length > 0 ? `(${notes.length})` : ''}
        </span>
      </div>
      {notes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}>
          Aucune note
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {notes.map((n, i) => {
            const dateAffichee = n.date_evaluation || n.created_at;
            return (
              <div key={n.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {dateAffichee
                    ? new Date(dateAffichee).toLocaleDateString('fr-FR')
                    : `Note ${i + 1}`}
                </span>
                <span style={{ fontWeight: 700 }}>{n.note}/{n.sur}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YearSelector({ years, current, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Année scolaire</label>
      <Dropdown
        value={current || ''}
        onChange={onChange}
        options={years.map((y) => ({ value: y.id, label: `${y.label}${y.is_current ? ' (en cours)' : ''}` }))}
        style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}
        wrapperStyle={{ width: 'auto', minWidth: 180 }}
      />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

function EcheanceBadge({ statut, montantPaye, montantRestant }) {
  const map = {
    payee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
    partielle: { label: `Partielle · ${fmtF(montantPaye)} payés · reste ${fmtF(montantRestant)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { label: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
    a_venir: { label: 'À venir', bg: '#F0EDE5', fg: 'var(--muted)' },
  };
  const s = map[statut] || map.impayee;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>
  );
}
