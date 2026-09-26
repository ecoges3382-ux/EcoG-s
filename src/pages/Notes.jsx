import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { useToast } from '../components/Toast.jsx';

const TYPES = [
  { id: 'controle', label: 'Interrogation' },
  { id: 'devoir', label: 'Devoir' },
  { id: 'examen', label: 'Examen' },
];

const PERIODES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Semestre 1', 'Semestre 2'];

export default function Notes() {
  const { profile } = useAuth();
  const showToast = useToast();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState(null);
  const [error, setError] = useState('');
  const [niveau, setNiveau] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité.
  async function reload() {
    if (!schoolYear) return;
    const [{ data: enr }, { data: su }, { data: gr, error: grError }] = await Promise.all([
      supabase.from('enrollments').select('classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id),
      supabase.from('subjects').select('id, nom, coefficient, niveau').order('nom'),
      supabase.from('grades').select('*, students ( full_name ), subjects ( nom, coefficient )').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false }),
    ]);
    if (grError) { setError(grError.message); return; }
    const st = (enr || [])
      .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—' }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    setGrades(gr);
    setStudents(st);
    setSubjects(su || []);
    if (!niveau && st.length) setNiveau(st[0].niveau);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  async function handleDelete(g) {
    if (!window.confirm(`Supprimer la note de ${g.students?.full_name || 'cet élève'} en ${g.subjects?.nom} (${g.note}/${g.sur}) ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('grades').delete().eq('id', g.id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    showToast('Supprimé');
    reload();
  }

  const niveauxPresents = useMemo(() => [...new Set(students.map((s) => s.niveau))].sort(), [students]);
  const niveauByStudent = useMemo(() => new Map(students.map((s) => [s.id, s.niveau])), [students]);
  const filteredGrades = niveau ? (grades || []).filter((g) => niveauByStudent.get(g.student_id) === niveau) : (grades || []);

  const classement = useMemo(() => {
    const byStudent = new Map();
    filteredGrades.forEach((g) => {
      const key = g.student_id;
      if (!byStudent.has(key)) byStudent.set(key, { name: g.students?.full_name || '—', total: 0, count: 0 });
      const entry = byStudent.get(key);
      entry.total += (Number(g.note) / Number(g.sur)) * 20;
      entry.count += 1;
    });
    return [...byStudent.values()]
      .map((e) => ({ name: e.name, moyenne: e.total / e.count }))
      .sort((a, b) => b.moyenne - a.moyenne);
  }, [filteredGrades]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Notes</p>
        <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Saisir une note
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {niveauxPresents.map((n) => (
          <button key={n} onClick={() => setNiveau(n)} style={toggleStyle(n === niveau)}>{n}</button>
        ))}
        {niveauxPresents.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun élève inscrit pour l'instant.</p>}
      </div>

      {!grades && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {grades && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }} className="desktop-grid-3">
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {filteredGrades.slice(0, 30).map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < Math.min(filteredGrades.length, 30) - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 600 }}>{g.students?.full_name}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{g.subjects?.nom} · {TYPES.find((t) => t.id === g.type)?.label} · {g.periode}</p>
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
            {filteredGrades.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune note pour l'instant.</p>}
          </div>

          <div className="card-bold" style={{ padding: '16px 18px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Classement (moyennes /20)</p>
            {classement.map((c, i) => (
              <div key={c.name + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < classement.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13 }}>{i + 1}. {c.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.moyenne.toFixed(1)}</span>
              </div>
            ))}
            {classement.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>—</p>}
          </div>
        </div>
      )}

      {modalOpen && schoolYear && (
        <NewGradeModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          subjects={subjects}
          defaultNiveau={niveau}
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
          defaultNiveau={niveauByStudent.get(editingGrade.student_id) || niveau}
          editing={editingGrade}
          onClose={() => setEditingGrade(null)}
          onCreated={() => { setEditingGrade(null); reload(); }}
        />
      )}
    </div>
  );
}

function NewGradeModal({ schoolId, schoolYearId, students, subjects, defaultNiveau, editing, onClose, onCreated }) {
  const showToast = useToast();
  const [niveau, setNiveau] = useState(defaultNiveau || '');
  const studentsInNiveau = students.filter((s) => s.niveau === niveau);
  const subjectsForNiveau = subjects.filter((su) => !su.niveau || su.niveau === niveau);

  const [studentId, setStudentId] = useState(editing ? editing.student_id : (studentsInNiveau[0]?.id || ''));
  const [subjectId, setSubjectId] = useState(editing ? editing.subject_id : (subjectsForNiveau[0]?.id || ''));
  const [type, setType] = useState(editing?.type || 'controle');
  const [note, setNote] = useState(editing ? String(editing.note) : '');
  const [sur, setSur] = useState(editing ? editing.sur : 20);
  const [periode, setPeriode] = useState(editing?.periode || 'Trimestre 1');
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

  return (
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
            <select value={niveau} onChange={(e) => handleNiveauChange(e.target.value)} style={inputStyle}>
              {[...new Set(students.map((s) => s.niveau))].sort().map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Élève</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={inputStyle}>
              {studentsInNiveau.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Matière</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={inputStyle}>
              {subjectsForNiveau.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
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
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}>
          {PERIODES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

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
    </div>
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
