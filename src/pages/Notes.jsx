import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Dropdown from '../components/Dropdown.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonTableRows } from '../components/Skeleton.jsx';
import { PERIODES_BULLETIN, periodeMoyenneGenerale, annualMoyenneGenerale, subjectPeriodeMoyenne, subjectAnnualMoyenne } from '../lib/bulletin.js';

const TYPES = [
  { id: 'controle', label: 'Interrogation', labelPluriel: 'Interrogations' },
  { id: 'devoir', label: 'Devoir', labelPluriel: 'Devoirs' },
  { id: 'examen', label: 'Examen', labelPluriel: 'Examens' },
];

const PERIODES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Semestre 1', 'Semestre 2'];

export default function Notes() {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  // Trois filtres en cascade : Classe → Élève (filtré par la classe) →
  // Matière (filtrée par la classe), tous par défaut sur 'Tout' — voir
  // discussion terrain : sélectionner un élève précis doit restreindre la
  // liste à ses seules notes, sans quoi les trois menus n'auraient aucun
  // intérêt par rapport aux boutons niveau d'avant.
  const [niveau, setNiveau] = useState('Tout');
  const [eleveId, setEleveId] = useState('Tout');
  const [matiereId, setMatiereId] = useState('Tout');
  const [periode, setPeriode] = useState(null); // null = pas encore initialisé (voir reload)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité. Les 3 requêtes
  // sont mises en cache ensemble : les notes référencent des matières et
  // des élèves, jamais mélangés avec une autre version des deux.
  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `notes_${schoolYear.id}`,
      hasData: grades !== null,
      load: async () => {
        const [{ data: enr }, { data: su }, { data: gr, error: grError }] = await Promise.all([
          supabase.from('enrollments').select('classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id),
          supabase.from('subjects').select('id, nom, coefficient, niveau').order('nom'),
          supabase.from('grades').select('*, students ( full_name ), subjects ( nom, coefficient )').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false }),
        ]);
        if (grError) return { error: grError };
        const st = (enr || [])
          .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—' }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
        return { data: { grades: gr, students: st, subjects: su || [] } };
      },
      setData: ({ grades: g, students: st, subjects: su }) => {
        setGrades(g);
        setStudents(st);
        setSubjects(su);
        // Trimestre le plus récemment saisi par défaut (grades est trié par
        // date de saisie décroissante) plutôt qu'un mélange de tout —
        // exactement ce qui rendait la liste illisible : interros, devoirs
        // et examens de tous les trimestres confondus dans un seul flux.
        if (periode === null) {
          const dernier = g.find((gr) => PERIODES_BULLETIN.includes(gr.periode))?.periode;
          setPeriode(dernier || 'Trimestre 1');
        }
      },
      setOffline,
      onError: (err) => setError(err.message),
      onSuccess: () => setError(''),
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  async function handleDelete(g) {
    if (!(await confirm(`Supprimer la note de ${g.students?.full_name || 'cet élève'} en ${g.subjects?.nom} (${g.note}/${g.sur}) ? Cette action est irréversible.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('grades').delete().eq('id', g.id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    showToast('Supprimé');
    reload();
  }

  const niveauxPresents = useMemo(() => [...new Set(students.map((s) => s.niveau))].sort(), [students]);
  const niveauByStudent = useMemo(() => new Map(students.map((s) => [s.id, s.niveau])), [students]);
  const studentsForNiveau = niveau === 'Tout' ? students : students.filter((s) => s.niveau === niveau);
  const subjectsForNiveau = niveau === 'Tout' ? subjects : subjects.filter((su) => !su.niveau || su.niveau === niveau);

  // Changer de classe invalide potentiellement l'élève/la matière déjà
  // choisis (ex. un élève de CM2 sélectionné, puis la classe passe à CE1) —
  // on revient alors sur 'Tout' plutôt que de garder une sélection devenue
  // incohérente.
  function handleNiveauChange(n) {
    setNiveau(n);
    setEleveId('Tout');
    setMatiereId('Tout');
  }

  let scopedGrades = grades || [];
  if (niveau !== 'Tout') scopedGrades = scopedGrades.filter((g) => niveauByStudent.get(g.student_id) === niveau);
  if (matiereId !== 'Tout') scopedGrades = scopedGrades.filter((g) => g.subject_id === matiereId);
  if (eleveId !== 'Tout') scopedGrades = scopedGrades.filter((g) => g.student_id === eleveId);
  // "Toutes les périodes" reste possible (bouton dédié), mais le filtre par
  // trimestre est ce qui règle le vrai problème : sans lui, interros,
  // devoirs et examens de tous les trimestres s'affichaient ensemble, sans
  // aucun moyen de les distinguer d'un coup d'œil.
  const filteredGrades = periode === 'Tous' ? scopedGrades : scopedGrades.filter((g) => g.periode === periode);
  const groupesParType = TYPES
    .map((t) => ({ ...t, items: filteredGrades.filter((g) => g.type === t.id) }))
    .filter((t) => t.items.length > 0);

  // Classement : uniquement pertinent en vue d'ensemble (élève === 'Tout') —
  // dès qu'un élève précis est choisi, il n'y a plus personne à classer
  // contre lui dans cette vue. Même calcul que le bulletin (src/lib/bulletin.js,
  // pondéré toutes matières) sauf si une matière précise est sélectionnée, où
  // le classement se fait alors sur cette seule matière — jamais une
  // deuxième formule pour le même chiffre.
  const classement = useMemo(() => {
    if (eleveId !== 'Tout') return [];
    return studentsForNiveau
      .map((s) => ({
        name: s.full_name,
        moyenne: matiereId === 'Tout'
          ? (periode === 'Tous' ? annualMoyenneGenerale(subjects, grades || [], s.id) : periodeMoyenneGenerale(subjects, grades || [], s.id, periode))
          : (periode === 'Tous' ? subjectAnnualMoyenne(grades || [], s.id, matiereId) : subjectPeriodeMoyenne(grades || [], s.id, matiereId, periode)),
      }))
      .filter((c) => c.moyenne != null)
      .sort((a, b) => b.moyenne - a.moyenne);
  }, [studentsForNiveau, eleveId, matiereId, subjects, grades, periode]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Notes</p>
        <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Saisir une note
        </button>
      </div>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <Dropdown
          label="Classe"
          value={niveau}
          onChange={handleNiveauChange}
          options={['Tout', ...niveauxPresents]}
        />
        <Dropdown
          label="Élève"
          value={eleveId}
          onChange={setEleveId}
          options={[{ value: 'Tout', label: 'Tout' }, ...studentsForNiveau.map((s) => ({ value: s.id, label: s.full_name }))]}
        />
        <Dropdown
          label="Matière"
          value={matiereId}
          onChange={setMatiereId}
          options={[{ value: 'Tout', label: 'Tout' }, ...subjectsForNiveau.map((s) => ({ value: s.id, label: s.nom }))]}
        />
      </div>
      {niveauxPresents.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Aucun élève inscrit pour l'instant.</p>}

      {/* Sans ce filtre, interros/devoirs/examens de tous les trimestres
          s'affichaient dans un seul flux — impossible à distinguer d'un
          coup d'œil. Un trimestre à la fois, plus "Tous" pour l'exception
          (retrouver une note saisie par semestre, cas déjà documenté comme
          hors bulletin dans bulletin.js). */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {[...PERIODES_BULLETIN, 'Tous'].map((p) => (
          <button key={p} onClick={() => setPeriode(p)} style={toggleStyle(p === periode)}>{p}</button>
        ))}
      </div>

      {!grades && <div className="card-bold"><SkeletonTableRows count={6} columns={3} /></div>}

      {grades && (
        <div style={eleveId === 'Tout' ? { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 } : undefined} className={eleveId === 'Tout' ? 'desktop-grid-3' : undefined}>
          <div>
            {groupesParType.map((groupe) => (
              <div key={groupe.id} className="card-bold" style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '10px 18px', background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{groupe.labelPluriel}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)' }}>{groupe.items.length}</span>
                </div>
                {groupe.items.map((g, i) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < groupe.items.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 600 }}>{g.students?.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                        {g.subjects?.nom}{periode === 'Tous' ? ` · ${g.periode}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>{g.note}/{g.sur}</span>
                      <button
                        type="button"
                        onClick={() => setEditingGrade(g)}
                        title="Modifier"
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                      >
                        <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g)}
                        disabled={deleting}
                        title="Supprimer"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex', opacity: deleting ? 0.6 : 1 }}
                      >
                        <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {groupesParType.length === 0 && (
              <div className="card-bold" style={{ padding: 20 }}>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Aucune note pour {periode === 'Tous' ? "l'instant" : periode.toLowerCase()}.</p>
              </div>
            )}
          </div>

          {eleveId === 'Tout' && (
            <div className="card-bold" style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                Classement — {periode === 'Tous' ? 'moyenne annuelle' : `moyenne ${periode.toLowerCase()}`}
              </p>
              {classement.map((c, i) => (
                <div key={c.name + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < classement.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 13 }}>{i + 1}. {c.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.moyenne.toFixed(1)}</span>
                </div>
              ))}
              {classement.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>—</p>}
            </div>
          )}
        </div>
      )}

      {modalOpen && schoolYear && (
        <NewGradeModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          subjects={subjects}
          defaultNiveau={niveau !== 'Tout' ? niveau : undefined}
          defaultPeriode={PERIODES_BULLETIN.includes(periode) ? periode : undefined}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}

      {editingGrade && (
        <NewGradeModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          subjects={subjects}
          defaultNiveau={niveauByStudent.get(editingGrade.student_id)}
          editing={editingGrade}
          onClose={() => setEditingGrade(null)}
          onCreated={() => { setEditingGrade(null); reload(); }}
        />
      )}
    </div>
  );
}

function NewGradeModal({ schoolId, schoolYearId, students, subjects, defaultNiveau, defaultPeriode, editing, onClose, onCreated }) {
  const showToast = useToast();
  // Formulaire volontairement indépendant des filtres de la page (Classe /
  // Élève / Matière au-dessus) : il garde son propre état, initialisé à la
  // classe passée en contexte (édition, ou filtre page si ce n'est pas
  // 'Tout') sinon à la première classe disponible — jamais 'Tout' lui-même,
  // qui n'est pas une vraie classe.
  const [niveau, setNiveau] = useState(defaultNiveau || [...new Set(students.map((s) => s.niveau))].sort()[0] || '');
  const studentsInNiveau = students.filter((s) => s.niveau === niveau);
  const subjectsForNiveau = subjects.filter((su) => !su.niveau || su.niveau === niveau);

  const [studentId, setStudentId] = useState(editing ? editing.student_id : (studentsInNiveau[0]?.id || ''));
  const [subjectId, setSubjectId] = useState(editing ? editing.subject_id : (subjectsForNiveau[0]?.id || ''));
  const [type, setType] = useState(editing?.type || 'controle');
  const [note, setNote] = useState(editing ? String(editing.note) : '');
  const [sur, setSur] = useState(editing ? editing.sur : 20);
  const [periode, setPeriode] = useState(editing?.periode || defaultPeriode || 'Trimestre 1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleNiveauChange(n) {
    setNiveau(n);
    const stu = students.filter((s) => s.niveau === n);
    const subs = subjects.filter((su) => !su.niveau || su.niveau === n);
    setStudentId(stu[0]?.id || '');
    setSubjectId(subs[0]?.id || '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId || !subjectId || note === '' || !sur) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = { student_id: studentId, subject_id: subjectId, type, note: Number(note), sur: Number(sur), periode };
    const { error: saveError } = editing
      ? await supabase.from('grades').update(payload).eq('id', editing.id)
      : await supabase.from('grades').insert({ school_id: schoolId, school_year_id: schoolYearId, ...payload });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    showToast('Enregistré');
    onCreated();
  }

  // Portal vers document.body : sans lui, ce modal se retrouve piégé dans
  // le contexte d'empilement créé par l'animation de transition de page
  // (.page-transition, voir Shell.jsx), et passe derrière la barre du haut
  // et la barre de navigation du bas au lieu de les recouvrir.
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier la note' : 'Saisir une note'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <Dropdown value={niveau} onChange={handleNiveauChange} options={[...new Set(students.map((s) => s.niveau))].sort()} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Élève</label>
            <Dropdown value={studentId} onChange={setStudentId} options={studentsInNiveau.map((s) => ({ value: s.id, label: s.full_name }))} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Matière</label>
            <Dropdown value={subjectId} onChange={setSubjectId} options={subjectsForNiveau.map((s) => ({ value: s.id, label: s.nom }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <Dropdown value={type} onChange={setType} options={TYPES.map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Note</label>
            <input type="number" step="0.1" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Sur</label>
            <input type="number" step="1" min="1" value={sur} onChange={(e) => setSur(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Période</label>
        <Dropdown value={periode} onChange={setPeriode} options={PERIODES} style={{ ...inputStyle, marginBottom: 18 }} />

        {studentsInNiveau.length === 0 && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)' }}>Aucun élève dans ce niveau.</p>}
        {subjectsForNiveau.length === 0 && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)' }}>Aucune matière pour ce niveau — ajoute-la d'abord dans « Matières ».</p>}
        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting || studentsInNiveau.length === 0 || subjectsForNiveau.length === 0} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function toggleStyle(active) {
  return {
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
    background: active ? 'var(--forest)' : 'var(--paper)', color: active ? '#fff' : 'var(--ink)',
  };
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
