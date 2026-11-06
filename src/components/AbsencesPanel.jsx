import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { useToast } from './Toast.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { printDocument, slug } from '../lib/print.js';
import DocumentHeader from './DocumentHeader.jsx';
import AbsenceModal from './AbsenceModal.jsx';
import LateModal from './LateModal.jsx';
import { translateError } from '../lib/errors.js';
import { SkeletonRow } from './Skeleton.jsx';

const CAN_MANAGE_ROLES = ['fondateur', 'directeur', 'censeur', 'secretaire'];

function formatHeures(decimalHeures) {
  const total = Number(decimalHeures) || 0;
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return `${h}h${String(r).padStart(2, '0')}`;
  return `${r} min`;
}

function demiJourneeLabel(d) {
  if (d === 'matin') return 'Matin';
  if (d === 'apres_midi') return 'Après-midi';
  return 'Journée';
}

function motifLabel(ev) {
  if (ev.absence_motifs?.code) return `${ev.absence_motifs.code}. ${ev.absence_motifs.libelle}`;
  return ev.motif_libre || 'Motif non précisé';
}

function categorieCouleur(cat) {
  return {
    justifiee: 'var(--success)',
    non_justifiee: 'var(--danger)',
    non_imputable: 'var(--muted)',
    en_attente: 'var(--amber)',
  }[cat] || 'var(--muted)';
}

export default function AbsencesPanel({ studentId, studentName, classeNom, studentMatricule, dateNaissance }) {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const showToast = useToast();
  const confirm = useConfirm();

  const [absences, setAbsences] = useState(null);
  const [retards, setRetards] = useState(null);
  const [motifs, setMotifs] = useState([]);
  const [attendanceLegacy, setAttendanceLegacy] = useState([]);
  const [error, setError] = useState('');

  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState(null);
  const [editingLate, setEditingLate] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  const canManage = CAN_MANAGE_ROLES.includes(profile?.role);
  const yearId = schoolYear?.id;

  async function reload() {
    if (!yearId) return;
    setError('');
    const [
      { data: a, error: e1 },
      { data: l, error: e2 },
      { data: m },
      { data: legacy },
    ] = await Promise.all([
      supabase.from('absence_events').select('*, absence_motifs(code, libelle, categorie)').eq('student_id', studentId).eq('school_year_id', yearId).order('date', { ascending: false }),
      supabase.from('late_events').select('*, absence_motifs(code, libelle, categorie)').eq('student_id', studentId).eq('school_year_id', yearId).order('date', { ascending: false }),
      supabase.from('absence_motifs').select('*').eq('school_id', profile.school_id).eq('actif', true).order('ordre'),
      supabase.from('attendance_records').select('date, statut').eq('student_id', studentId).eq('school_year_id', yearId).order('date', { ascending: false }),
    ]);
    if (e1) { setError(translateError(e1)); return; }
    if (e2) { setError(translateError(e2)); return; }
    setAbsences(a || []);
    setRetards(l || []);
    setMotifs(m || []);
    setAttendanceLegacy(legacy || []);
  }

  useEffect(() => { reload(); }, [yearId, studentId]);

  const totalsAbs = useMemo(() => {
    const list = absences || [];
    return {
      count: list.length,
      heures: list.reduce((s, x) => s + (Number(x.duree_heures) || 0), 0),
      demiJournees: list.reduce((s, x) => s + (x.demi_journee === 'journee' ? 2 : 1), 0),
    };
  }, [absences]);

  const totalsLate = useMemo(() => {
    const list = retards || [];
    return {
      count: list.length,
      minutes: list.reduce((s, x) => s + (Number(x.duree_minutes) || 0), 0),
    };
  }, [retards]);

  async function handleDeleteAbsence(a) {
    if (!(await confirm(`Supprimer cette absence du ${new Date(a.date).toLocaleDateString('fr-FR')} ?`, { confirmLabel: 'Supprimer' }))) return;
    const { error: delErr } = await supabase.from('absence_events').delete().eq('id', a.id);
    if (delErr) { setError(translateError(delErr)); return; }
    showToast('Supprimé');
    reload();
  }

  async function handleDeleteLate(l) {
    if (!(await confirm(`Supprimer ce retard du ${new Date(l.date).toLocaleDateString('fr-FR')} ?`, { confirmLabel: 'Supprimer' }))) return;
    const { error: delErr } = await supabase.from('late_events').delete().eq('id', l.id);
    if (delErr) { setError(translateError(delErr)); return; }
    showToast('Supprimé');
    reload();
  }

  if (!schoolYear) return null;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!absences || !retards) return <div className="card-bold"><SkeletonRow count={3} avatar={false} /></div>;

  const nbAbsencesAppel = attendanceLegacy.filter((x) => x.statut === 'absent').length;
  const nbRetardsAppel = attendanceLegacy.filter((x) => x.statut === 'retard').length;

  const periodeLabel = schoolYear.date_debut && schoolYear.date_fin
    ? `du ${new Date(schoolYear.date_debut).toLocaleDateString('fr-FR')} au ${new Date(schoolYear.date_fin).toLocaleDateString('fr-FR')}`
    : `Année ${schoolYear.label}`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
          Absences et retards — {schoolYear.label}
        </p>
        <button
          type="button"
          onClick={() => setShowPrint(true)}
          style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
        >
          <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
          Imprimer / PDF
        </button>
      </div>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16, maxWidth: 700 }}>
        <MiniStat label="Absences" value={totalsAbs.count} color="var(--danger)" />
        <MiniStat label="Heures manquées" value={formatHeures(totalsAbs.heures)} color="var(--danger)" />
        <MiniStat label="Retards" value={totalsLate.count} color="var(--amber)" />
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setEditingAbsence(null); setAbsenceModalOpen(true); }}
            style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer' }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            Ajouter une absence
          </button>
          <button
            type="button"
            onClick={() => { setEditingLate(null); setLateModalOpen(true); }}
            style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--amber)', color: '#fff', cursor: 'pointer' }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            Ajouter un retard
          </button>
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
        Absences ({totalsAbs.count})
      </p>
      {absences.length === 0 ? (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>Aucune absence détaillée pour cet élève.</p>
      ) : (
        <div className="card-bold" style={{ overflowX: 'auto', marginBottom: 20, maxWidth: 900 }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 100px 130px 70px', gap: 8, padding: '10px 16px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Date</span>
              <span>Motif</span>
              <span>Durée</span>
              <span>Demi-journée</span>
              <span>Justifié / Santé</span>
              <span></span>
            </div>
            {absences.map((a, i) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 100px 130px 70px', gap: 8, padding: '10px 16px', alignItems: 'center', borderBottom: i < absences.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                <span>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                <span style={{ color: categorieCouleur(a.absence_motifs?.categorie), fontWeight: 500 }}>{motifLabel(a)}</span>
                <span style={{ fontWeight: 600 }}>{formatHeures(a.duree_heures)}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{demiJourneeLabel(a.demi_journee)}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.justifie && <Badge color="success">Justifié</Badge>}
                  {a.sante && <Badge color="danger">Santé</Badge>}
                  {!a.justifie && !a.sante && <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                </span>
                <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {canManage && (
                    <>
                      <button type="button" onClick={() => { setEditingAbsence(a); setAbsenceModalOpen(true); }} title="Modifier" style={iconBtnStyle}>✎</button>
                      <button type="button" onClick={() => handleDeleteAbsence(a)} title="Supprimer" style={{ ...iconBtnStyle, color: 'var(--danger)' }}>✕</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
        Retards ({totalsLate.count})
      </p>
      {retards.length === 0 ? (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>Aucun retard détaillé pour cet élève.</p>
      ) : (
        <div className="card-bold" style={{ overflowX: 'auto', marginBottom: 20, maxWidth: 900 }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 70px 80px 1fr 1fr 70px', gap: 8, padding: '10px 16px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Date</span>
              <span>Début</span>
              <span>Durée</span>
              <span>Matière</span>
              <span>Motif</span>
              <span></span>
            </div>
            {retards.map((l, i) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '110px 70px 80px 1fr 1fr 70px', gap: 8, padding: '10px 16px', alignItems: 'center', borderBottom: i < retards.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                <span>{new Date(l.date).toLocaleDateString('fr-FR')}</span>
                <span style={{ fontWeight: 600 }}>{l.heure_debut?.slice(0, 5)}</span>
                <span>{formatMinutes(l.duree_minutes)}</span>
                <span style={{ color: 'var(--muted)' }}>{l.matiere || '—'}</span>
                <span style={{ color: categorieCouleur(l.absence_motifs?.categorie) }}>{motifLabel(l)}</span>
                <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {canManage && (
                    <>
                      <button type="button" onClick={() => { setEditingLate(l); setLateModalOpen(true); }} title="Modifier" style={iconBtnStyle}>✎</button>
                      <button type="button" onClick={() => handleDeleteLate(l)} title="Supprimer" style={{ ...iconBtnStyle, color: 'var(--danger)' }}>✕</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(nbAbsencesAppel > 0 || nbRetardsAppel > 0) && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Appel rapide de classe (à titre informatif)
          </p>
          <div className="card-bold" style={{ padding: '12px 16px', maxWidth: 900 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
              <strong>{nbAbsencesAppel}</strong> absence{nbAbsencesAppel > 1 ? 's' : ''} et <strong>{nbRetardsAppel}</strong> retard{nbRetardsAppel > 1 ? 's' : ''} marqués lors de l'appel quotidien. Ces données complètent les absences détaillées ci-dessus.
            </p>
          </div>
        </div>
      )}

      {absenceModalOpen && (
        <AbsenceModal
          schoolId={profile.school_id}
          schoolYearId={yearId}
          studentId={studentId}
          motifs={motifs}
          editing={editingAbsence}
          onClose={() => { setAbsenceModalOpen(false); setEditingAbsence(null); }}
          onSaved={() => { setAbsenceModalOpen(false); setEditingAbsence(null); reload(); }}
        />
      )}
      {lateModalOpen && (
        <LateModal
          schoolId={profile.school_id}
          schoolYearId={yearId}
          studentId={studentId}
          motifs={motifs}
          editing={editingLate}
          onClose={() => { setLateModalOpen(false); setEditingLate(null); }}
          onSaved={() => { setLateModalOpen(false); setEditingLate(null); reload(); }}
        />
      )}
      {showPrint && (
        <AbsencesPrintModal
          school={profile.schools}
          studentName={studentName}
          classeNom={classeNom}
          studentMatricule={studentMatricule}
          dateNaissance={dateNaissance}
          schoolYear={schoolYear}
          absences={absences}
          retards={retards}
          totalsAbs={totalsAbs}
          totalsLate={totalsLate}
          periodeLabel={periodeLabel}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `var(--${color}-light)`, color: `var(--${color})` }}>
      {children}
    </span>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function AbsencesPrintModal({ school, studentName, classeNom, studentMatricule, dateNaissance, schoolYear, absences, retards, totalsAbs, totalsLate, periodeLabel, onClose }) {
  function triggerPrint() {
    printDocument(`recap-absences-${slug(studentName)}-${slug(schoolYear.label)}`);
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 780, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="print-sheet" style={{ padding: '26px 24px' }}>
          <DocumentHeader school={school} title="Récapitulatif absences et retards" subtitle={periodeLabel} />

          <p style={{ margin: '0 0 16px', fontSize: 13.5, fontWeight: 600 }}>
            {studentName}
            {classeNom ? ` — ${classeNom}` : ''}
            {studentMatricule ? ` (${studentMatricule})` : ''}
            {dateNaissance ? ` · né(e) le ${new Date(dateNaissance).toLocaleDateString('fr-FR')}` : ''}
          </p>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase' }}>
            Absences ({totalsAbs.count} · {formatHeures(totalsAbs.heures)} · {totalsAbs.demiJournees} demi-journées)
          </p>
          {absences.length === 0 ? (
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--muted)' }}>Aucune absence enregistrée.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Motif</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700 }}>Heures</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>Demi-j.</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>Justifié</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>Santé</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding: '6px 4px' }}>{motifLabel(a)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{formatHeures(a.duree_heures)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{demiJourneeLabel(a.demi_journee)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{a.justifie ? 'OUI' : 'NON'}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{a.sante ? 'OUI' : 'NON'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase' }}>
            Retards ({totalsLate.count} · {formatMinutes(totalsLate.minutes)})
          </p>
          {retards.length === 0 ? (
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--muted)' }}>Aucun retard enregistré.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Début</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700 }}>Durée</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Matière</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Motif</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>Justifié</th>
                </tr>
              </thead>
              <tbody>
                {retards.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(l.date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding: '6px 4px' }}>{l.heure_debut?.slice(0, 5)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{formatMinutes(l.duree_minutes)}</td>
                    <td style={{ padding: '6px 4px' }}>{l.matiere || '—'}</td>
                    <td style={{ padding: '6px 4px' }}>{motifLabel(l)}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{l.justifie ? 'OUI' : 'NON'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ margin: '12px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>
            Document généré le {new Date().toLocaleDateString('fr-FR')} à partir des données enregistrées dans EcoGès.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 24px 20px', borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={triggerPrint} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}>
            <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            Imprimer / PDF
          </button>
          <button type="button" onClick={onClose} style={{ fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const iconBtnStyle = { background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: '2px 6px', fontSize: 14, lineHeight: 1 };
