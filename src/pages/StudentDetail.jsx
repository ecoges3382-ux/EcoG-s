import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, trancheLabel } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance, computeEcheances } from '../lib/retard.js';
import AmountAwareTextarea from '../components/AmountAwareTextarea.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [student, setStudent] = useState(null);
  // undefined = pas encore chargé, null = chargé mais aucune inscription
  // cette année (élève sans classe pour l'année en cours).
  const [enrollment, setEnrollment] = useState(undefined);
  const [feeSchedule, setFeeSchedule] = useState(null);
  const [payments, setPayments] = useState(undefined);
  const [attendance, setAttendance] = useState(undefined);
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setStudent(data);
      });
    // Séparé de la fiche élève : un enseignant (RLS bloque parent_access
    // pour ce rôle) verra simplement une liste vide plutôt qu'une erreur.
    supabase
      .from('parent_access_students')
      .select('parent_access ( id, full_name, phone )')
      .eq('student_id', id)
      .then(({ data }) => {
        if (!cancelled) setParents((data || []).map((row) => row.parent_access).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setPayments(undefined);
    supabase
      .from('enrollments')
      .select('id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, classes ( nom, niveau )')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;
        setEnrollment(data || null);
        if (data?.classes?.niveau) {
          const { data: fee } = await supabase
            .from('fee_schedules')
            .select('*')
            .eq('school_year_id', schoolYear.id)
            .eq('niveau', data.classes.niveau)
            .maybeSingle();
          if (!cancelled) setFeeSchedule(fee || null);
        } else if (!cancelled) {
          setFeeSchedule(null);
        }
      });
    // Historique des paiements de cet élève pour l'année consultée
    // uniquement — jamais mélangé avec ceux d'une autre année.
    supabase
      .from('payments')
      .select('id, montant, type_frais, mode, tranche, date, note')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setPayments(data || []); });
    // Présences de l'élève pour l'année consultée uniquement — la
    // contrainte (student_id, school_year_id, date) garantit qu'un élève
    // réinscrit une autre année n'a jamais ses présences mélangées ici.
    supabase
      .from('attendance_records')
      .select('date, statut')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .order('date', { ascending: false })
      .then(({ data }) => { if (!cancelled) setAttendance(data || []); });
    return () => { cancelled = true; };
  }, [id, schoolYear?.id]);

  async function saveArrangement(note) {
    if (!enrollment) return;
    const { error: saveError } = await supabase.from('enrollments').update({ note_arrangement: note || null }).eq('id', enrollment.id);
    if (saveError) { setError(saveError.message); return; }
    setEnrollment((prev) => ({ ...prev, note_arrangement: note || null }));
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!student || enrollment === undefined) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const reste = Number(enrollment?.montant_du || 0) - Number(enrollment?.montant_paye || 0);
  const resteFrais = Number(enrollment?.frais_connexe_du || 0) - Number(enrollment?.frais_connexe_paye || 0);
  const relance = enrollment ? computeRelance(enrollment, schoolYear, feeSchedule) : null;
  const echeances = enrollment ? computeEcheances(enrollment, schoolYear, feeSchedule) : [];

  const nbAbsences = (attendance || []).filter((a) => a.statut === 'absent').length;
  const nbRetards = (attendance || []).filter((a) => a.statut === 'retard').length;
  const nbPresent = (attendance || []).filter((a) => a.statut === 'present').length;
  const totalAppels = (attendance || []).length;
  // "Retard" reste une présence physique — même définition que dans les
  // statistiques de classe (Attendance.jsx).
  const tauxPresence = totalAppels > 0 ? Math.round(((nbPresent + nbRetards) / totalAppels) * 100) : null;
  const absencesEtRetards = (attendance || []).filter((a) => a.statut !== 'present').slice(0, 10);

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement ${student.full_name} ? Ses paiements, notes et présences seront aussi supprimés. Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    navigate('/eleves');
  }

  return (
    <div>
      <Link to="/eleves" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux élèves
      </Link>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden' }}>
          {student.photo_url ? <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(student.full_name)}
        </div>
        <div>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{student.full_name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{enrollment?.classes?.nom || 'Aucune classe cette année'}</span>
            {relance?.moratoire && (
              <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>Moratoire</span>
            )}
            {relance?.relance && (
              <span style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>À relancer</span>
            )}
          </div>
        </div>
      </div>

      {enrollment ? (
        <>
          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640, marginBottom: 20 }}>
            <div className="card-bold" style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Droit d'écolage</p>
              <Row label="Dû" value={fmtF(enrollment.montant_du)} />
              <Row label="Payé" value={fmtF(enrollment.montant_paye)} color="var(--success)" />
              <Row label="Reste" value={fmtF(reste)} bold color="var(--danger)" topBorder />
            </div>
            <div className="card-bold" style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais connexes</p>
              <Row label="Dû" value={fmtF(enrollment.frais_connexe_du)} />
              <Row label="Payé" value={fmtF(enrollment.frais_connexe_paye)} color="var(--success)" />
              <Row label="Reste" value={fmtF(resteFrais)} bold color={resteFrais > 0 ? 'var(--danger)' : 'var(--success)'} topBorder />
            </div>
          </div>

          {echeances.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Échéancier — {schoolYear.label}</p>
              <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
                {echeances.map((ec, i) => (
                  <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < echeances.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{ec.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                        {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
                        {ec.enRetard ? ' · en retard' : ''}
                      </p>
                    </div>
                    <EcheanceBadge statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Pas d'inscription pour {isHistorical ? 'cette année scolaire' : "l'année scolaire en cours"}{schoolYear ? ` (${schoolYear.label})` : ''}.
        </p>
      )}

      {enrollment && (
        <ArrangementNote
          note={enrollment.note_arrangement}
          canEdit={CAN_DELETE_ROLES.includes(profile.role)}
          onSave={saveArrangement}
        />
      )}

      {schoolYear && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Historique des paiements — {schoolYear.label}
          </p>
          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
            {payments === undefined && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>}
            {payments?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré pour cette année.</p>}
            {payments?.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{fmtF(p.montant)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                    {trancheLabel(p.tranche)} · {new Date(p.date).toLocaleDateString('fr-FR')}{p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{p.mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {schoolYear && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Assiduité — {schoolYear.label}
          </p>
          {attendance === undefined ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>
          ) : totalAppels === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun appel enregistré pour cet élève cette année.</p>
          ) : (
            <>
              <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14, maxWidth: 640 }}>
                <MiniStat label="Absences" value={nbAbsences} color="var(--danger)" />
                <MiniStat label="Retards" value={nbRetards} color="var(--amber)" />
                <MiniStat label="Taux de présence" value={`${tauxPresence}%`} color="var(--success)" />
              </div>
              {absencesEtRetards.length > 0 && (
                <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
                  {absencesEtRetards.map((a, i) => (
                    <div key={`${a.date}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < absencesEtRetards.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: a.statut === 'absent' ? 'var(--danger-light)' : 'var(--amber-light)', color: a.statut === 'absent' ? 'var(--danger)' : 'var(--amber)' }}>
                        {a.statut === 'absent' ? 'Absent' : 'Retard'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Parent{parents?.length > 1 ? 's' : ''}</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
        {parents === null && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>}
        {parents?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun parent relié pour l'instant.</p>}
        {parents?.map((p, i) => (
          <Link
            key={p.id}
            to={`/parents/${p.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{p.phone || 'Pas de numéro'}</span>
          </Link>
        ))}
      </div>

      {CAN_DELETE_ROLES.includes(profile.role) && (
        isHistorical ? (
          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
            Suppression désactivée en consultation d'un historique — reviens à l'année en cours pour supprimer cet élève.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ marginTop: 24, padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? 'Suppression…' : "Supprimer l'élève"}
          </button>
        )
      )}
    </div>
  );
}

function Row({ label, value, color, bold, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : '13.5px', marginBottom: bold ? 0 : 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: bold ? undefined : 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color }}>{value}</span>
    </div>
  );
}

// Le statut d'une échéance ne dépend que des paiements réellement
// enregistrés (jamais de la date) — voir computeEcheances dans lib/retard.js.
function MiniStat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700, color }}>{value}</p>
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
    <span style={{ background: s.bg, color: s.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// Un parent qui a négocié un arrangement (ex. payer par mensualités plutôt
// que suivre les tranches) est exclu des relances automatiques tant que
// cette note existe — voir computeRelance dans lib/retard.js.
function ArrangementNote({ note, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
    setEditing(false);
  }

  if (!canEdit && !note) return null;

  return (
    <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
      <p style={{ margin: '0 0 8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
        Arrangement de paiement
      </p>
      {editing ? (
        <>
          <AmountAwareTextarea
            value={value}
            onChange={setValue}
            placeholder="ex. Paie 20 000 F CFA par mois sur 5 mois, arrangement conclu le..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 10, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setValue(note || ''); setEditing(false); }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5 }}>Annuler</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: note ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>
            {note || "Aucun arrangement particulier — les relances automatiques s'appliquent normalement."}
          </p>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5 }}>
              {note ? 'Modifier' : 'Ajouter une note'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
