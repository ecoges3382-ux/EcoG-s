import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses, stickyColStyle, stickyHeaderStyle } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import SubjectModal from '../components/SubjectModal.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonTableRows } from '../components/Skeleton.jsx';
import { translateError } from '../lib/errors.js';

function BookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5c0-1 .8-1.5 2-1.5h6v15H6c-1.2 0-2 .5-2 1.5V5.5z" /><path d="M20 5.5c0-1-.8-1.5-2-1.5h-6v15h6c1.2 0 2 .5 2 1.5V5.5z" />
    </svg>
  );
}

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

export default function Subjects() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [subjects, setSubjects] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const gridCols = selectMode ? '28px 1.6fr 0.6fr 1fr 1.3fr 80px' : '1.6fr 0.6fr 1fr 1.3fr 80px';

  async function reload() {
    await guardedFetch({
      cacheKey: `subjects_${profile.school_id}`,
      hasData: subjects !== null,
      load: async () => {
        const { data: su, error: suError } = await supabase.from('subjects').select('*, staff ( full_name )').order('nom');
        return suError ? { error: suError } : { data: su };
      },
      setData: setSubjects,
      setOffline,
      onError: (err) => setError(translateError(err)),
      onSuccess: () => setError(''),
    });
    const [{ data: te }, { data: cl }] = await Promise.all([
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
      supabase.from('classes').select('id, nom, niveau, section'),
    ]);
    setTeachers(te || []);
    setClasses(sortClasses(cl || []));
  }

  useEffect(() => { reload(); }, []);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = subjects.map((s) => s.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteOne(s) {
    if (!(await confirm(`Supprimer la matière ${s.nom} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', s.id);
    if (deleteError) {
      setError(deleteError.code === '23503' ? `Impossible de supprimer « ${s.nom} » : des notes existantes utilisent encore cette matière.` : translateError(deleteError));
      return;
    }
    reload();
  }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} matière${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('subjects').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { 
      setError(deleteError.message.includes('violates foreign key') ? "Impossible de supprimer : certaines matières ont des notes associées." : translateError(deleteError)); 
      return; 
    }
    exitSelectMode(); reload();
  }

  return (
    <div>
      <SchoolTabs />
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
          Matières
        </p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {!selectMode && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle matière
            </button>
          )}
          {subjects && subjects.length > 0 && !selectMode && (
            <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
              Sélectionner
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!subjects && <div className="card-bold"><SkeletonTableRows count={5} columns={4} /></div>}

      {subjects && subjects.length === 0 && (
        <div className="card-bold">
          <EmptyState icon={<BookIcon />} title="Aucune matière pour l'instant" subtitle="Ajoute les matières enseignées pour pouvoir y rattacher des enseignants et saisir des notes." actionLabel="Créer ma première matière" onAction={() => { setEditing(null); setModalOpen(true); }} />
        </div>
      )}
      {subjects && subjects.length > 0 && (
        <div className="card-bold" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ minWidth: selectMode ? 620 : 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '12px 20px' : '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
              {selectMode && <span></span>}
              <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: selectMode ? 0 : 20 }}>Matière</span><span>Coef.</span><span>Niveau</span><span>Enseignant</span>
              {!selectMode && <span></span>}
            </div>
            {subjects.map((s, i) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '13px 20px' : '13px 20px 13px 0', alignItems: 'center', borderBottom: i < subjects.length - 1 ? '1px solid var(--line)' : 'none' }}>
                {selectMode && <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleOne(s.id)} />}
                <span style={{ fontSize: '13.5px', fontWeight: 600, ...stickyColStyle('var(--paper)'), paddingLeft: selectMode ? 0 : 20 }}>{s.nom}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-light)', padding: '3px 9px', borderRadius: 20, width: 'fit-content' }}>×{s.coefficient}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau || 'Tous niveaux'}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.staff?.full_name || '—'}</span>
                
                {!selectMode && (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', paddingRight: 20 }}>
                    <button onClick={() => { setEditing(s); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }} title="Modifier">
                      <PencilIcon />
                    </button>
                    <button onClick={() => handleDeleteOne(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Supprimer">
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectMode && <SelectionBar count={selectedIds.length} allSelected={subjects && subjects.length > 0 && subjects.every((s) => selectedIds.includes(s.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />}
      {modalOpen && <SubjectModal schoolId={profile.school_id} teachers={teachers} classes={classes} editing={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); reload(); }} />}
    </div>
  );
}
