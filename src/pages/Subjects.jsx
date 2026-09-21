import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';

export default function Subjects() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function reload() {
    // Le niveau proposé pour une matière est celui des classes réellement
    // créées par l'école (page Classes), pas une liste générique
    // maternelle→terminale qui n'aurait aucun sens pour un établissement
    // qui ne couvre pas tous ces niveaux.
    const [{ data: su, error: suError }, { data: te }, { data: cl }] = await Promise.all([
      supabase.from('subjects').select('*, staff ( full_name )').order('nom'),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
      supabase.from('classes').select('id, nom, niveau, section'),
    ]);
    if (suError) setError(suError.message);
    else setSubjects(su);
    setTeachers(te || []);
    setClasses(sortClasses(cl || []));
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(s) {
    if (!window.confirm(`Supprimer la matière ${s.nom} ?`)) return;
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', s.id);
    if (deleteError) {
      // 23503 = violation de clé étrangère (RESTRICT) : la base bloque la
      // suppression tant que des notes existent pour cette matière, plutôt
      // que de les supprimer en cascade — voir schema.sql.
      setError(
        deleteError.code === '23503'
          ? `Impossible de supprimer « ${s.nom} » : des notes existantes utilisent encore cette matière.`
          : deleteError.message,
      );
      return;
    }
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Matières</p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle matière
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!subjects && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {subjects && (
        <div className="card-bold" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 1fr 1.4fr 0.8fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Matière</span><span>Coef.</span><span>Niveau</span><span>Enseignant</span><span></span>
            </div>
            {subjects.map((s, i) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 1fr 1.4fr 0.8fr', padding: '13px 20px', alignItems: 'center', borderBottom: i < subjects.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.nom}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-light)', padding: '3px 9px', borderRadius: 20, width: 'fit-content' }}>×{s.coefficient}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau || 'Tous niveaux'}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.staff?.full_name || '—'}</span>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setEditing(s); setModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }} title="Modifier">
                    <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>
                  </button>
                  <button onClick={() => handleDelete(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Supprimer">
                    <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            ))}
            {subjects.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune matière pour l'instant.</p>}
          </div>
        </div>
      )}

      {modalOpen && (
        <SubjectModal
          schoolId={profile.school_id}
          teachers={teachers}
          classes={classes}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function SubjectModal({ schoolId, teachers, classes, editing, onClose, onSaved }) {
  const [nom, setNom] = useState(editing?.nom || '');
  const [coefficient, setCoefficient] = useState(editing?.coefficient ?? 1);
  const [niveau, setNiveau] = useState(editing?.niveau || '');
  const [enseignantId, setEnseignantId] = useState(editing?.enseignant_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom de la matière est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      nom: nom.trim(),
      coefficient: Number(coefficient) || 1,
      niveau: niveau || null,
      enseignant_id: enseignantId || null,
    };
    const { error: saveError } = editing
      ? await supabase.from('subjects').update(payload).eq('id', editing.id)
      : await supabase.from('subjects').insert({ school_id: schoolId, ...payload });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier la matière' : 'Nouvelle matière'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <label style={labelStyle}>Nom de la matière</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Mathématiques" style={inputStyle} />

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Coefficient</label>
            <input type="number" min="1" step="1" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Niveau concerné</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inputStyle}>
              <option value="">Tous niveaux</option>
              {classes.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>Enseignant responsable</label>
        <select value={enseignantId} onChange={(e) => setEnseignantId(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}>
          <option value="">—</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
