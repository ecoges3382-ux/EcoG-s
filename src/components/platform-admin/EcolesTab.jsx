import { useState, useEffect, useMemo } from 'react';
import { downloadCsv } from '../../lib/utils.js';
import { useToast } from '../Toast.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import Dropdown from '../Dropdown.jsx';
import { SkeletonRow } from '../Skeleton.jsx';
import SchoolDetailModal from './SchoolDetailModal.jsx';
import { 
  callPlatformAdmin, 
  STATUT_LABELS, 
  PLAN_LABELS, 
  healthIssues, 
  isSchoolHealthy, 
  BuildingIcon, 
  SearchIcon, 
  ChevronIcon, 
  DownloadIcon, 
  TrashIcon 
} from './PlatformAdminUI.jsx';

const SORTS = [
  { id: 'recent', label: 'Plus récentes' },
  { id: 'nom', label: 'Nom (A→Z)' },
  { id: 'effectif', label: 'Effectif (élèves)' },
  { id: 'sante', label: 'Priorité (à surveiller)' },
];

const STATUT_FILTERS = [
  { id: 'tous', label: 'Toutes' },
  { id: 'actif', label: 'Actives' },
  { id: 'essai', label: 'En essai' },
  { id: 'suspendu', label: 'Suspendues' },
  { id: 'resilie', label: 'Résiliées' },
  { id: 'sante', label: 'À surveiller' },
];

function StatutSwitch({ active, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Suspendre cette école' : 'Réactiver cette école'}
      title={active ? 'Suspendre' : 'Réactiver'}
      onClick={onChange}
      disabled={disabled}
      style={{ width: 42, height: 24, borderRadius: 20, border: 'none', padding: 2, flexShrink: 0, background: active ? 'var(--success)' : 'var(--line-strong)', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s' }}
    >
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: active ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }} />
    </button>
  );
}

function BulkBar({ count, onClear, onSuspend, onActivate, onExport, busy }) {
  return (
    <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 30, background: 'var(--forest-dark)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', color: '#fff', maxWidth: '95vw', flexWrap: 'nowrap' }}>
      <button type="button" onClick={onClear} style={{ padding: '6px 12px', borderRadius: 24, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>ANNULER</button>
      <span style={{ minWidth: 22, textAlign: 'center', color: 'var(--gold)', fontWeight: 800, fontSize: 14 }}>{count}</span>
      <button type="button" onClick={onActivate} disabled={busy} style={{ padding: '6px 12px', borderRadius: 24, border: 'none', fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'var(--success)', color: '#fff', letterSpacing: '0.02em', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>RÉACTIVER</button>
      <button type="button" onClick={onSuspend} disabled={busy} style={{ padding: '6px 12px', borderRadius: 24, border: 'none', fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'var(--amber)', color: '#fff', letterSpacing: '0.02em', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>SUSPENDRE</button>
      <button type="button" onClick={onExport} disabled={busy} style={{ padding: '6px 12px', borderRadius: 24, border: 'none', fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'var(--gold)', color: 'var(--forest-dark)', letterSpacing: '0.02em', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>EXPORTER</button>
    </div>
  );
}

function EmptySchoolsState({ hasFilter, onReset }) {
  return (
    <div style={{ background: 'var(--paper)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--forest-light)', color: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><BuildingIcon /></div>
      <p style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{hasFilter ? 'Aucune école ne correspond' : 'Aucune école pour l\'instant'}</p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{hasFilter ? 'Essaie un autre mot-clé ou change de filtre.' : 'Les écoles apparaîtront ici dès qu\'elles seront créées.'}</p>
      {hasFilter && <button type="button" onClick={onReset} style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Effacer les filtres</button>}
    </div>
  );
}

const iconBtnStyle = (color) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none', background: 'none', color, fontSize: 16, cursor: 'pointer' });

export default function EcolesTab({ schools, reload, focusSchoolId, onClearFocus }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [filterPlan, setFilterPlan] = useState('tous');
  const [detailId, setDetailId] = useState(null);
  const [busyRowId, setBusyRowId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [rowError, setRowError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (focusSchoolId) {
      setDetailId(focusSchoolId);
      onClearFocus?.();
    }
  }, [focusSchoolId, onClearFocus]);

  async function handleQuickToggle(school) {
    setRowError('');
    setBusyRowId(school.id);
    const nextStatut = school.statut === 'suspendu' ? 'actif' : 'suspendu';
    const { error: err } = await callPlatformAdmin({ action: 'set_statut', schoolId: school.id, statut: nextStatut });
    setBusyRowId(null);
    if (err) { setRowError(err); return; }
    reload();
  }

  async function handleQuickDelete(school) {
    setRowError('');
    setBusyRowId(school.id);
    const { error: err } = await callPlatformAdmin({ action: 'delete', schoolId: school.id });
    setBusyRowId(null);
    setConfirmingDeleteId(null);
    if (err) { setRowError(err); return; }
    reload();
  }

  const counts = useMemo(() => {
    if (!schools) return {};
    const c = { tous: schools.length, actif: 0, essai: 0, suspendu: 0, resilie: 0, sante: 0 };
    schools.forEach((s) => {
      if (c[s.statut] !== undefined) c[s.statut]++;
      if (!isSchoolHealthy(s) && s.statut !== 'resilie') c.sante++;
    });
    return c;
  }, [schools]);

  const filtered = useMemo(() => {
    if (!schools) return [];
    const term = search.trim().toLowerCase();
    let list = schools;
    if (filterStatut === 'sante') list = list.filter((s) => !isSchoolHealthy(s) && s.statut !== 'resilie');
    else if (filterStatut !== 'tous') list = list.filter((s) => s.statut === filterStatut);
    if (filterPlan !== 'tous') list = list.filter((s) => s.plan === filterPlan);
    if (term) list = list.filter((s) => s.name.toLowerCase().includes(term));
    list = [...list];
    if (sort === 'nom') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'effectif') list.sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
    else if (sort === 'sante') list.sort((a, b) => healthIssues(b).length - healthIssues(a).length);
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [schools, search, sort, filterStatut, filterPlan]);

  if (!schools) return <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}><SkeletonRow count={6} avatar={false} /></div>;

  const detailSchool = schools.find((s) => s.id === detailId) || null;

  function exportCsv() {
    const rows = [['Nom', 'Plan', 'Statut', 'Date création', 'Nb élèves', 'Nb personnel', 'Note administrative', 'Alertes']];
    filtered.forEach((s) => {
      const issues = healthIssues(s).map((i) => i.label).join(' / ');
      rows.push([s.name, PLAN_LABELS[s.plan]?.label || s.plan || '—', STATUT_LABELS[s.statut]?.label || s.statut, new Date(s.created_at).toLocaleDateString('fr-FR'), s.studentCount || 0, s.staffCount || 0, s.note_administrative || '', issues]);
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`ecoles-${date}.csv`, rows);
    showToast(`${filtered.length} école${filtered.length > 1 ? 's' : ''} exportée${filtered.length > 1 ? 's' : ''}`);
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = filtered.map((s) => s.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function clearSelection() { setSelectedIds([]); }

  async function bulkChangeStatut(nextStatut) {
    const targets = filtered.filter((s) => selectedIds.includes(s.id));
    if (targets.length === 0) return;
    const label = nextStatut === 'suspendu' ? 'Suspendre' : 'Réactiver';
    if (!(await confirm(`${label} ${targets.length} école${targets.length > 1 ? 's' : ''} ?`, { confirmLabel: label, danger: false }))) return;
    setBulkBusy(true);
    setRowError('');
    let failed = 0;
    for (const s of targets) {
      const { error: err } = await callPlatformAdmin({ action: 'set_statut', schoolId: s.id, statut: nextStatut });
      if (err) failed++;
    }
    setBulkBusy(false);
    setSelectedIds([]);
    if (failed > 0) setRowError(`${failed} école${failed > 1 ? 's' : ''} n'ont pas pu être mises à jour.`);
    else showToast(`${targets.length} école${targets.length > 1 ? 's' : ''} ${nextStatut === 'suspendu' ? 'suspendue' + (targets.length > 1 ? 's' : '') : 'réactivée' + (targets.length > 1 ? 's' : '')}`);
    reload();
  }

  async function bulkExportSelection() {
    const targets = filtered.filter((s) => selectedIds.includes(s.id));
    if (targets.length === 0) return;
    const rows = [['Nom', 'Plan', 'Statut', 'Date création', 'Nb élèves', 'Nb personnel', 'Note administrative', 'Alertes']];
    targets.forEach((s) => {
      const issues = healthIssues(s).map((i) => i.label).join(' / ');
      rows.push([s.name, PLAN_LABELS[s.plan]?.label || s.plan || '—', STATUT_LABELS[s.statut]?.label || s.statut, new Date(s.created_at).toLocaleDateString('fr-FR'), s.studentCount || 0, s.staffCount || 0, s.note_administrative || '', issues]);
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`ecoles-selection-${date}.csv`, rows);
    showToast(`${targets.length} école${targets.length > 1 ? 's' : ''} exportée${targets.length > 1 ? 's' : ''}`);
  }

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id));
  const hasSelection = selectedIds.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUT_FILTERS.map((f) => {
          const isActive = filterStatut === f.id;
          const isWarn = f.id === 'sante' && (counts.sante || 0) > 0;
          return (
            <button
              key={f.id}
              onClick={() => setFilterStatut(f.id)}
              style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${isActive ? (isWarn ? '#FCA5A5' : 'var(--gold)') : 'rgba(255,255,255,0.2)'}`, background: isActive ? (isWarn ? '#FCA5A5' : 'var(--gold)') : (isWarn ? 'rgba(252,165,165,0.1)' : 'rgba(255,255,255,0.06)'), color: isActive ? 'var(--forest-dark)' : (isWarn ? '#FCA5A5' : 'rgba(255,255,255,0.85)') }}
            >
              {f.label}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.id] || 0}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '2 1 220px' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }}><SearchIcon /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une école…" style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <Dropdown value={filterPlan} onChange={setFilterPlan} options={[{ value: 'tous', label: 'Tous les plans' }, { value: 'decouverte', label: 'Découverte' }, { value: 'essentiel', label: 'Essentiel' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]} textColor="#fff" chevronColor="rgba(255,255,255,0.75)" style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', fontSize: 13 }} wrapperStyle={{ flex: '1 1 140px', width: 'auto' }} />
        <Dropdown value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} textColor="#fff" chevronColor="rgba(255,255,255,0.75)" style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', fontSize: 13 }} wrapperStyle={{ flex: '1 1 160px', width: 'auto' }} />
        <button onClick={exportCsv} disabled={filtered.length === 0} title="Exporter les écoles affichées" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}>
          <DownloadIcon /> Exporter CSV
        </button>
      </div>

      {rowError && <p style={{ color: '#ffb4a8', marginBottom: 10, fontWeight: 600, fontSize: 12.5 }}>{rowError}</p>}

      {filtered.length === 0 && <EmptySchoolsState hasFilter={filterStatut !== 'tous' || filterPlan !== 'tous' || search.trim() !== ''} onReset={() => { setFilterStatut('tous'); setFilterPlan('tous'); setSearch(''); }} />}

      {filtered.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAllVisible} style={{ cursor: 'pointer' }} aria-label="Tout sélectionner" />
            <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              {hasSelection ? `${selectedIds.length} sélectionnée${selectedIds.length > 1 ? 's' : ''}` : 'Tout sélectionner'}
            </p>
          </div>
          <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
            {filtered.map((s, i) => {
              const st = STATUT_LABELS[s.statut] || STATUT_LABELS.actif;
              const pl = PLAN_LABELS[s.plan] || PLAN_LABELS.decouverte;
              const canDelete = s.statut === 'suspendu' || s.statut === 'resilie';
              const isActive = s.statut !== 'suspendu';
              const busy = busyRowId === s.id;
              const issues = healthIssues(s);
              const isSelected = selectedIds.includes(s.id);
              const isSick = issues.length > 0 && s.statut !== 'resilie';
              return (
                <div
                  key={s.id}
                  className="admin-school-row"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--line)', transition: 'background 0.15s', background: isSelected ? 'rgba(212,168,73,0.06)' : 'transparent' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#FAF8F4'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(s.id)} style={{ cursor: 'pointer', flexShrink: 0 }} aria-label={`Sélectionner ${s.name}`} />
                  <div className="admin-school-avatar" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 13, color: 'var(--forest-dark)', flexShrink: 0, overflow: 'hidden' }}>
                    {s.logo_url ? <img src={s.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((s.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG')}
                  </div>
                  <div className="admin-school-content" onClick={() => setDetailId(s.id)} style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</p>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: pl.bg, color: pl.fg }}>{pl.label}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
                      {isSick && issues.slice(0, 2).map((iss) => (
                        <span key={iss.key} title={iss.label} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: iss.severity === 'high' ? '#FBE3DF' : '#FEF3E2', color: iss.severity === 'high' ? '#B33B2A' : '#B4670E' }}>
                          {iss.label}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                      {s.staffCount} compte{s.staffCount !== 1 ? 's' : ''} · {s.studentCount} élève{s.studentCount !== 1 ? 's' : ''} · créée le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="admin-school-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <StatutSwitch active={isActive} disabled={busy} onChange={() => handleQuickToggle(s)} />
                    <button type="button" onClick={() => setDetailId(s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none', background: 'rgba(15,76,58,0.08)', color: 'var(--forest)', cursor: 'pointer' }} title="Voir le détail">
                      <ChevronIcon />
                    </button>
                    {confirmingDeleteId === s.id ? (
                      <>
                        <button type="button" onClick={() => setConfirmingDeleteId(null)} title="Annuler" style={iconBtnStyle('var(--muted)')}><i className="ti ti-x" aria-hidden="true"></i></button>
                        <button type="button" onClick={() => handleQuickDelete(s)} disabled={busy} title="Confirmer" style={iconBtnStyle('var(--danger)')}><i className="ti ti-check" aria-hidden="true"></i></button>
                      </>
                    ) : (
                      <button type="button" onClick={() => (canDelete ? setConfirmingDeleteId(s.id) : null)} disabled={!canDelete || busy} title={canDelete ? 'Supprimer définitivement' : "Suspends d'abord cette école."} style={{ ...iconBtnStyle(canDelete ? 'var(--danger)' : 'var(--line-strong)'), cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.4 }}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {detailSchool && (
        <SchoolDetailModal school={detailSchool} onClose={() => setDetailId(null)} onChanged={() => { reload(); }} />
      )}

      {hasSelection && (
        <BulkBar count={selectedIds.length} onClear={clearSelection} onSuspend={() => bulkChangeStatut('suspendu')} onActivate={() => bulkChangeStatut('actif')} onExport={bulkExportSelection} busy={bulkBusy} />
      )}
    </div>
  );
}
