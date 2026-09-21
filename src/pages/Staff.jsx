import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, downloadCsv, sortClasses } from '../lib/utils.js';
import NewStaffModal from '../components/NewStaffModal.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  );
}

export default function Staff() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const canDelete = CAN_DELETE_ROLES.includes(profile.role);
  const gridCols = selectMode ? '28px 1fr 1.4fr 1fr 1.8fr 1fr' : '1fr 1.4fr 1fr 1.8fr 1fr 76px';

  async function reload() {
    const { data, error: fetchError } = await supabase.from('staff').select('*').order('full_name');
    if (fetchError) setError(fetchError.message);
    else setStaff(data);
  }

  useEffect(() => {
    reload();
    // Les classes attribuables à un enseignant sont celles réellement
    // créées par l'école (page Classes), pas une liste générique.
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => {
      setClasses(sortClasses(data || []));
    });
  }, []);

  function openEdit(p) {
    setEditingStaff(p);
    setModalOpen(true);
  }

  function exportCsv() {
    const rows = [['Matricule', 'Nom', 'Rôle', "Niveau d'études", 'Classe(s)', 'Téléphone', 'E-mail']];
    staff.forEach((p) => {
      rows.push([p.matricule || '', p.full_name, p.role, p.niveau_etudes || '', (p.classes || []).join(' / '), p.phone || '', p.email || '']);
    });
    downloadCsv('personnel.csv', rows);
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = staff.map((p) => p.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleDeleteOne(id, name) {
    if (!window.confirm(`Supprimer définitivement ${name} de l'équipe ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    reload();
  }

  async function handleDeleteSelected() {
    if (!window.confirm(`Supprimer définitivement ${selectedIds.length} membre${selectedIds.length > 1 ? 's' : ''} du personnel ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('staff').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Personnel</p>
        {staff && (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
              <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
            </button>
            <button onClick={() => { setEditingStaff(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
            </button>
            {canDelete && !selectMode && (
              <button
                onClick={() => setSelectMode(true)}
                style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}
              >
                Sélectionner
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>}
      {!error && !staff && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {staff && (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>{staff.length} membre{staff.length > 1 ? 's' : ''}</p>
          <div className="card-bold" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: selectMode ? 748 : 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '13px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.03em', alignItems: 'center' }}>
                {selectMode && <span></span>}
                <span>Matricule</span><span>Nom</span><span>Rôle</span><span>Niveau d'études</span><span>Classe(s)</span>
                {!selectMode && <span></span>}
              </div>
              {staff.map((p, i) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '14px 20px', alignItems: 'center', borderBottom: i < staff.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  {selectMode && (
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} />
                  )}
                  <Link
                    to={selectMode ? '#' : `/personnel/${p.id}`}
                    onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(p.id); } : undefined}
                    style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{p.matricule}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                        {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p.full_name)}
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{p.full_name}</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.role}</span>
                    <span style={{ fontSize: 13 }}>{p.niveau_etudes || '—'}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{(p.classes || []).length ? p.classes.join(', ') : '—'}</span>
                  </Link>
                  {!selectMode && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOne(p.id, p.full_name)}
                          title="Supprimer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <TrashIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        title="Modifier"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                      >
                        <GearIcon />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {staff.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre du personnel.</p>}
            </div>
          </div>
        </>
      )}

      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={!!staff && staff.length > 0 && staff.every((p) => selectedIds.includes(p.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      {modalOpen && (
        <NewStaffModal
          schoolId={profile.school_id}
          existingStaff={staff || []}
          availableClasses={classes}
          editing={editingStaff}
          onClose={() => { setModalOpen(false); setEditingStaff(null); }}
          onSaved={() => { setModalOpen(false); setEditingStaff(null); reload(); }}
        />
      )}
    </div>
  );
}
