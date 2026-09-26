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

const STORAGE_KEY = 'ecoges_parent_access_code';
const PERIODE_OPTIONS = [...PERIODES_BULLETIN, 'annuel'];
function periodeLabel(p) { return p === 'annuel' ? 'Année complète' : p; }

// Le contenu exact d'une note d'arrangement (has_arrangement) n'est jamais
// transmis au parent (peut porter des remarques internes) — seule sa
// présence compte pour computeRelance/computeEcheances, qui n'ont besoin
// que d'une valeur non vide.
function toCalcEnrollment(e) {
  return {
    montant_du: e.montant_du,
    montant_paye: e.montant_paye,
    frais_connexe_du: e.frais_connexe_du,
    frais_connexe_paye: e.frais_connexe_paye,
    note_arrangement: e.has_arrangement ? 'arrangement actif' : null,
  };
}

// Page publique, sans compte ni session : un parent saisit (ou reçoit dans
// le lien) son code d'accès et voit directement ses enfants. Toute la
// vérification et la lecture passent par l'Edge Function parent-portal
// (clé service_role côté serveur, qui détermine seule les élèves
// autorisés) — cette page ne parle jamais aux tables Supabase directement,
// et n'accepte jamais un student_id/school_year_id comme preuve d'accès :
// elle se contente d'afficher ce que le serveur a bien voulu renvoyer.
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
  // Un changement rapide d'enfant ou d'année ne doit jamais laisser une
  // réponse plus lente écraser un choix plus récent — seule la dernière
  // requête émise a le droit d'appliquer son résultat.
  const detailRequestId = useRef(0);

  async function loadSummary(theCode) {
    setLoading(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', { body: { code: theCode } });
    setLoading(false);
    if (fnError || data?.error) {
      setError(data?.error || 'Code invalide.');
      setSummary(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setCode(theCode);
    setSummary(data);
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

  // Chaque appel efface d'abord le détail affiché — jamais de données de
  // l'enfant ou de l'année précédente laissées à l'écran pendant le
  // chargement de la suivante.
  async function fetchDetail(studentId, schoolYearId) {
    const requestId = ++detailRequestId.current;
    setDetail(null);
    setDetailError('');
    setPeriode('Trimestre 1');
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', {
      body: { code, action: 'detail', student_id: studentId, school_year_id: schoolYearId || undefined },
    });
    if (requestId !== detailRequestId.current) return; // une requête plus récente a déjà pris le relais
    if (fnError || data?.error) {
      setDetailError(data?.error || 'Erreur de chargement.');
      return;
    }
    setDetail(data);
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
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
      <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px 16px 60px' }}>
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

          {detailError && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{detailError}</p>}
          {!detailError && !detail && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

          {detail && (
            <ChildDetail detail={detail} periode={periode} setPeriode={setPeriode} onChangeYear={changeYear} />
          )}
        </div>
      </div>
    );
  }

  // --- Écran 2 : accueil parent (liste des enfants) ---
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
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
  else if (enRetard) badge = { label: 'À relancer', bg: 'var(--danger-light)', fg: 'var(--danger)' };
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
          <button
            onClick={() => printDocument(`bulletin-${slug(student.full_name)}-${slug(periodeLabel(periode))}`)}
            style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: 'none', background: 'var(--clay)', color: '#fff', cursor: 'pointer' }}
          >
            <i className="ti ti-printer" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Imprimer
          </button>
        </div>

        <div className="card-bold print-sheet" style={{ padding: '18px 20px', overflow: 'hidden' }}>
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

function YearSelector({ years, current, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Année scolaire</label>
      <select
        value={current || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--paper)' }}
      >
        {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (en cours)' : ''}</option>)}
      </select>
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
    partielle: { label: `Partielle · ${fmtF(montantPaye)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { label: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
  };
  const s = map[statut] || map.impayee;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>
  );
}
