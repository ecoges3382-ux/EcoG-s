import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, sortClasses, NIVEAUX, fmtF } from '../lib/utils.js';
import FeeScheduleGrid from '../components/FeeScheduleGrid.jsx';
import MoneyInput from '../components/MoneyInput.jsx';
import NewStudentModal from '../components/NewStudentModal.jsx';
import { useToast } from '../components/Toast.jsx';
import Dropdown from '../components/Dropdown.jsx';

const CAN_MANAGE_ROLES = ['fondateur', 'directeur'];
const STEPS = [
  { id: 'tarifs', label: '1. Tarifs' },
  { id: 'eleves', label: '2. Élèves' },
  { id: 'resume', label: '3. Résumé & activation' },
];
const DECISIONS = [
  { id: 'a_traiter', label: 'À traiter', bg: '#F0EDE5', fg: 'var(--muted)' },
  { id: 'passe', label: 'Passe', bg: 'var(--success-light)', fg: 'var(--success)' },
  { id: 'redouble', label: 'Redouble', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  { id: 'part', label: "Quitte l'école", bg: 'var(--danger-light)', fg: 'var(--danger)' },
];

// Assistant de préparation d'une nouvelle année scolaire. L'année en
// préparation (statut='preparation') n'est jamais l'année active tant
// qu'elle n'est pas explicitement activée (dernière étape) — l'école
// continue de travailler normalement sur son année en cours pendant tout ce
// parcours. Rien ici ne modifie l'ancienne année ni son historique.
export default function PrepareSchoolYear() {
  const { profile } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [prep, setPrep] = useState(undefined); // undefined = chargement, null = aucune préparation
  const [oldYear, setOldYear] = useState(null);
  const [step, setStep] = useState('tarifs');
  const [error, setError] = useState('');

  async function reload() {
    const [{ data: prepData, error: prepError }, { data: oldData }] = await Promise.all([
      supabase.from('school_years').select('id, label, statut, date_debut, date_fin').eq('statut', 'preparation').maybeSingle(),
      supabase.from('school_years').select('id, label').eq('is_current', true).maybeSingle(),
    ]);
    if (prepError) { setError(prepError.message); return; }
    setPrep(prepData || null);
    setOldYear(oldData || null);
  }

  useEffect(() => { reload(); }, []);

  if (!canManage) {
    return <p style={{ color: 'var(--muted)' }}>Réservé au fondateur et au directeur.</p>;
  }
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;

  return (
    <div>
      <Link to="/parametres/annee-scolaire" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour à Année scolaire
      </Link>

      {prep === undefined && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {prep === null && <CreateYearForm oldYear={oldYear} onCreated={reload} />}

      {prep && (
        <>
          <p className="page-title" style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
            Préparer {prep.label}
          </p>
          {oldYear && (
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
              L'année en cours ({oldYear.label}) continue de fonctionner normalement pendant la préparation.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {STEPS.map((s) => (
              <button key={s.id} onClick={() => setStep(s.id)} style={tabStyle(step === s.id)}>{s.label}</button>
            ))}
          </div>

          {step === 'tarifs' && (
            <FeeScheduleGrid schoolId={profile.school_id} schoolYear={prep} canManage copyFromSchoolYearId={oldYear?.id} />
          )}
          {step === 'eleves' && (
            <TraiterElevesStep schoolId={profile.school_id} prep={prep} oldYearId={oldYear?.id} />
          )}
          {step === 'resume' && (
            <ResumeStep prep={prep} onActivated={() => { setStep('tarifs'); reload(); }} />
          )}
        </>
      )}
    </div>
  );
}

function tabStyle(active) {
  return {
    padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
    background: active ? 'var(--forest)' : 'var(--paper)', color: active ? '#fff' : 'var(--ink)',
  };
}

// Génère une plage d'années "AAAA-AAAA" plutôt que de laisser saisir du
// texte libre (source d'erreurs : tiret oublié, format incohérent d'une
// école à l'autre — voir school_years.label). Centrée sur l'année logique
// qui suit l'année active (déduite de son propre libellé si possible,
// sinon de la date du jour, même règle que provision_school côté SQL).
function computeYearOptions(oldLabel) {
  const now = new Date();
  const match = oldLabel && oldLabel.match(/^(\d{4})-(\d{4})$/);
  const nextStart = match ? Number(match[2]) : (now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
  const starts = [nextStart - 2, nextStart - 1, nextStart, nextStart + 1, nextStart + 2, nextStart + 3];
  return { options: starts.map((s) => `${s}-${s + 1}`), defaultLabel: `${nextStart}-${nextStart + 1}` };
}

function CreateYearForm({ oldYear, onCreated }) {
  const showToast = useToast();
  const { options, defaultLabel } = computeYearOptions(oldYear?.label);
  const [label, setLabel] = useState(defaultLabel);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('start_school_year_preparation', {
      p_label: label,
      p_date_debut: dateDebut || null,
      p_date_fin: dateFin || null,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    showToast('Enregistré');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="card-bold" style={{ padding: 26, maxWidth: 460 }}>
      <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Préparer la prochaine année</p>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        L'année en cours continue de fonctionner normalement pendant toute la préparation — rien
        n'est basculé tant que tu n'actives pas explicitement la nouvelle année, à la toute fin.
      </p>

      <label style={labelStyle}>Nom de l'année</label>
      <Dropdown value={label} onChange={setLabel} options={options} style={inputStyle} />

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Date de début (facultatif)</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Date de fin (facultatif)</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
        </div>
      </div>

      {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <button type="submit" disabled={submitting} style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Création…' : 'Créer et commencer la préparation'}
      </button>
    </form>
  );
}

// Traite chaque élève actuellement inscrit (passe / redouble / part / à
// traiter) — les lignes viennent de enrollment_decisions, pré-remplies et
// pré-classées automatiquement par start_school_year_preparation (moyenne
// annuelle comparée au seuil de passage — voir Paramètres → Année
// scolaire). Édition locale, un seul appel réseau pour tout enregistrer
// (comme l'appel de présences) plutôt qu'un aller-retour par élève.
function TraiterElevesStep({ schoolId, prep, oldYearId }) {
  const showToast = useToast();
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [feeByNiveau, setFeeByNiveau] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [filter, setFilter] = useState('tous');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  async function reload() {
    const [{ data: decisions, error: decError }, { data: cl }, { data: fees }, oldEnrResult] = await Promise.all([
      supabase.from('enrollment_decisions').select('*, students ( id, full_name, photo_url )').eq('school_year_id', prep.id),
      supabase.from('classes').select('id, nom, niveau, section'),
      supabase.from('fee_schedules').select('niveau, montant_scolarite, montant_connexe').eq('school_year_id', prep.id),
      oldYearId
        ? supabase.from('enrollments').select('student_id, classes ( nom, niveau, section )').eq('school_year_id', oldYearId)
        : Promise.resolve({ data: [] }),
    ]);
    if (decError) { setError(decError.message); return; }
    const sortedClasses = sortClasses(cl || []);
    setClasses(sortedClasses);
    const feeMap = {};
    (fees || []).forEach((f) => { feeMap[f.niveau] = f; });
    setFeeByNiveau(feeMap);
    const oldByStudent = new Map((oldEnrResult.data || []).map((e) => [e.student_id, e.classes]));
    setRows(
      (decisions || [])
        .map((d) => ({
          id: d.id,
          student_id: d.student_id,
          full_name: d.students?.full_name || '—',
          photo_url: d.students?.photo_url || null,
          oldClasse: oldByStudent.get(d.student_id) || null,
          decision: d.decision,
          classe_id: d.classe_id,
          montant_du: d.montant_du,
          frais_connexe_du: d.frais_connexe_du,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    );
  }

  useEffect(() => { reload(); }, [prep.id, oldYearId]);

  // Classe/montant suggérés pour un niveau cible donné (niveau supérieur
  // pour un passage, même niveau pour un redoublement) — même logique
  // utilisée par la classification automatique côté serveur, par le bouton
  // de masse, et par un changement de décision individuel : les trois
  // doivent proposer la même chose plutôt que de laisser un clic
  // individuel vide comme avant ce correctif.
  function suggestFor(niveauCible, oldClasse) {
    if (!niveauCible) return { classe_id: null, montant_du: 0, frais_connexe_du: 0 };
    const candidates = classes.filter((c) => c.niveau === niveauCible);
    const match = candidates.find((c) => c.section === oldClasse?.section) || candidates[0] || null;
    const fee = feeByNiveau[niveauCible];
    return {
      classe_id: match ? match.id : null,
      montant_du: fee ? fee.montant_scolarite : 0,
      frais_connexe_du: fee ? fee.montant_connexe : 0,
    };
  }

  function applyDecision(studentIds, decision) {
    setRows((prev) => prev.map((r) => {
      if (!studentIds.includes(r.student_id)) return r;
      if (decision === 'passe' && r.oldClasse) {
        return { ...r, decision, ...suggestFor(NIVEAUX[NIVEAUX.indexOf(r.oldClasse.niveau) + 1], r.oldClasse) };
      }
      if (decision === 'redouble' && r.oldClasse) {
        return { ...r, decision, ...suggestFor(r.oldClasse.niveau, r.oldClasse) };
      }
      return { ...r, decision };
    }));
    setSaved(false);
  }

  function updateRow(studentId, patch) {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function setClasse(studentId, classeId) {
    const classe = classes.find((c) => c.id === classeId);
    const fee = classe ? feeByNiveau[classe.niveau] : null;
    updateRow(studentId, {
      classe_id: classeId || null,
      montant_du: fee ? fee.montant_scolarite : 0,
      frais_connexe_du: fee ? fee.montant_connexe : 0,
    });
  }

  // Action de masse : ne touche que les élèves encore "à traiter" — jamais
  // une décision déjà prise (automatiquement ou à la main) — et propose une
  // classe du niveau pédagogique suivant (même section si possible). Reste
  // entièrement modifiable ligne par ligne avant l'enregistrement.
  function applyBulkPassage() {
    const ids = rows.filter((r) => r.decision === 'a_traiter' && r.oldClasse && NIVEAUX[NIVEAUX.indexOf(r.oldClasse.niveau) + 1]).map((r) => r.student_id);
    applyDecision(ids, 'passe');
  }

  function toggleSelected(studentId) {
    setSelectedIds((prev) => (prev.includes(studentId) ? prev.filter((x) => x !== studentId) : [...prev, studentId]));
  }
  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = filteredRows.map((r) => r.student_id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }
  function applyDecisionToSelection(decision) {
    applyDecision(selectedIds, decision);
    exitSelectMode();
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const payload = rows.map((r) => ({
      id: r.id,
      school_id: schoolId,
      school_year_id: prep.id,
      student_id: r.student_id,
      decision: r.decision,
      classe_id: r.decision === 'passe' || r.decision === 'redouble' ? r.classe_id : null,
      montant_du: r.decision === 'passe' || r.decision === 'redouble' ? Number(r.montant_du) || 0 : 0,
      frais_connexe_du: r.decision === 'passe' || r.decision === 'redouble' ? Number(r.frais_connexe_du) || 0 : 0,
    }));
    const { error: saveError } = await supabase.from('enrollment_decisions').upsert(payload, { onConflict: 'school_year_id,student_id' });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setSaved(true);
    showToast('Enregistré');
    reload();
  }

  async function addExistingStudent(studentId) {
    const { error: insertError } = await supabase.from('enrollment_decisions').insert({
      school_id: schoolId, school_year_id: prep.id, student_id: studentId, decision: 'a_traiter',
    });
    if (insertError) { setError(insertError.message); return; }
    setAddOpen(false);
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!rows) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const counts = { tous: rows.length, a_traiter: 0, passe: 0, redouble: 0, part: 0 };
  rows.forEach((r) => { counts[r.decision] += 1; });
  const filteredRows = filter === 'tous' ? rows : rows.filter((r) => r.decision === filter);
  const gridCols = selectMode ? '24px 1.5fr 1fr 1.3fr 1fr 1fr' : '1.6fr 1fr 1.3fr 1fr 1fr';

  return (
    <div style={{ paddingBottom: selectMode ? 70 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {rows.length} élève{rows.length > 1 ? 's' : ''} · {counts.a_traiter} à traiter
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={applyBulkPassage} style={secondaryButtonStyle}>Passage en classe supérieure pour les élèves restants</button>
          <button type="button" onClick={() => setAddOpen(true)} style={secondaryButtonStyle}>Ajouter un élève existant</button>
          <button type="button" onClick={() => setNewStudentOpen(true)} style={secondaryButtonStyle}>Nouvel élève</button>
          {!selectMode && <button type="button" onClick={() => setSelectMode(true)} style={secondaryButtonStyle}>Sélectionner</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { id: 'tous', label: 'Tous' },
          { id: 'a_traiter', label: 'À traiter' },
          { id: 'passe', label: 'Passe' },
          { id: 'redouble', label: 'Redouble' },
          { id: 'part', label: "Quitte l'école" },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={filterPillStyle(filter === f.id)}>
            {f.label} <span style={{ opacity: 0.7 }}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: selectMode ? 740 : 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
            {selectMode && <span></span>}
            <span>Élève</span><span>Classe actuelle</span><span>Décision</span><span>Nouvelle classe</span><span>Montant</span>
          </div>
          {filteredRows.map((r, i) => (
            <DecisionRow
              key={r.student_id}
              row={r}
              classes={classes}
              gridCols={gridCols}
              isLast={i === filteredRows.length - 1}
              selectMode={selectMode}
              selected={selectedIds.includes(r.student_id)}
              onToggleSelected={() => toggleSelected(r.student_id)}
              onDecision={(d) => applyDecision([r.student_id], d)}
              onClasse={(id) => setClasse(r.student_id, id)}
              onMontant={(field, v) => updateRow(r.student_id, { [field]: v })}
            />
          ))}
          {filteredRows.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève dans ce filtre.</p>}
        </div>
      </div>

      {error && <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 16, fontSize: 14, fontWeight: 600, padding: '12px 22px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Enregistrement…' : 'Enregistrer les décisions'}
      </button>
      {saved && <span style={{ marginLeft: 12, fontSize: '12.5px', color: 'var(--success)', fontWeight: 600 }}>Enregistré.</span>}

      {addOpen && (
        <AddExistingStudentModal excludeIds={rows.map((r) => r.student_id)} onClose={() => setAddOpen(false)} onAdd={addExistingStudent} />
      )}
      {newStudentOpen && (
        <NewStudentModal
          schoolId={schoolId}
          schoolYearId={prep.id}
          classes={classes}
          canManageParents={true}
          onClose={() => setNewStudentOpen(false)}
          onCreated={() => { setNewStudentOpen(false); reload(); }}
        />
      )}

      {selectMode && (
        <div
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 25,
            display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: 30, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '92vw',
            background: 'var(--forest-dark)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
          className="selection-bar"
        >
          <button type="button" onClick={exitSelectMode} style={selectionPillStyle()}>Annuler</button>
          <button type="button" onClick={toggleAllVisible} style={selectionPillStyle()}>Tout</button>
          <span style={{ minWidth: 22, textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: 13.5 }}>{selectedIds.length}</span>
          {DECISIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => applyDecisionToSelection(d.id)}
              style={{ ...selectionPillStyle(), opacity: selectedIds.length === 0 ? 0.5 : 1 }}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function filterPillStyle(active) {
  return {
    padding: '7px 14px', borderRadius: 20, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
    background: active ? 'var(--forest)' : 'var(--paper)', color: active ? '#fff' : 'var(--ink)',
  };
}

function selectionPillStyle() {
  return { padding: '9px 14px', borderRadius: 24, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff' };
}

function DecisionRow({ row, classes, gridCols, isLast, selectMode, selected, onToggleSelected, onDecision, onClasse, onMontant }) {
  const showClasse = row.decision === 'passe' || row.decision === 'redouble';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '13px 20px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid var(--line)', gap: 8 }}>
      {selectMode && <input type="checkbox" checked={selected} onChange={onToggleSelected} style={{ flexShrink: 0 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
          {row.photo_url ? <img src={row.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(row.full_name)}
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{row.full_name}</span>
      </div>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{row.oldClasse?.nom || '—'}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {DECISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onDecision(d.id)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '5px 9px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${row.decision === d.id ? d.fg : 'var(--line-strong)'}`,
              background: row.decision === d.id ? d.bg : 'var(--paper)',
              color: row.decision === d.id ? d.fg : 'var(--muted)',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      {showClasse ? (
        <Dropdown
          value={row.classe_id || ''}
          onChange={onClasse}
          options={[{ value: '', label: '— choisir —' }, ...classes.map((c) => ({ value: c.id, label: c.nom }))]}
          style={smallInputStyle}
        />
      ) : <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>}
      {showClasse ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', width: 46, flexShrink: 0 }}>Écolage</span>
            <MoneyInput value={row.montant_du} onChange={(v) => onMontant('montant_du', v)} style={smallInputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', width: 46, flexShrink: 0 }}>Connexes</span>
            <MoneyInput value={row.frais_connexe_du} onChange={(v) => onMontant('frais_connexe_du', v)} style={smallInputStyle} />
          </div>
        </div>
      ) : <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>}
    </div>
  );
}

function AddExistingStudentModal({ excludeIds, onClose, onAdd }) {
  const [students, setStudents] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('students').select('id, full_name, matricule').order('full_name').then(({ data }) => {
      setStudents((data || []).filter((s) => !excludeIds.includes(s.id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = (students || []).filter((s) => s.full_name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Ajouter un élève existant</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Pour un élève déjà présent dans les fiches de l'école (ex. absent l'année dernière, qui revient) — sa fiche n'est jamais recréée.
        </p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom…" style={inputStyle} />
        {students === null && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Chargement…</p>}
        {students !== null && filtered.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun élève trouvé.</p>}
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {filtered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onAdd(s.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 4px', border: 'none', borderTop: i > 0 ? '1px solid var(--line)' : 'none', background: 'none', cursor: 'pointer', fontSize: 13.5 }}
            >
              {s.full_name} {s.matricule ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {s.matricule}</span> : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResumeStep({ prep, onActivated }) {
  const showToast = useToast();
  const [decisions, setDecisions] = useState(null);
  const [directEnrollCount, setDirectEnrollCount] = useState(0);
  const [error, setError] = useState('');
  const [activating, setActivating] = useState(false);

  async function reload() {
    const [{ data: dec, error: decError }, { count }] = await Promise.all([
      supabase.from('enrollment_decisions').select('decision, montant_du').eq('school_year_id', prep.id),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('school_year_id', prep.id),
    ]);
    if (decError) { setError(decError.message); return; }
    setDecisions(dec || []);
    setDirectEnrollCount(count || 0);
  }

  useEffect(() => { reload(); }, [prep.id]);

  async function handleActivate() {
    if (!window.confirm(`Activer ${prep.label} maintenant ? L'année en cours sera clôturée (toujours consultable, mais les écrans de saisie basculeront sur ${prep.label}).`)) return;
    setActivating(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('activate_school_year', { p_school_year_id: prep.id });
    setActivating(false);
    if (rpcError) { setError(rpcError.message); return; }
    showToast('Année activée');
    onActivated();
  }

  if (error && !decisions) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!decisions) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const counts = { passe: 0, redouble: 0, part: 0, a_traiter: 0 };
  let totalDu = 0;
  decisions.forEach((d) => {
    counts[d.decision] = (counts[d.decision] || 0) + 1;
    if (d.decision === 'passe' || d.decision === 'redouble') totalDu += Number(d.montant_du) || 0;
  });
  const canActivate = counts.a_traiter === 0;

  return (
    <div>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <Stat label="Passages" value={counts.passe} color="var(--success)" />
        <Stat label="Redoublements" value={counts.redouble} color="var(--amber)" />
        <Stat label="Départs" value={counts.part} color="var(--danger)" />
        <Stat label="À traiter" value={counts.a_traiter} color={counts.a_traiter > 0 ? 'var(--danger)' : 'var(--muted)'} />
      </div>

      {directEnrollCount > 0 && (
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
          + {directEnrollCount} nouvel(aux) élève(s) déjà inscrit(s) directement dans {prep.label} pendant la préparation (non compté ci-dessus).
        </p>
      )}

      <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 20, maxWidth: 420 }}>
        <p style={{ margin: '0 0 4px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total des montants dus prévus</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, color: 'var(--forest-dark)' }}>{fmtF(totalDu)}</p>
      </div>

      {!canActivate && (
        <div className="card-bold" style={{ padding: '14px 18px', marginBottom: 18, maxWidth: 520, background: 'var(--danger-light)', borderColor: 'var(--danger)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
            {counts.a_traiter} élève{counts.a_traiter > 1 ? 's' : ''} encore à traiter — l'activation est impossible tant qu'il en reste. Reviens à l'étape « Élèves ».
          </p>
        </div>
      )}

      {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <button
        type="button"
        onClick={handleActivate}
        disabled={!canActivate || activating}
        style={{ fontSize: 14, fontWeight: 600, padding: '13px 24px', borderRadius: 10, border: 'none', background: canActivate ? 'var(--forest)' : 'var(--line)', color: canActivate ? '#fff' : 'var(--muted)', cursor: canActivate ? 'pointer' : 'default', opacity: activating ? 0.7 : 1 }}
      >
        {activating ? 'Activation…' : `Activer ${prep.label}`}
      </button>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const smallInputStyle = { width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 12.5, boxSizing: 'border-box', color: 'var(--ink)' };
const secondaryButtonStyle = { fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' };
