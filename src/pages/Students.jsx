import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmt, initials, downloadCsv, parseCsv, splitFullName, sortClasses, displayName } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import NewStudentModal from '../components/NewStudentModal.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

// Une fois un calendrier de paiement configuré (Argent → Grille tarifaire),
// le statut se base sur les délais dépassés plutôt que sur un pourcentage
// fixe — voir computeRelance dans lib/retard.js. Tant qu'aucune date n'est
// configurée, on garde l'ancien calcul par pourcentage (pas de régression
// pour une école qui n'a pas encore rempli son calendrier).
function statusOf(s, schoolYear) {
  const relance = computeRelance(s, schoolYear);
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

export default function Students() {
  const { profile } = useAuth();
  const { schoolYear, activeYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');
  const [classFilter, setClassFilter] = useState('toutes');
  const [modalOpen, setModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  // Suppression désactivée en consultation d'un historique : c'est une
  // action globale et irréversible sur l'identité de l'élève (students),
  // pas une correction propre à l'année consultée.
  const canDelete = CAN_DELETE_ROLES.includes(profile.role) && !isHistorical;

  // La liste des élèves vient des inscriptions de l'année scolaire en
  // cours (enrollments), pas directement de "students" — c'est elle qui
  // porte désormais la classe et le dû/payé, propres à chaque année.
  async function reload() {
    if (!schoolYear) return;
    const { data, error: fetchError } = await supabase
      .from('enrollments')
      .select('id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, classes ( nom ), students ( id, full_name, nom, prenom, matricule, parent_phone, photo_url )')
      .eq('school_year_id', schoolYear.id)
      .order('full_name', { foreignTable: 'students' });
    if (fetchError) { setError(fetchError.message); return; }
    setStudents((data || []).map((e) => ({
      id: e.students.id,
      enrollment_id: e.id,
      full_name: e.students.full_name,
      nom: e.students.nom,
      prenom: e.students.prenom,
      matricule: e.students.matricule,
      parent_phone: e.students.parent_phone,
      photo_url: e.students.photo_url,
      classe_id: e.classe_id,
      niveau: e.classes?.nom || '—',
      montant_du: e.montant_du,
      montant_paye: e.montant_paye,
      frais_connexe_du: e.frais_connexe_du,
      frais_connexe_paye: e.frais_connexe_paye,
      note_arrangement: e.note_arrangement,
    })));
  }

  useEffect(() => {
    if (!schoolYear) return;
    reload();
    // Les classes disponibles à l'inscription et à l'import CSV sont
    // celles réellement créées par l'école (page Classes) — pas une liste
    // générique de la maternelle à la terminale.
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => {
      setClasses(sortClasses(data || []));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const filtered = classFilter === 'toutes' ? students : students.filter((s) => s.niveau === classFilter);

  function exportCsv() {
    const rows = [['Matricule', 'Nom', 'Classe', 'Montant dû', 'Payé', 'Reste', 'Téléphone parent']];
    students.forEach((s) => {
      rows.push([s.matricule || '', s.full_name, s.niveau, s.montant_du, s.montant_paye, Number(s.montant_du) - Number(s.montant_paye), s.parent_phone || '']);
    });
    downloadCsv('eleves.csv', rows);
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportMessage(null);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setImportMessage({ type: 'error', text: 'Fichier vide ou illisible.' });
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      matricule: header.indexOf('matricule'),
      nom: header.indexOf('nom'),
      classe: header.indexOf('classe'),
      du: header.findIndex((h) => h.startsWith('montant d')),
      tel: header.findIndex((h) => h.startsWith('téléphone') || h.startsWith('telephone')),
    };
    if (idx.nom === -1 || idx.classe === -1) {
      setImportMessage({ type: 'error', text: 'Le fichier doit contenir au moins les colonnes "Nom" et "Classe".' });
      return;
    }
    const toInsertStudents = [];
    const enrollmentInfo = []; // aligné index à index avec toInsertStudents
    let skipped = 0;
    rows.slice(1).forEach((r) => {
      const fullName = (r[idx.nom] || '').trim();
      const classeNom = (r[idx.classe] || '').trim();
      const classeObj = (classes || []).find((c) => c.nom === classeNom);
      if (!fullName || !classeObj) { skipped += 1; return; }
      const { nom, prenom } = splitFullName(fullName);
      toInsertStudents.push({
        school_id: profile.school_id,
        full_name: displayName(nom, prenom),
        nom,
        prenom,
        matricule: idx.matricule !== -1 ? (r[idx.matricule] || '').trim() || null : null,
        parent_phone: idx.tel !== -1 ? (r[idx.tel] || '').trim() || null : null,
      });
      enrollmentInfo.push({
        classeId: classeObj.id,
        montantDu: idx.du !== -1 ? Number(r[idx.du]) || 0 : 0,
      });
    });
    if (toInsertStudents.length === 0) {
      setImportMessage({ type: 'error', text: `Aucune ligne valide (classe reconnue attendue : ${(classes || []).map((c) => c.nom).join(', ') || 'aucune classe créée pour l\'instant'}).` });
      return;
    }
    setImporting(true);
    // Tout le fichier dans un seul appel RPC, donc une seule transaction :
    // soit toutes les lignes sont importées, soit aucune (voir
    // import_students_csv dans supabase/schema.sql). Les lignes invalides
    // (nom vide, classe non reconnue) ont déjà été filtrées ci-dessus,
    // avant l'appel — un échec ici est un vrai problème de fond, pas une
    // ligne à corriger, donc bloquer tout le fichier plutôt que produire un
    // import à moitié fait est le bon choix.
    const importRows = toInsertStudents.map((s, i) => ({
      nom: s.nom,
      prenom: s.prenom,
      full_name: s.full_name,
      matricule: s.matricule,
      parent_phone: s.parent_phone,
      classe_id: enrollmentInfo[i].classeId,
      montant_du: enrollmentInfo[i].montantDu,
    }));
    const { data: importedCount, error: importError } = await supabase.rpc('import_students_csv', {
      p_school_id: profile.school_id,
      // Toujours l'année active, jamais l'année consultée : importer des
      // élèves crée de nouvelles identités, ça n'a de sens que pour
      // l'année en cours (le bouton est de toute façon masqué en
      // consultation d'un historique, mais on ne veut pas en dépendre).
      p_school_year_id: activeYear.id,
      p_rows: importRows,
    });
    setImporting(false);
    if (importError) {
      setImportMessage({ type: 'error', text: importError.message });
      return;
    }
    setImportMessage({ type: 'success', text: `${importedCount} élève${importedCount > 1 ? 's' : ''} importé${importedCount > 1 ? 's' : ''}${skipped ? `, ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}` : ''}.` });
    reload();
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = filtered.map((s) => s.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleDeleteOne(id, name) {
    if (!window.confirm(`Supprimer définitivement ${name} ? Ses paiements, notes et présences seront aussi supprimés. Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    reload();
  }

  async function handleDeleteSelected() {
    if (!window.confirm(`Supprimer définitivement ${selectedIds.length} élève${selectedIds.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Élèves</p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
          </button>
          {!isHistorical && (
            <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.7 : 1 }}>
              <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
              {importing ? 'Import…' : 'Importer'}
              <input type="file" accept=".csv,text/csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
            </label>
          )}
          {!isHistorical && (
            <button
              onClick={() => setModalOpen(true)}
              disabled={classes === null || !activeYear}
              style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: classes === null || !activeYear ? 0.7 : 1 }}
            >
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
            </button>
          )}
          {canDelete && !selectMode && (
            <button
              onClick={() => setSelectMode(true)}
              style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}
            >
              Sélectionner
            </button>
          )}
        </div>
      </div>

      {importMessage && (
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', fontWeight: 600, color: importMessage.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
          {importMessage.text}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button
          onClick={() => setClassFilter('toutes')}
          style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, border: `1px solid ${classFilter === 'toutes' ? 'var(--forest)' : 'var(--line-strong)'}`, background: classFilter === 'toutes' ? 'var(--forest)' : 'var(--paper)', color: classFilter === 'toutes' ? '#fff' : 'var(--ink)' }}
        >
          Toutes <span style={{ opacity: 0.7 }}>{students.length}</span>
        </button>
        {/* Menu déroulant plutôt qu'un bouton par classe : une école avec
            10+ classes ne peut pas toutes les lister une à une côte à côte. */}
        <select
          value={classFilter === 'toutes' ? '' : classFilter}
          onChange={(e) => setClassFilter(e.target.value || 'toutes')}
          style={{
            padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${classFilter !== 'toutes' ? 'var(--forest)' : 'var(--line-strong)'}`,
            background: classFilter !== 'toutes' ? 'var(--forest)' : 'var(--paper)',
            color: classFilter !== 'toutes' ? '#fff' : 'var(--ink)',
          }}
        >
          <option value="">Filtrer par classe…</option>
          {(classes || []).map((c) => (
            <option key={c.id} value={c.nom}>{c.nom} ({students.filter((s) => s.niveau === c.nom).length})</option>
          ))}
        </select>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
        {filtered.length} élève{filtered.length > 1 ? 's' : ''} {classFilter === 'toutes' ? '· toutes classes' : `· ${classFilter}`}
      </p>

      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {filtered.map((s, i) => {
          const status = statusOf(s, schoolYear);
          return (
            <div
              key={s.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none' }}
            >
              {canDelete && selectMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleOne(s.id)}
                  style={{ flexShrink: 0 }}
                />
              )}
              <Link
                to={selectMode ? '#' : `/eleves/${s.id}`}
                onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(s.id); } : undefined}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '12.5px', fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                    {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.full_name}</p>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{s.niveau}</p>
                  </div>
                </div>
                <span style={{ background: status.bg, color: status.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, flexShrink: 0, marginLeft: 10 }}>{status.label}</span>
              </Link>
              {canDelete && !selectMode && (
                <button
                  type="button"
                  onClick={() => handleDeleteOne(s.id, s.full_name)}
                  title="Supprimer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève.</p>}
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

      {modalOpen && activeYear && (
        <NewStudentModal
          schoolId={profile.school_id}
          schoolYearId={activeYear.id}
          classes={classes || []}
          canManageParents={['fondateur', 'directeur', 'secretaire'].includes(profile.role)}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
