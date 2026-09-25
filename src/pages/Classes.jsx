import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import ClassModal from '../components/ClassModal.jsx';

export default function Classes() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [classes, setClasses] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function reload() {
    if (!schoolYear) return;
    const [{ data: cl, error: clError }, { data: en }, { data: te }] = await Promise.all([
      supabase.from('classes').select('*, staff ( full_name )'),
      supabase.from('enrollments').select('classe_id').eq('school_year_id', schoolYear.id),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
    ]);
    if (clError) setError(clError.message);
    else setClasses(sortClasses(cl));
    setEnrollments(en || []);
    setTeachers(te || []);
  }

  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleDelete(c) {
    if (!window.confirm(`Supprimer la classe ${c.nom} ?`)) return;
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', c.id);
    if (deleteError) {
      // 23503 = violation de clé étrangère (RESTRICT) : la base bloque la
      // suppression tant que des inscriptions existent pour cette classe,
      // plutôt que de les orpheliner silencieusement — voir schema.sql.
      setError(
        deleteError.code === '23503'
          ? `Impossible de supprimer « ${c.nom} » : des élèves y sont encore inscrits (cette année ou une année précédente).`
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
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Classes</p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle classe
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!classes && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {classes && (
        <div className="card-bold" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr 0.8fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Classe</span><span>Niveau</span><span>Salle</span><span>Effectif</span><span>Prof. principal</span><span></span>
            </div>
            {classes.map((c, i) => {
              const effectif = enrollments.filter((e) => e.classe_id === c.id).length;
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr 0.8fr', padding: '13px 20px', alignItems: 'center', borderBottom: i < classes.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{c.nom}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.niveau}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.salle || '—'}</span>
                  <span style={{ fontSize: 13 }}>{effectif}{c.capacite ? ` / ${c.capacite}` : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.staff?.full_name || '—'}</span>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditing(c); setModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }} title="Modifier">
                      <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    </button>
                    <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Supprimer">
                      <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              );
            })}
            {classes.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune classe pour l'instant.</p>}
          </div>
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
        L'effectif est compté à partir des inscriptions de l'année scolaire en cours{schoolYear ? ` (${schoolYear.label})` : ''}.
      </p>

      {modalOpen && (
        <ClassModal
          schoolId={profile.school_id}
          teachers={teachers}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
