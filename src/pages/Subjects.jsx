import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import SubjectModal from '../components/SubjectModal.jsx';

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
