import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, fmtF, downloadCsv, sortClasses, stickyColStyle, stickyHeaderStyle } from '../lib/utils.js';
import NewStaffModal from '../components/NewStaffModal.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PlanLocked from '../components/PlanLocked.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { translateError } from '../lib/errors.js';
import { usePageTour } from '../components/PageTour.jsx';
import { hasFeature, getPlanLabel, featurePlanRequired } from '../lib/plan.js';
import Dropdown from '../components/Dropdown.jsx';
import MoneyInput from '../components/MoneyInput.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useToast } from '../components/Toast.jsx';

function IdBadgeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2.4" /><circle cx="12" cy="10.5" r="2.4" />
      <path d="M8.3 16.5c.5-1.7 1.9-2.6 3.7-2.6s3.2.9 3.7 2.6" /><path d="M9 3.5v2M15 3.5v2" />
    </svg>
  );
}

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" /><path d="M10 12l4 0" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5" />
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

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    months.push({ value: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

export default function Staff() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  
  // NOUVEAU : Vérification des permissions
  const canAccessFinance = profile?.role === 'fondateur' || profile?.permissions?.finance !== false;
  const canManageStaff = profile?.role === 'fondateur' || profile?.permissions?.personnel !== false;

  const [tab, setTab] = useState('annuaire'); 
  const [staff, setStaff] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [advancesByStaff, setAdvancesByStaff] = useState({});
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const canDelete = CAN_DELETE_ROLES.includes(profile.role);
  const tour = usePageTour('personnel');

  const plan = profile?.schools?.plan || 'decouverte';
  const hasPersonnel = hasFeature(plan, 'personnel');

  const gridCols = selectMode
    ? '28px 1.5fr 0.65fr 0.8fr 0.9fr 1fr 0.95fr 0.95fr 1.1fr 1.1fr 132px'
    : '1.5fr 0.65fr 0.8fr 0.9fr 1fr 0.95fr 0.95fr 1.1fr 1.1fr 132px';

  async function reload() {
    await guardedFetch({
      cacheKey: `staff_${profile.school_id}`,
      hasData: staff !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase.from('staff').select('*').order('full_name');
        return fetchError ? { error: fetchError } : { data };
      },
      setData: setStaff,
      setOffline,
      onError: (err) => setError(translateError(err)),
      onSuccess: () => setError(''),
    });
  }

  async function reloadAdvances() {
    const { data } = await supabase
      .from('salary_advances')
      .select('staff_id, solde, montant, statut')
      .eq('school_id', profile.school_id)
      .neq('statut', 'refusee');
    if (data) {
      const map = {};
      data.forEach((a) => {
        const solde = Number(a.solde) || 0;
        if (solde > 0) {
          if (!map[a.staff_id]) map[a.staff_id] = { affiche: 0, deduit: 0, enAttente: 0 };
          map[a.staff_id].affiche += solde;
          if (a.statut === 'approuvee') {
            map[a.staff_id].deduit += solde;
          } else {
            map[a.staff_id].enAttente += solde;
          }
        }
      });
      setAdvancesByStaff(map);
    }
  }

  const visibleStaff = (staff || []).filter((p) => (showArchives ? p.statut === 'inactif' : (p.statut || 'actif') === 'actif'));
  const actifsSansSalaire = visibleStaff.filter((p) => !showArchives && p.salaire_mensuel == null);
  const nbActifs = showArchives ? 0 : visibleStaff.length;
  const nbAvecSalaire = showArchives ? 0 : nbActifs - actifsSansSalaire.length;

  function subjectsFor(staffId) {
    return subjects.filter((s) => s.enseignant_id === staffId).map((s) => s.nom);
  }

  function avanceFor(staffId) {
    return advancesByStaff[staffId]?.affiche || 0;
  }

  function avanceDeduiteFor(staffId) {
    return advancesByStaff[staffId]?.deduit || 0;
  }

  function avanceEnAttenteFor(staffId) {
    return advancesByStaff[staffId]?.enAttente || 0;
  }

  function resteFor(p) {
    if (p.salaire_mensuel == null) return null;
    return Number(p.salaire_mensuel) - avanceDeduiteFor(p.id);
  }

  function reloadSubjects() {
    supabase.from('subjects').select('id, nom, enseignant_id').order('nom').then(({ data }) => {
      setSubjects(data || []);
    });
  }

  useEffect(() => {
    if (!hasPersonnel) return;
    reload();
    reloadAdvances();
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => {
      setClasses(sortClasses(data || []));
    });
    reloadSubjects();
  }, [hasPersonnel]);

  if (!hasPersonnel) {
    return (
      <div>
        <SchoolTabs />
        <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Personnel</p>
        <PlanLocked currentPlanLabel={getPlanLabel(plan)} requiredPlanLabel={featurePlanRequired('personnel')} featureDescription="la gestion du personnel (enseignants, secrétaires, salaires, avances)" />
      </div>
    );
  }

  function openEdit(p) {
    setEditingStaff(p);
    setModalOpen(true);
  }

  function exportCsv() {
    const rows = [['Nom', 'Matricule', 'Statut', 'Rôle', "Niveau d'études", 'Salaire mensuel', 'Avance approuvée (déduite)', 'Avance en attente (non déduite)', 'Reste à percevoir', "Date d'entrée", 'Classe(s)', 'Matière(s)', 'Téléphone', 'E-mail']];
    visibleStaff.forEach((p) => {
      const deduit = avanceDeduiteFor(p.id);
      const enAttente = avanceEnAttenteFor(p.id);
      const reste = resteFor(p);
      rows.push([p.full_name, p.matricule || '', p.statut === 'inactif' ? 'Archivé' : 'Actif', p.role, p.niveau_etudes || '', p.salaire_mensuel != null ? p.salaire_mensuel : '', deduit, enAttente, reste != null ? reste : '', p.date_entree || '', (p.classes || []).join(' / '), subjectsFor(p.id).join(' / '), p.phone || '', p.email || '']);
    });
    downloadCsv('personnel.csv', rows);
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = visibleStaff.map((p) => p.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleArchiveOne(id, name, restore) {
    if (!restore && !(await confirm(`Archiver ${name} ? Cette personne n'apparaîtra plus dans la liste active, mais son historique (avances, salaires versés) est conservé.`, { confirmLabel: 'Archiver', danger: false }))) return;
    setDeleting(true);
    const { error: updateError } = await supabase.from('staff').update({ statut: restore ? 'actif' : 'inactif' }).eq('id', id);
    setDeleting(false);
    if (updateError) { setError(translateError(updateError)); return; }
    reload();
  }

  async function handleDeleteOne(id, name) {
    if (!(await confirm(`Supprimer définitivement ${name} de l'équipe ? Attention, tu ne pourras pas revenir en arrière. C'est impossible si cette personne a un historique (avances, salaires, classe ou matière encore rattachée).`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message.includes('violates foreign key') ? "Impossible de supprimer : cette personne a encore un historique lié (avances, salaires, classe ou matière). Utilise l'archivage à la place." : translateError(deleteError)); return; }
    reload();
  }

  async function handleArchiveSelected() {
    if (!(await confirm(`${showArchives ? 'Réactiver' : 'Archiver'} ${selectedIds.length} membre${selectedIds.length > 1 ? 's' : ''} du personnel ?`, { confirmLabel: showArchives ? 'Réactiver' : 'Archiver', danger: false }))) return;
    setDeleting(true);
    const { error: updateError } = await supabase.from('staff').update({ statut: showArchives ? 'actif' : 'inactif' }).in('id', selectedIds);
    setDeleting(false);
    if (updateError) { setError(translateError(updateError)); return; }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      {offline && <OfflineBanner />}
      {tour.Runner}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Personnel</p>
          <tour.Button />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('annuaire')} style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === 'annuaire' ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === 'annuaire' ? 'var(--forest)' : 'var(--paper)', color: tab === 'annuaire' ? '#fff' : 'var(--ink)', cursor: 'pointer' }}>
          Annuaire
        </button>
        
        {/* On cache l'onglet Salaires si pas la permission finance */}
        {canAccessFinance && (
          <button onClick={() => setTab('salaires')} style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === 'salaires' ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === 'salaires' ? 'var(--forest)' : 'var(--paper)', color: tab === 'salaires' ? '#fff' : 'var(--ink)', cursor: 'pointer' }}>
            Salaires
          </button>
        )}
      </div>

      {tab === 'annuaire' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
            {staff && (
              <>
                <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
                  <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
                </button>
                
                {/* On cache le bouton Ajouter si pas la permission personnel */}
                {canManageStaff && (
                  <button onClick={() => { setEditingStaff(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
                    <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
                  </button>
                )}

                {canDelete && !selectMode && (
                  <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
                    Sélectionner
                  </button>
                )}
              </>
            )}
          </div>

          <div data-tour="staff-tabs" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button onClick={() => setShowArchives(false)} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${!showArchives ? 'var(--forest)' : 'var(--line-strong)'}`, background: !showArchives ? 'var(--forest)' : 'var(--paper)', color: !showArchives ? '#fff' : 'var(--ink)' }}>Actifs</button>
            <button onClick={() => setShowArchives(true)} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${showArchives ? 'var(--forest)' : 'var(--line-strong)'}`, background: showArchives ? 'var(--forest)' : 'var(--paper)', color: showArchives ? '#fff' : 'var(--ink)' }}>Archivés{staff ? ` (${staff.filter((p) => p.statut === 'inactif').length})` : ''}</button>
          </div>

          {!showArchives && nbActifs > 0 && actifsSansSalaire.length > 0 && (
            <div className="card-bold" style={{ padding: '12px 16px', marginBottom: 14, background: 'var(--amber-light)', borderColor: 'var(--amber)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: 'var(--clay-dark)', flexShrink: 0, marginTop: 1 }} aria-hidden="true"></i>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--clay-dark)' }}>{actifsSansSalaire.length} membre{actifsSansSalaire.length > 1 ? 's' : ''} actif{actifsSansSalaire.length > 1 ? 's' : ''} sans salaire mensuel renseigné</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--clay-dark)', lineHeight: 1.5 }}>Le calcul « salaires théoriques » du tableau de bord sera sous-évalué pour {actifsSansSalaire.length > 1 ? 'ces personnes' : 'cette personne'}.</p>
                </div>
              </div>
            </div>
          )}

          {!showArchives && nbActifs > 0 && actifsSansSalaire.length === 0 && (
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              <i className="ti ti-check" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>{nbAvecSalaire} / {nbActifs} membres avec salaire renseigné
            </p>
          )}

          {error && <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>}
          {!error && !staff && <div className="card-bold"><SkeletonRow count={6} /></div>}

          {staff && visibleStaff.length === 0 && (
            <div className="card-bold">
              {showArchives ? (
                <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre archivé.</p>
              ) : (
                <EmptyState icon={<IdBadgeIcon />} title="Aucun membre du personnel" subtitle="Ajoute les enseignants et le personnel administratif pour leur assigner des classes et des matières." actionLabel="Ajouter un membre" onAction={() => { setEditingStaff(null); setModalOpen(true); }} />
              )}
            </div>
          )}
          {staff && visibleStaff.length > 0 && (
            <div data-tour="staff-list" className="card-bold" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ minWidth: selectMode ? 1180 : 1140 }}>
                <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '13px 20px' : '13px 20px 13px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.03em', alignItems: 'center' }}>
                  {selectMode && <span></span>}
                  <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: selectMode ? 0 : 20 }}>Nom</span>
                  <span>Matricule</span>
                  <span>Rôle</span>
                  <span>Niveau</span>
                  <span>Salaire</span>
                  <span>Avance</span>
                  <span>Reste</span>
                  <span>Classe(s)</span>
                  <span>Matière(s)</span>
                  {!selectMode && <span></span>}
                </div>
                {visibleStaff.map((p, i) => {
                  const salaireManquant = !showArchives && p.salaire_mensuel == null;
                  const avance = avanceFor(p.id);
                  const avanceEnAttente = avanceEnAttenteFor(p.id);
                  const reste = resteFor(p);
                  return (
                    <div key={p.id} className="row-link" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '14px 20px' : '14px 20px 14px 0', alignItems: 'center', borderBottom: i < visibleStaff.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      {selectMode && (
                        <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} />
                      )}
                      <Link to={selectMode ? '#' : `/personnel/${p.id}`} onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(p.id); } : undefined} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...stickyColStyle('var(--paper)'), paddingLeft: selectMode ? 0 : 20 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                            {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p.full_name)}
                          </div>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{p.full_name}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{p.matricule}</span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.role}</span>
                        <span style={{ fontSize: 13 }}>{p.niveau_etudes || '—'}</span>
                        <span style={{ fontSize: 13 }}>
                          {salaireManquant ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-light)', padding: '3px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                              <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} aria-hidden="true"></i>Manquant
                            </span>
                          ) : p.salaire_mensuel != null ? (
                            <span style={{ fontWeight: 600 }}>{fmtF(p.salaire_mensuel)}</span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: avance > 0 ? 600 : 400, color: avance > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                          {fmtF(avance)}
                          {avanceEnAttente > 0 && (
                            <span title={`Dont ${fmtF(avanceEnAttente)} en attente d'approbation — non déduite du salaire`} style={{ color: 'var(--clay-dark)', fontSize: 12, marginLeft: 2, cursor: 'help', fontWeight: 700 }}>*</span>
                          )}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: reste == null ? 'var(--muted)' : (reste < 0 ? 'var(--danger)' : 'var(--success)') }}>
                          {reste == null ? '—' : fmtF(reste)}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{(p.classes || []).length ? p.classes.join(', ') : '—'}</span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.role === 'Enseignant' && subjectsFor(p.id).length ? subjectsFor(p.id).join(', ') : '—'}</span>
                      </Link>
                      {!selectMode && (
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0, justifyContent: 'flex-end', paddingRight: 20 }}>
                          <button type="button" onClick={() => openEdit(p)} title="Modifier" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}><PencilIcon /></button>
                          {canDelete && (
                            <button type="button" onClick={() => handleArchiveOne(p.id, p.full_name, showArchives)} title={showArchives ? 'Réactiver' : 'Archiver'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>{showArchives ? <RestoreIcon /> : <ArchiveIcon />}</button>
                          )}
                          {canDelete && showArchives && (
                            <button type="button" onClick={() => handleDeleteOne(p.id, p.full_name)} title="Supprimer définitivement" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}><TrashIcon /></button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectMode && (
            <SelectionBar count={selectedIds.length} allSelected={visibleStaff.length > 0 && visibleStaff.every((p) => selectedIds.includes(p.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleArchiveSelected} deleting={deleting} actionLabel={showArchives ? 'Réactiver' : 'Archiver'} actionColor="var(--forest)" actionIcon={showArchives ? <RestoreIcon /> : <ArchiveIcon />} />
          )}
        </>
      )}

      {tab === 'salaires' && canAccessFinance && (
        <SalairesSection staff={staff} />
      )}

      {modalOpen && (
        <NewStaffModal schoolId={profile.school_id} existingStaff={staff || []} availableClasses={classes} availableSubjects={subjects} editing={editingStaff} onClose={() => { setModalOpen(false); setEditingStaff(null); }} onSaved={() => { setModalOpen(false); setEditingStaff(null); reload(); reloadSubjects(); reloadAdvances(); }} />
      )}
    </div>
  );
}

// ==========================================
// COMPOSANT : GESTION DES SALAIRES
// ==========================================
function SalairesSection({ staff }) {
  const { profile } = useAuth();
  const showToast = useToast();
  const [mois, setMois] = useState(generateMonthOptions()[0].value);
  const [salaries, setSalaries] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [error, setError] = useState('');

  const monthOptions = generateMonthOptions();
  const COLONNES_SALAIRES = '1.5fr 1.2fr 1.2fr 1.2fr 1.2fr 110px';

  async function reloadSalaries() {
    setSalaries(null);
    const { data: sal, error: salErr } = await supabase.from('staff_salaries').select('*, staff (full_name, role)').eq('school_id', profile.school_id).eq('mois', mois).order('created_at', { ascending: false });
    if (salErr) setError(salErr.message); else setSalaries(sal || []);

    const { data: adv, error: advErr } = await supabase.from('salary_advances').select('staff_id, solde').eq('school_id', profile.school_id).eq('statut', 'approuvee').gt('solde', 0);
    if (advErr) setError(advErr.message); else setAdvances(adv || []);
  }

  useEffect(() => { reloadSalaries(); }, [mois]);
  const activeStaff = (staff || []).filter(p => (p.statut || 'actif') === 'actif');
  if (!staff) return <div className="card-bold"><SkeletonRow count={5} /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gestion des salaires</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Les avances approuvées sont automatiquement déduites du reste à payer.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Mois :</label>
          <Dropdown value={mois} onChange={setMois} options={monthOptions} style={{ width: 200 }} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card-bold" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Membre</span>
            <span>Salaire prévu</span>
            <span>Avance à déduire</span>
            <span>Déjà payé</span>
            <span>Reste net à payer</span>
            <span></span>
          </div>
          
          {salaries === null ? (
            <SkeletonRow count={3} />
          ) : activeStaff.length === 0 ? (
            <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre du personnel actif.</p>
          ) : (
            activeStaff.map((p, i) => {
              const paye = (salaries || []).filter(s => s.staff_id === p.id).reduce((acc, s) => acc + Number(s.montant), 0);
              const avanceDeduire = (advances || []).filter(a => a.staff_id === p.id).reduce((acc, a) => acc + Number(a.solde), 0);
              const prevu = Number(p.salaire_mensuel) || 0;
              const reste = prevu - paye - avanceDeduire;
              const estPaye = prevu > 0 && reste <= 0;

              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '14px 20px 14px 0', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
                  <div style={{ ...stickyColStyle('var(--paper)'), paddingLeft: 20 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.full_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{p.role}</p>
                  </div>
                  <span>{prevu > 0 ? fmtF(prevu) : '—'}</span>
                  <span style={{ color: avanceDeduire > 0 ? 'var(--amber)' : 'var(--muted)' }}>{avanceDeduire > 0 ? fmtF(avanceDeduire) : '—'}</span>
                  <span style={{ color: paye > 0 ? 'var(--success)' : 'var(--muted)', fontWeight: paye > 0 ? 600 : 400 }}>{fmtF(paye)}</span>
                  <span style={{ color: reste > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{prevu > 0 ? fmtF(reste) : '—'}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 20 }}>
                    <button onClick={() => { setSelectedStaff(p); setModalOpen(true); }} disabled={prevu <= 0 || estPaye} style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: estPaye ? 'var(--line)' : 'var(--forest)', color: estPaye ? 'var(--muted)' : '#fff', cursor: (prevu <= 0 || estPaye) ? 'default' : 'pointer', opacity: (prevu <= 0 || estPaye) ? 0.7 : 1 }}>
                      {estPaye ? 'Payé' : 'Payer'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Paiements enregistrés pour {monthOptions.find(m => m.value === mois)?.label}</p>
      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {salaries === null && <SkeletonRow count={2} />}
        {salaries && salaries.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement de salaire ce mois-ci.</p>}
        {salaries && salaries.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{s.staff?.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{new Date(s.date).toLocaleDateString('fr-FR')} · {s.mode}{s.note ? ` · ${s.note}` : ''}</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtF(s.montant)}</span>
          </div>
        ))}
      </div>

      {modalOpen && selectedStaff && (
        <PayerSalaireModal staffMember={selectedStaff} mois={mois} avance={advances.filter(a => a.staff_id === selectedStaff.id).reduce((acc, a) => acc + Number(a.solde), 0)} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); reloadSalaries(); showToast('Salaire enregistré'); }} />
      )}
    </div>
  );
}

function PayerSalaireModal({ staffMember, mois, avance, onClose, onSaved }) {
  const { profile } = useAuth();
  const prevu = Number(staffMember.salaire_mensuel || 0);
  const [montant, setMontant] = useState(String(Math.max(0, prevu - avance)));
  const [mode, setMode] = useState('especes');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) { setError('Le montant doit être supérieur à 0.'); return; }
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supabase.from('staff_salaries').insert({
      school_id: profile.school_id, staff_id: staffMember.id, montant: Number(montant), mois: mois, date: date, mode: mode, note: note.trim() || null, created_by: profile.id,
    });
    setSubmitting(false);
    if (insertError) setError(insertError.message);
    else onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 400, width: '100%', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Payer le salaire</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>×</button>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>Membre : <strong>{staffMember.full_name}</strong> ({staffMember.role})</p>
        
        {avance > 0 && (
          <div style={{ background: 'var(--amber-light)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--clay-dark)', fontWeight: 600 }}>Avance approuvée à déduire : {fmtF(avance)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--clay-dark)' }}>Le montant par défaut a été ajusté (Salaire prévu - Avance).</p>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Montant à payer</label>
        <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ marginBottom: 12 }} />

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={[{ value: 'especes', label: 'Espèces' }, { value: 'virement', label: 'Virement' }, { value: 'mobile_money', label: 'Mobile Money' }, { value: 'cheque', label: 'Chèque' }]} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Date</label>
            <DatePicker value={date} onChange={setDate} style={{ width: '100%' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Note (facultatif)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Acompte, prime..." style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 13, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
