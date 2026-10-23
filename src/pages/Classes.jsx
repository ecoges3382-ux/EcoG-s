import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses, stickyColStyle, stickyRightColStyle, stickyHeaderStyle } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import ClassModal from '../components/ClassModal.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonTableRows } from '../components/Skeleton.jsx';

function BuildingIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" /><path d="M9 20v-4h6v4" /><path d="M8 7.5h1.2M8 11h1.2M14.8 7.5H16M14.8 11H16" />
    </svg>
  );
}

// --- ICÔNES SVG ---
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  );
}
// -----------------

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const gridCols = selectMode ? '28px 1fr 0.9fr 0.9fr 0.8fr 1.6fr 80px' : '1fr 0.9fr 0.9fr 0.8fr 1.6fr 80px';

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

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = classes.map((c) => c.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleDeleteOne(c) {
    if (!(await confirm(`Supprimer la classe ${c.nom} ?`, { confirmLabel: 'Supprimer' }))) return;
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', c.id);
    if (deleteError) {
      setError(deleteError.code === '23503' ? `Impossible de supprimer « ${c.nom} » : des élèves y sont encore inscrits.` : deleteError.message);
      return;
    }
    reload();
  }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} classe${selectedIds.length > 1 ? 's' : ''} ? Cette action est irréversible.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('classes').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { 
      setError(deleteError.message.includes('violates foreign key') ? "Impossible de supprimer : des élèves sont encore inscrits dans une de ces classes." : deleteError.message); 
      return; 
    }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
          Classes
        </p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {!selectMode && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle classe
            </button>
          )}
          {classes && classes.length > 0 && !selectMode && (
            <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
              Sélectionner
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!classes && <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>}

      {classes && classes.length === 0 && (
        <div className="card-bold">
          <EmptyState icon={<BuildingIcon />} title="Aucune classe pour l'instant" subtitle="Crée tes classes pour pouvoir y inscrire des élèves et leur assigner un emploi du temps." actionLabel="Créer ma première classe" onAction={() => { setEditing(null); setModalOpen(true); }} />
        </div>
      )}
      {classes && classes.length > 0 && (
        <div className="card-bold" style={{ overflowX: 'scroll', maxHeight: 'calc(100vh - 220px)', overflowY: 'scroll', scrollbarGutter: 'stable' }}>
          <div style={{ minWidth: selectMode ? 720 : 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '12px 20px' : '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
              {selectMode && <span></span>}
              <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: selectMode ? 0 : 20 }}>Classe</span><span>Niveau</span><span>Salle</span><span>Effectif</span><span>Prof. principal</span>
              {!selectMode && <span style={{ ...stickyRightColStyle('var(--forest-light)'), paddingRight: 20 }}></span>}
            </div>
            {classes.map((c, i) => {
              const effectif = enrollments.filter((e) => e.classe_id === c.id).length;
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '13px 20px' : '13px 20px 13px 0', alignItems: 'center', borderBottom: i < classes.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  {selectMode && <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleOne(c.id)} />}
                  <span style={{ fontSize: '13.5px', fontWeight: 600, ...stickyColStyle('var(--paper)'), paddingLeft: selectMode ? 0 : 20 }}>{c.nom}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.niveau}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.salle || '—'}</span>
                  <span style={{ fontSize: 13 }}>{effectif}{c.capacite ? ` / ${c.capacite}` : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.staff?.full_name || '—'}</span>
                  
                  {!selectMode && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', ...stickyRightColStyle('var(--paper)'), paddingRight: 20 }}>
                      <button onClick={() => { setEditing(c); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }} title="Modifier">
                        <PencilIcon />
                      </button>
                      <button onClick={() => handleDeleteOne(c)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Supprimer">
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>L'effectif est compté à partir des inscriptions de l'année scolaire en cours{schoolYear ? ` (${schoolYear.label})` : ''}.</p>
      {selectMode && <SelectionBar count={selectedIds.length} allSelected={classes && classes.length > 0 && classes.every((c) => selectedIds.includes(c.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />}
      {modalOpen && <ClassModal schoolId={profile.school_id} teachers={teachers} editing={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); reload(); }} />}
    </div>
  );
}
