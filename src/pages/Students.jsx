import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmt, fmtF, initials, downloadCsv, parseCsv, splitFullName, sortClasses, displayName, stickyColStyle, stickyHeaderStyle } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import NewStudentModal from '../components/NewStudentModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import Dropdown from '../components/Dropdown.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { translateError } from '../lib/errors.js';
import { usePageTour } from '../components/PageTour.jsx';
import { canAddStudent, getPlanLabel, studentQuotaLabel, featurePlanRequired, getPlan } from '../lib/plan.js';
import { supportWhatsappLink } from '../lib/utils.js';

function statusOf(s, schoolYear, feeSchedule) {
  const relance = computeRelance(s, schoolYear, feeSchedule);
  if (relance.moratoire) return { label: 'Moratoire', bg: '#F0EDE5', fg: 'var(--muted)' };
  const calendrierConfigure = !!(schoolYear && (schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3 || schoolYear.date_connexe));
  if (calendrierConfigure) {
    if (relance.relance) return { label: 'À relancer', bg: 'var(--danger-light)', fg: 'var(--danger)' };
    return { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' };
  }
  const reste = Number(s.montant_du) - Number(s.montant_paye);
  if (reste <= 0) return { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' };
  const ratioPaye = Number(s.montant_du) > 0 ? Number(s.montant_paye) / Number(s.montant_du) : 0;
  if (ratioPaye >= 0.4) return { label: 'Retard léger', bg: 'var(--amber-light)', fg: 'var(--amber)' };
  return { label: 'Retard critique', bg: 'var(--danger-light)', fg: 'var(--danger)' };
}

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_EDIT_ROLES = ['fondateur', 'directeur', 'secretaire'];

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

function UsersIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" /><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 14c2.4.2 4.2 2.4 4.4 4.7" />
    </svg>
  );
}

export default function Students() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const { schoolYear, activeYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [classes, setClasses] = useState(null);
  const [feeSchedulesByNiveau, setFeeSchedulesByNiveau] = useState({});
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [classFilter, setClassFilter] = useState('toutes');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const canDelete = CAN_DELETE_ROLES.includes(profile.role) && !isHistorical;
  const canEdit = CAN_EDIT_ROLES.includes(profile.role);
  const tour = usePageTour('eleves');

  const plan = profile?.schools?.plan || 'decouverte';
  const planLabel = getPlanLabel(plan);
  const quota = getPlan(plan).maxStudents;
  const studentCount = students?.length || 0;
  const quotaReached = !canAddStudent(plan, studentCount);
  const quotaWarning = quota !== Infinity && studentCount >= Math.floor(quota * 0.8);

  const gridCols = selectMode
    ? '28px 2fr 0.9fr 0.5fr 0.8fr 0.9fr 1fr 0.9fr 1fr 100px'
    : '2fr 0.9fr 0.5fr 0.8fr 0.9fr 1fr 0.9fr 1fr 100px';

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `students_${profile.school_id}_${schoolYear.id}`,
      hasData: students !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('enrollments')
          .select('id, created_at, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, classes ( nom, niveau ), students ( id, full_name, nom, prenom, matricule, sexe, parent_phone, photo_url, date_naissance )')
          .eq('school_year_id', schoolYear.id)
          .order('full_name', { foreignTable: 'students' });
        if (fetchError) return { error: fetchError };
        return {
          data: (data || []).map((e) => ({
            id: e.students.id,
            enrollment_id: e.id,
            created_at: e.created_at,
            full_name: e.students.full_name,
            nom: e.students.nom,
            prenom: e.students.prenom,
            matricule: e.students.matricule,
            sexe: e.students.sexe,
            parent_phone: e.students.parent_phone,
            photo_url: e.students.photo_url,
            date_naissance: e.students.date_naissance,
            classe_id: e.classe_id,
            niveau: e.classes?.nom || '—',
            classeNiveau: e.classes?.niveau || null,
            montant_du: e.montant_du,
            montant_paye: e.montant_paye,
            frais_connexe_du: e.frais_connexe_du,
            frais_connexe_paye: e.frais_connexe_paye,
            note_arrangement: e.note_arrangement,
          })),
        };
      },
      setData: setStudents,
      setOffline,
      onError: (err) => setError(translateError(err)),
      onSuccess: () => setError(''),
    });
  }

  useEffect(() => {
    if (!schoolYear) return;
    reload();
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => { setClasses(sortClasses(data || [])); });
    supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id).then(({ data }) => {
      const map = {};
      (data || []).forEach((f) => { map[f.niveau] = f; });
      setFeeSchedulesByNiveau(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <div className="card-bold"><SkeletonRow count={6} /></div>;

  const filtered = classFilter === 'toutes' ? students : students.filter((s) => s.niveau === classFilter);

  function exportCsv() {
    const rows = [['Nom', 'Matricule', 'Sexe', 'Classe', "Date d'inscription", 'Montant dû', 'Payé', 'Reste', 'Téléphone parent']];
    students.forEach((s) => {
      rows.push([s.full_name, s.matricule || '', s.sexe === 'F' ? 'F' : 'M', s.niveau, new Date(s.created_at).toLocaleDateString('fr-FR'), s.montant_du, s.montant_paye, Number(s.montant_du) - Number(s.montant_paye), s.parent_phone || '']);
    });
    downloadCsv('eleves.csv', rows);
  }

  function downloadTemplate() {
    const rows = [
      ['Nom', 'Classe', 'Matricule', 'Montant dû', 'Déjà payé (écolage)'],
      ['KONE Aïcha', 'CM2', 'MAT-001', '150000', '50000'],
      ['MENSAH Koffi', '6e A', '', '180000', '0']
    ];
    downloadCsv('Modele_Import_Eleves.csv', rows);
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportMessage(null);

    const isExcel = /\.xlsx?$/i.test(file.name);
    let rows;
    
    if (isExcel) {
      if (!window.XLSX) { setImportMessage({ type: 'error', text: 'La librairie Excel est en cours de chargement. Réessaie dans 2 secondes.' }); return; }
      try {
        const buffer = await file.arrayBuffer();
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
        rows = rawRows.map(r => r.map(c => c == null ? '' : String(c).trim()));
      } catch (err) {
        setImportMessage({ type: 'error', text: `Impossible de lire le fichier Excel : ${err.message}` });
        return;
      }
    } else {
      const text = await file.text();
      rows = parseCsv(text);
    }

    if (rows.length < 2) { setImportMessage({ type: 'error', text: 'Fichier vide ou illisible.' }); return; }

    let headerRowIndex = -1;
    let idx = {};

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i].map(c => String(c).toLowerCase());
      const hasNom = r.some(c => c.includes('nom'));
      const hasClasse = r.some(c => c.includes('classe'));
      if (hasNom && hasClasse) {
        headerRowIndex = i;
        idx = {
          matricule: r.findIndex(c => c.includes('matricule')),
          nom: r.findIndex(c => c.includes('nom')),
          classe: r.findIndex(c => c.includes('classe')),
          du: r.findIndex(c => c.includes('montant d') || c.includes('montant du')),
          tel: r.findIndex(c => c.includes('téléphone') || c.includes('telephone')),
          connexeDu: r.findIndex(c => c.includes('frais connexes dus') || c.includes('connexe d')),
          soldeEcolage: r.findIndex(c => c.includes('déjà payé (écolage)') || c.includes('deja paye (ecolage)') || c.includes('solde ecolage')),
          soldeConnexe: r.findIndex(c => c.includes('déjà payé (connexes)') || c.includes('deja paye (connexes)') || c.includes('solde connexe')),
        };
        break;
      }
    }

    if (headerRowIndex === -1) {
      const apercu = rows.slice(0, 3).map(l => l.join(' | ')).join('   ///   ');
      setImportMessage({ type: 'error', text: `Impossible de trouver les colonnes "Nom" et "Classe". Voici ce que le fichier contient au début : ${apercu}` });
      return;
    }

    const dataRows = rows.slice(headerRowIndex + 1);
    const toInsertStudents = [];
    const enrollmentInfo = [];
    let skipped = 0;
    
    dataRows.forEach((r) => {
      if (r.every(c => !c)) return;
      const fullName = (r[idx.nom] || '').trim();
      const classeNom = (r[idx.classe] || '').trim();
      const classeObj = (classes || []).find((c) => c.nom.toLowerCase() === classeNom.toLowerCase());
      if (!fullName || !classeObj) { skipped += 1; return; }
      
      const { nom, prenom } = splitFullName(fullName);
      const formattedNom = (nom || '').toUpperCase();
      const formattedPrenom = (prenom || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      toInsertStudents.push({
        school_id: profile.school_id,
        full_name: displayName(formattedNom, formattedPrenom),
        nom: formattedNom,
        prenom: formattedPrenom,
        matricule: idx.matricule !== -1 ? (r[idx.matricule] || '').trim() || null : null,
        parent_phone: idx.tel !== -1 ? (r[idx.tel] || '').trim() || null : null,
      });
      enrollmentInfo.push({
        classeId: classeObj.id,
        montantDu: idx.du !== -1 ? Number(r[idx.du]) || 0 : 0,
        fraisConnexeDu: idx.connexeDu !== -1 ? Number(r[idx.connexeDu]) || 0 : 0,
        soldeEcolage: idx.soldeEcolage !== -1 ? Number(r[idx.soldeEcolage]) || 0 : 0,
        soldeConnexe: idx.soldeConnexe !== -1 ? Number(r[idx.soldeConnexe]) || 0 : 0,
      });
    });

    // Vérification du quota AVANT d'importer
    if (quota !== Infinity) {
      const disponible = quota - studentCount;
      if (toInsertStudents.length > disponible) {
        setImportMessage({
          type: 'error',
          text: `Votre plan ${planLabel} permet ${quota} élèves maximum. Vous en avez déjà ${studentCount}, il reste donc ${disponible} place${disponible > 1 ? 's' : ''}. Le fichier contient ${toInsertStudents.length} élèves à importer. Réduis le fichier ou passe au plan supérieur.`,
        });
        return;
      }
    }
    
    if (toInsertStudents.length === 0) {
      setImportMessage({ type: 'error', text: `Aucun élève importé. Vérifie que les noms de classes dans ton fichier correspondent exactement aux classes créées dans EcoGès (${(classes || []).map((c) => c.nom).join(', ') || 'aucune classe'}).` });
      return;
    }
    
    setImporting(true);
    const importRows = toInsertStudents.map((s, i) => ({
      nom: s.nom, prenom: s.prenom, full_name: s.full_name, matricule: s.matricule, parent_phone: s.parent_phone,
      classe_id: enrollmentInfo[i].classeId, montant_du: enrollmentInfo[i].montantDu, frais_connexe_du: enrollmentInfo[i].fraisConnexeDu,
      solde_ecolage_anterieur: enrollmentInfo[i].soldeEcolage, solde_connexe_anterieur: enrollmentInfo[i].soldeConnexe,
    }));
    const { data: importedCount, error: importError } = await supabase.rpc('import_students_csv', { p_school_id: profile.school_id, p_school_year_id: activeYear.id, p_rows: importRows });
    setImporting(false);
    if (importError) { 
      setImportMessage({ type: 'error', text: translateError(importError) });
      return; 
    }
    setImportMessage({ type: 'success', text: `${importedCount} élève${importedCount > 1 ? 's' : ''} importé${importedCount > 1 ? 's' : ''}${skipped ? `, ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}` : ''}.` });
    reload();
  }

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = filtered.map((s) => s.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteOne(id, name) {
    if (!(await confirm(`Supprimer définitivement ${name} ? Ses paiements, notes et présences seront aussi supprimés. Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { 
      setError(translateError(deleteError));
      return; 
    }
    reload();
  }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} élève${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { 
      setError(translateError(deleteError));
      return; 
    }
    exitSelectMode(); reload();
  }

  const upgradeMessage = `Bonjour, je souhaite passer au plan supérieur d'EcoGès car j'ai atteint la limite de mon plan ${planLabel} (${quota} élèves). Pouvez-vous me donner les prochaines étapes ?`;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}
      {tour.Runner}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
            Élèves
          </p>
          <tour.Button />
        </div>
        <div data-tour="students-actions" style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}><i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter</button>
          
          {!isHistorical && (
            <button onClick={downloadTemplate} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center' }}>
              <i className="ti ti-download" style={{ fontSize: 14, marginRight: 6 }} aria-hidden="true"></i>Télécharger le modèle
            </button>
          )}

          {!isHistorical && (
            <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: (importing || quotaReached) ? 'not-allowed' : 'pointer', opacity: (importing || quotaReached) ? 0.5 : 1 }} title={quotaReached ? `Limite du plan ${planLabel} atteinte (${quota} élèves)` : undefined}>
              <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
              {importing ? 'Import…' : 'Importer'}
              <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleImportFile} disabled={importing || quotaReached} style={{ display: 'none' }} />
            </label>
          )}
          {!isHistorical && (
            <button onClick={() => { setEditingStudent(null); setModalOpen(true); }} disabled={classes === null || !activeYear || quotaReached} title={quotaReached ? `Limite du plan ${planLabel} atteinte (${quota} élèves)` : undefined} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: (classes === null || !activeYear || quotaReached) ? 0.5 : 1, cursor: quotaReached ? 'not-allowed' : 'pointer' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
            </button>
          )}
          {canDelete && !selectMode && (
            <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
              Sélectionner
            </button>
          )}
        </div>
      </div>

      {/* Bandeau quota */}
      {!isHistorical && (quotaWarning || quotaReached) && (
        <div className="card-bold" style={{ padding: '12px 16px', marginBottom: 14, background: quotaReached ? 'var(--danger-light)' : 'var(--amber-light)', borderColor: quotaReached ? 'var(--danger)' : 'var(--amber)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: '1 1 300px' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: quotaReached ? 'var(--danger)' : 'var(--clay-dark)', flexShrink: 0, marginTop: 1 }} aria-hidden="true"></i>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: quotaReached ? 'var(--danger)' : 'var(--clay-dark)' }}>
                  {quotaReached
                    ? `Limite atteinte — ${studentCount} / ${quota} élèves (plan ${planLabel})`
                    : `Vous approchez de la limite — ${studentCount} / ${quota} élèves (plan ${planLabel})`}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: quotaReached ? 'var(--danger)' : 'var(--clay-dark)', lineHeight: 1.5 }}>
                  {quotaReached
                    ? 'Vous ne pouvez plus inscrire de nouveaux élèves. Passez à un plan supérieur pour continuer.'
                    : `Il vous reste ${quota - studentCount} place${(quota - studentCount) > 1 ? 's' : ''} avant la limite de votre plan.`}
                </p>
              </div>
            </div>
            <a
              href={supportWhatsappLink(upgradeMessage)}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: quotaReached ? 'var(--danger)' : 'var(--clay)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}
            >
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 14 }} aria-hidden="true"></i>
              Passer au plan supérieur
            </a>
          </div>
        </div>
      )}

      {importMessage && (
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', fontWeight: 600, color: importMessage.type === 'error' ? 'var(--danger)' : 'var(--success)', lineHeight: 1.5 }}>{importMessage.text}</p>
      )}

      <div data-tour="students-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => setClassFilter('toutes')} style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, border: `1px solid ${classFilter === 'toutes' ? 'var(--forest)' : 'var(--line-strong)'}`, background: classFilter === 'toutes' ? 'var(--forest)' : 'var(--paper)', color: classFilter === 'toutes' ? '#fff' : 'var(--ink)' }}>
          Toutes <span style={{ opacity: 0.7 }}>{students.length}</span>
        </button>
        <Dropdown
          value={classFilter === 'toutes' ? '' : classFilter}
          onChange={(v) => setClassFilter(v || 'toutes')}
          options={[{ value: '', label: 'Filtrer par classe…' }, ...(classes || []).map((c) => ({ value: c.nom, label: `${c.nom} (${students.filter((s) => s.niveau === c.nom).length})` }))]}
          textColor={classFilter !== 'toutes' ? '#fff' : 'var(--ink)'}
          chevronColor={classFilter !== 'toutes' ? '#fff' : 'var(--muted)'}
          style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, border: `1px solid ${classFilter !== 'toutes' ? 'var(--forest)' : 'var(--line-strong)'}`, background: classFilter !== 'toutes' ? 'var(--forest)' : 'var(--paper)' }}
          wrapperStyle={{ width: 'auto' }}
        />
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
        {filtered.length} élève{filtered.length > 1 ? 's' : ''} {classFilter === 'toutes' ? '· toutes classes' : `· ${classFilter}`}
        {quota !== Infinity && <span style={{ marginLeft: 8 }}>· {studentCount} / {quota} (plan {planLabel})</span>}
      </p>

      <div data-tour="students-list" className="card-bold" style={{ overflowX: 'scroll', maxHeight: 'calc(100vh - 220px)', overflowY: 'scroll', scrollbarGutter: 'stable' }}>
        <div style={{ minWidth: selectMode ? 1100 : 1060 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '12px 20px' : '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
            {selectMode && <span></span>}
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: selectMode ? 0 : 20 }}>Élève</span>
            <span>Matricule</span>
            <span>Sexe</span>
            <span>Classe</span>
            <span>Inscription</span>
            <span>Tél. Parent</span>
            <span>Reste</span>
            <span>Statut</span>
            {!selectMode && <span></span>}
          </div>
          {filtered.map((s, i) => {
            const status = statusOf(s, schoolYear, feeSchedulesByNiveau[s.classeNiveau]);
            const reste = Number(s.montant_du) - Number(s.montant_paye);
            return (
              <div key={s.id} className="row-link" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: selectMode ? '13px 20px' : '13px 20px 13px 0', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none' }}>
                {canDelete && selectMode && (
                  <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleOne(s.id)} />
                )}
                <Link
                  to={selectMode ? '#' : `/eleves/${s.id}`}
                  onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(s.id); } : undefined}
                  style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, ...stickyColStyle('var(--paper)'), paddingLeft: selectMode ? 0 : 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '12.5px', fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                      {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                      {s.full_name}
                    </p>
                  </div>
                  <span style={{ fontSize: 13 }}>{s.matricule || '—'}</span>
                  <span style={{ fontSize: 13 }}>{s.sexe || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.niveau}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.parent_phone || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(reste)}</span>
                  <span style={{ background: status.bg, color: status.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>{status.label}</span>
                </Link>
                {!selectMode && (canEdit || canDelete) && (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0, justifyContent: 'flex-end', paddingRight: 20 }}>
                    {canEdit && (
                      <button type="button" onClick={() => { setEditingStudent(s); setModalOpen(true); }} title="Modifier" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                        <PencilIcon />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => handleDeleteOne(s.id, s.full_name)} title="Supprimer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            classFilter === 'toutes'
              ? <EmptyState icon={<UsersIcon />} title="Aucun élève inscrit" subtitle="Ajoute ton premier élève pour commencer à suivre sa scolarité et ses paiements." actionLabel={!isHistorical && !quotaReached ? 'Inscrire un élève' : undefined} onAction={(!isHistorical && !quotaReached) ? () => { setEditingStudent(null); setModalOpen(true); } : undefined} />
              : <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève dans cette classe.</p>
          )}
        </div>
      </div>

      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      {modalOpen && schoolYear && (
        <NewStudentModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          classes={classes || []}
          canManageParents={['fondateur', 'directeur', 'secretaire'].includes(profile.role)}
          student={editingStudent}
          isHistorical={isHistorical}
          plan={plan}
          studentsCount={studentCount}
          onClose={() => { setModalOpen(false); setEditingStudent(null); }}
          onCreated={() => { setModalOpen(false); setEditingStudent(null); reload(); }}
        />
      )}
    </div>
  );
}
