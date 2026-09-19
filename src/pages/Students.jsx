import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmt, initials, downloadCsv, parseCsv, NIVEAUX } from '../lib/utils.js';
import NewStudentModal from '../components/NewStudentModal.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

function statusOf(s) {
  const reste = Number(s.montant_du) - Number(s.montant_paye);
  if (reste <= 0) return { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' };
  const ratioPaye = Number(s.montant_du) > 0 ? Number(s.montant_paye) / Number(s.montant_du) : 0;
  if (ratioPaye >= 0.4) return { label: 'Retard léger', bg: 'var(--amber-light)', fg: 'var(--amber)' };
  return { label: 'Retard critique', bg: 'var(--danger-light)', fg: 'var(--danger)' };
}

export default function Students() {
  const { profile } = useAuth();
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [classFilter, setClassFilter] = useState('toutes');
  const [modalOpen, setModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .order('full_name');
    if (fetchError) setError(fetchError.message);
    else setStudents(data);
  }

  useEffect(() => { reload(); }, []);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const classesPresentes = [...new Set(students.map((s) => s.niveau))];
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
    const toInsert = [];
    let skipped = 0;
    rows.slice(1).forEach((r) => {
      const nom = (r[idx.nom] || '').trim();
      const classe = (r[idx.classe] || '').trim();
      if (!nom || !NIVEAUX.includes(classe)) { skipped += 1; return; }
      toInsert.push({
        school_id: profile.school_id,
        full_name: nom,
        niveau: classe,
        matricule: idx.matricule !== -1 ? (r[idx.matricule] || '').trim() || null : null,
        parent_phone: idx.tel !== -1 ? (r[idx.tel] || '').trim() || null : null,
        montant_du: idx.du !== -1 ? Number(r[idx.du]) || 0 : 0,
        montant_paye: 0,
        frais_connexe_du: 0,
        frais_connexe_paye: 0,
      });
    });
    if (toInsert.length === 0) {
      setImportMessage({ type: 'error', text: `Aucune ligne valide (classe reconnue attendue : ${NIVEAUX.join(', ')}).` });
      return;
    }
    setImporting(true);
    const { error: insertError } = await supabase.from('students').insert(toInsert);
    setImporting(false);
    if (insertError) {
      setImportMessage({ type: 'error', text: insertError.message });
      return;
    }
    setImportMessage({ type: 'success', text: `${toInsert.length} élève${toInsert.length > 1 ? 's' : ''} importé${toInsert.length > 1 ? 's' : ''}${skipped ? `, ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}` : ''}.` });
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Élèves</p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.7 : 1 }}>
            <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            {importing ? 'Import…' : 'Importer'}
            <input type="file" accept=".csv,text/csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
            <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
          </button>
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
        {classesPresentes.map((c) => (
          <button
            key={c}
            onClick={() => setClassFilter(c)}
            style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, border: `1px solid ${classFilter === c ? 'var(--forest)' : 'var(--line-strong)'}`, background: classFilter === c ? 'var(--forest)' : 'var(--paper)', color: classFilter === c ? '#fff' : 'var(--ink)' }}
          >
            {c} <span style={{ opacity: 0.7 }}>{students.filter((s) => s.niveau === c).length}</span>
          </button>
        ))}
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
        {filtered.length} élève{filtered.length > 1 ? 's' : ''} {classFilter === 'toutes' ? '· toutes classes' : `· ${classFilter}`}
      </p>

      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {filtered.map((s, i) => {
          const status = statusOf(s);
          return (
            <Link
              key={s.id}
              to={`/eleves/${s.id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '12.5px', fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                  {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{s.niveau}</p>
                </div>
              </div>
              <span style={{ background: status.bg, color: status.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20 }}>{status.label}</span>
            </Link>
          );
        })}
        {filtered.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève.</p>}
      </div>

      {modalOpen && (
        <NewStudentModal
          schoolId={profile.school_id}
          niveaux={NIVEAUX}
          canManageParents={['fondateur', 'directeur', 'secretaire'].includes(profile.role)}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
