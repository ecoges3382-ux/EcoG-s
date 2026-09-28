import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses, stickyColStyle } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import ClassModal from '../components/ClassModal.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonTableRows } from '../components/Skeleton.jsx';

function BuildingIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" />
      <path d="M9 20v-4h6v4" />
      <path d="M8 7.5h1.2M8 11h1.2M14.8 7.5H16M14.8 11H16" />
    </svg>
  );
}

export default function Classes() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [classes, setClasses] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `classes_${profile.school_id}`,
      hasData: classes !== null,
      load: async () => {
        const { data: cl, error: clError } = await supabase.from('classes').select('*, staff ( full_name )');
        return clError ? { error: clError } : { data: sortClasses(cl) };
      },
      setData: setClasses,
      setOffline,
      onError: (err) => setError(err.message),
      onSuccess: () => setError(''),
    });
    const [{ data: en }, { data: te }] = await Promise.all([
      supabase.from('enrollments').select('classe_id').eq('school_year_id', schoolYear.id),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
    ]);
    setEnrollments(en || []);
    setTeachers(te || []);
  }

  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleDelete(c) {
    if (!(await confirm(`Supprimer la classe ${c.nom} ?`, { confirmLabel: 'Supprimer' }))) return;
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
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Classes</p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle classe
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!classes && <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>}

      {classes && classes.length === 0 && (
        <div className="card-bold">
          <EmptyState
            icon={<BuildingIcon />}
            title="Aucune classe pour l'instant"
            subtitle="Crée tes classes pour pouvoir y inscrire des élèves et leur assigner un emploi du temps."
            actionLabel="Créer ma première classe"
            onAction={() => { setEditing(null); setModalOpen(true); }}
          />
        </div>
      )}
      {classes && classes.length > 0 && (
        <div className="card-bold" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 0.9fr 0.8fr 1.6fr 0.7fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Classe</span><span>Niveau</span><span>Salle</span><span>Effectif</span><span>Prof. principal</span><span></span>
            </div>
            {classes.map((c, i) => {
              const effectif = enrollments.filter((e) => e.classe_id === c.id).length;
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 0.9fr 0.8fr 1.6fr 0.7fr', gap: 8, padding: '13px 20px 13px 0', alignItems: 'center', borderBottom: i < classes.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, ...stickyColStyle('var(--paper)'), paddingLeft: 20 }}>{c.nom}</span>
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
