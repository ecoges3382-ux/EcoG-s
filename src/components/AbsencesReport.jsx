import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { downloadCsv } from '../lib/utils.js';
import { printDocument, slug } from '../lib/print.js';
import DocumentHeader from './DocumentHeader.jsx';
import Dropdown from './Dropdown.jsx';
import { SkeletonTableRows } from './Skeleton.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { translateError } from '../lib/errors.js';

function formatHeures(decimalHeures) {
  const total = Number(decimalHeures) || 0;
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return `${h}h${String(r).padStart(2, '0')}`;
  return `${r} min`;
}

function demiJourneeLabel(d) {
  if (d === 'matin') return 'Matin';
  if (d === 'apres_midi') return 'Après-midi';
  return 'Journée';
}

function motifLabel(ev) {
  if (ev.absence_motifs?.code) return `${ev.absence_motifs.code}. ${ev.absence_motifs.libelle}`;
  return ev.motif_libre || 'Motif non précisé';
}

const PERIODES = [
  { id: 'annee', label: 'Année complète' },
  { id: '30j', label: '30 derniers jours' },
  { id: 'mois', label: 'Ce mois' },
];

// Onglet "Absences & retards" du module Rapports. Contrairement au
// récapitulatif individuel de la fiche élève (AbsencesPanel.jsx), celui-ci
// s'adresse à la direction : il agrège TOUS les élèves de l'année pour
// repérer les situations inquiétantes. Vue par classe par défaut (tableau
// trié par nombre d'absences décroissant), drill-down par élève pour le
// détail — même logique que le PDF de référence, mais navigable à l'écran.
export default function AbsencesReport({ school, schoolYear }) {
  const { profile } = useAuth();
  const [absences, setAbsences] = useState(null);
  const [retards, setRetards] = useState(null);
  const [students, setStudents] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [periode, setPeriode] = useState('annee');
  const [classeFilter, setClasseFilter] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Chargement groupé : absences + retards + élèves inscrits + classes
  const loadAll = () => {
    if (!schoolYear) return;
    const [start, end] = boundsFor(periode);
    const qAbs = supabase.from('absence_events')
      .select('*, absence_motifs(code, libelle, categorie)')
      .eq('school_year_id', schoolYear.id);
    const qLate = supabase.from('late_events')
      .select('*, absence_motifs(code, libelle, categorie)')
      .eq('school_year_id', schoolYear.id);
    if (start) qAbs.gte('date', start);
    if (end) qAbs.lte('date', end);
    if (start) qLate.gte('date', start);
    if (end) qLate.lte('date', end);

    guardedFetch({
      cacheKey: `absences_report_${schoolYear.id}_${periode}`,
      hasData: absences !== null,
      load: async () => {
        const [
          { data: abs, error: e1 },
          { data: late, error: e2 },
          { data: enr, error: e3 },
          { data: cls },
        ] = await Promise.all([
          qAbs,
          qLate,
          supabase.from('enrollments')
            .select('student_id, classe_id, students ( id, full_name, matricule ), classes ( id, nom, niveau )')
            .eq('school_year_id', schoolYear.id),
          supabase.from('classes').select('id, nom').order('nom'),
        ]);
        if (e1) return { error: e1 };
        if (e2) return { error: e2 };
        if (e3) return { error: e3 };
        return {
          data: {
            absences: abs || [],
            retards: late || [],
            students: enr || [],
            classes: cls || [],
          },
        };
      },
      setData: ({ absences: a, retards: l, students: s, classes: c }) => {
        setAbsences(a);
        setRetards(l);
        setStudents(s);
        setClasses(c);
      },
      onError: (err) => setError(translateError(err)),
      onSuccess: () => setError(''),
    });
  };

  useEffect(() => { loadAll(); }, [schoolYear?.id, periode]);

  // Index pratique : studentId → { absences[], retards[] }
  const byStudent = useMemo(() => {
    const map = new Map();
    (absences || []).forEach((a) => {
      if (!map.has(a.student_id)) map.set(a.student_id, { absences: [], retards: [] });
      map.get(a.student_id).absences.push(a);
    });
    (retards || []).forEach((l) => {
      if (!map.has(l.student_id)) map.set(l.student_id, { absences: [], retards: [] });
      map.get(l.student_id).retards.push(l);
    });
    return map;
  }, [absences, retards]);

  // Lignes du tableau : un élève par ligne, trié par nombre d'heures manquées
  // décroissant (les plus problématiques en haut), filtré par classe si demandé.
  const rows = useMemo(() => {
    if (!students) return [];
    return students
      .map((en) => {
        const ev = byStudent.get(en.student_id) || { absences: [], retards: [] };
        const heures = ev.absences.reduce((s, a) => s + (Number(a.duree_heures) || 0), 0);
        const demiJournees = ev.absences.reduce((s, a) => s + (a.demi_journee === 'journee' ? 2 : 1), 0);
        const minutesRetard = ev.retards.reduce((s, l) => s + (Number(l.duree_minutes) || 0), 0);
        return {
          studentId: en.student_id,
          fullName: en.students?.full_name || '—',
          matricule: en.students?.matricule,
          classeId: en.classe_id,
          classeNom: en.classes?.nom || '—',
          nbAbsences: ev.absences.length,
          heures,
          demiJournees,
          nbRetards: ev.retards.length,
          minutesRetard,
          absences: ev.absences,
          retards: ev.retards,
        };
      })
      .filter((r) => !classeFilter || r.classeId === classeFilter)
      .filter((r) => r.nbAbsences > 0 || r.nbRetards > 0)
      .sort((a, b) => b.heures - a.heures || b.nbAbsences - a.nbAbsences || a.fullName.localeCompare(b.fullName));
  }, [students, byStudent, classeFilter]);

  // Totaux globaux pour les 3 mini-stats
  const totals = useMemo(() => ({
    nbEleves: rows.length,
    nbAbsences: rows.reduce((s, r) => s + r.nbAbsences, 0),
    heures: rows.reduce((s, r) => s + r.heures, 0),
    nbRetards: rows.reduce((s, r) => s + r.nbRetards, 0),
    minutesRetard: rows.reduce((s, r) => s + r.minutesRetard, 0),
  }), [rows]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!schoolYear) return null;
  if (!absences || !retards || !students) {
    return <div className="card-bold"><SkeletonTableRows count={6} columns={5} /></div>;
  }

  const periodeLabel = periodLabel(periode);
  const classeLabel = classeFilter
    ? (classes.find((c) => c.id === classeFilter)?.nom || '')
    : 'Toutes les classes';
  const selectedStudent = selectedStudentId ? rows.find((r) => r.studentId === selectedStudentId) : null;

  // ---- Vue détail d'un élève ----
  if (selectedStudent) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedStudentId(null)}
          style={{ marginBottom: 14, fontSize: 12.5, fontWeight: 600, color: 'var(--forest)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true"></i>
          Retour à la liste
        </button>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => printDocument(`recap-absences-${slug(selectedStudent.fullName)}-${slug(schoolYear.label)}`)} style={btnPrimary}>
            <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
          </button>
          <button onClick={() => exportStudentCsv(selectedStudent, schoolYear)} style={btnSecondary}>
            <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Export CSV
          </button>
        </div>

        <div className="card-bold print-sheet" style={{ padding: '24px 26px', maxWidth: 860 }}>
          <DocumentHeader school={school} title="Récapitulatif absences et retards" subtitle={periodeLabel} />

          <p style={{ margin: '0 0 16px', fontSize: 13.5, fontWeight: 600 }}>
            {selectedStudent.fullName}
            {selectedStudent.classeNom ? ` — ${selectedStudent.classeNom}` : ''}
            {selectedStudent.matricule ? ` (${selectedStudent.matricule})` : ''}
          </p>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            Absences ({selectedStudent.nbAbsences} · {formatHeures(selectedStudent.heures)} · {selectedStudent.demiJournees} demi-journées)
          </p>
          {selectedStudent.absences.length === 0 ? (
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--muted)' }}>Aucune absence enregistrée sur la période.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Motif</th>
                  <th style={thRightStyle}>Heures</th>
                  <th style={thCenterStyle}>Demi-j.</th>
                  <th style={thCenterStyle}>Justifié</th>
                  <th style={thCenterStyle}>Santé</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudent.absences.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={tdStyle}>{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                    <td style={tdStyle}>{motifLabel(a)}</td>
                    <td style={tdRightStyle}>{formatHeures(a.duree_heures)}</td>
                    <td style={tdCenterStyle}>{demiJourneeLabel(a.demi_journee)}</td>
                    <td style={tdCenterStyle}>{a.justifie ? 'OUI' : 'NON'}</td>
                    <td style={tdCenterStyle}>{a.sante ? 'OUI' : 'NON'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            Retards ({selectedStudent.nbRetards} · {formatMinutes(selectedStudent.minutesRetard)})
          </p>
          {selectedStudent.retards.length === 0 ? (
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--muted)' }}>Aucun retard enregistré sur la période.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Début</th>
                  <th style={thRightStyle}>Durée</th>
                  <th style={thStyle}>Matière</th>
                  <th style={thStyle}>Motif</th>
                  <th style={thCenterStyle}>Justifié</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudent.retards.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={tdStyle}>{new Date(l.date).toLocaleDateString('fr-FR')}</td>
                    <td style={tdStyle}>{l.heure_debut?.slice(0, 5)}</td>
                    <td style={tdRightStyle}>{formatMinutes(l.duree_minutes)}</td>
                    <td style={tdStyle}>{l.matiere || '—'}</td>
                    <td style={tdStyle}>{motifLabel(l)}</td>
                    <td style={tdCenterStyle}>{l.justifie ? 'OUI' : 'NON'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ margin: '12px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>
            Document généré le {new Date().toLocaleDateString('fr-FR')} — {periodeLabel}, {classeLabel}.
          </p>
        </div>
      </div>
    );
  }

  // ---- Vue liste (par défaut) ----
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => printDocument(`rapport-absences-${slug(schoolYear.label)}`)} style={btnPrimary}>
          <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
        </button>
        <button onClick={() => exportListCsv(rows, schoolYear, periodeLabel, classeLabel)} style={btnSecondary}>
          <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Export CSV
        </button>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODES.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPeriode(p.id); setSelectedStudentId(null); }}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${periode === p.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: periode === p.id ? 'var(--forest)' : 'var(--paper)', color: periode === p.id ? '#fff' : 'var(--ink)' }}
          >
            {p.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', minWidth: 200 }}>
          <Dropdown
            value={classeFilter}
            onChange={setClasseFilter}
            options={[{ value: '', label: 'Toutes les classes' }, ...classes.map((c) => ({ value: c.id, label: c.nom }))]}
            style={{ padding: '8px 12px', fontSize: 12.5 }}
          />
        </div>
      </div>

      <div className="card-bold print-sheet" style={{ padding: '24px 26px' }}>
        <DocumentHeader school={school} title="Rapport des absences et retards" subtitle={periodeLabel} />
        <p style={{ margin: '0 0 18px', fontSize: 11.5, color: 'var(--muted)' }}>
          {classeLabel} — {rows.length} élève{rows.length > 1 ? 's' : ''} avec au moins une absence ou un retard sur la période.
        </p>

        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          <MiniStat label="Absences cumulées" value={totals.nbAbsences} color="var(--danger)" />
          <MiniStat label="Heures manquées" value={formatHeures(totals.heures)} color="var(--danger)" />
          <MiniStat label="Retards cumulés" value={totals.nbRetards} color="var(--amber)" />
        </div>

        {rows.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>
            Aucune absence ni aucun retard enregistré sur cette période.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
              <thead>
                <tr style={{ background: 'var(--forest-light)', borderBottom: '1px solid var(--line-strong)' }}>
                  <th style={{ ...thStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Élève</th>
                  <th style={{ ...thStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Classe</th>
                  <th style={{ ...thCenterStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Absences</th>
                  <th style={{ ...thRightStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Heures</th>
                  <th style={{ ...thCenterStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Demi-j.</th>
                  <th style={{ ...thCenterStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Retards</th>
                  <th style={{ ...thRightStyle, padding: '10px 12px', color: 'var(--forest-dark)' }}>Durée retards</th>
                  <th className="no-print" style={{ padding: '10px 12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.studentId}
                    className="no-print-hover"
                    style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                    onClick={() => setSelectedStudentId(r.studentId)}
                  >
                    <td style={{ ...tdStyle, padding: '10px 12px', fontWeight: 600 }}>{r.fullName}</td>
                    <td style={{ ...tdStyle, padding: '10px 12px', color: 'var(--muted)' }}>{r.classeNom}</td>
                    <td style={{ ...tdCenterStyle, padding: '10px 12px', color: r.nbAbsences > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>{r.nbAbsences}</td>
                    <td style={{ ...tdRightStyle, padding: '10px 12px', fontWeight: 600 }}>{formatHeures(r.heures)}</td>
                    <td style={{ ...tdCenterStyle, padding: '10px 12px', color: 'var(--muted)' }}>{r.demiJournees}</td>
                    <td style={{ ...tdCenterStyle, padding: '10px 12px', color: r.nbRetards > 0 ? 'var(--amber)' : 'var(--muted)', fontWeight: 600 }}>{r.nbRetards}</td>
                    <td style={{ ...tdRightStyle, padding: '10px 12px' }}>{formatMinutes(r.minutesRetard)}</td>
                    <td className="no-print" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11.5, color: 'var(--forest)', fontWeight: 600 }}>Détail →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ margin: '16px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>
          Document généré le {new Date().toLocaleDateString('fr-FR')}.
        </p>
      </div>
    </div>
  );
}

function boundsFor(periode) {
  if (periode === 'annee') return [null, null];
  const today = new Date();
  if (periode === 'mois') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return [start.toISOString().slice(0, 10), null];
  }
  if (periode === '30j') {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return [start.toISOString().slice(0, 10), null];
  }
  return [null, null];
}

function periodLabel(periode) {
  const today = new Date();
  if (periode === 'mois') return today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  if (periode === '30j') {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return `du ${start.toLocaleDateString('fr-FR')} au ${today.toLocaleDateString('fr-FR')}`;
  }
  return 'Année complète';
}

function exportListCsv(rows, schoolYear, periodeLabel, classeLabel) {
  const lines = [
    ['Élève', 'Classe', 'Absences', 'Heures manquées', 'Demi-journées', 'Retards', 'Durée retards'],
    ...rows.map((r) => [
      r.fullName,
      r.classeNom,
      r.nbAbsences,
      formatHeures(r.heures),
      r.demiJournees,
      r.nbRetards,
      formatMinutes(r.minutesRetard),
    ]),
    [],
    ['Période', periodeLabel],
    ['Classe(s)', classeLabel],
    ['Année scolaire', schoolYear.label],
  ];
  downloadCsv(`absences-retards-${slug(schoolYear.label)}.csv`, lines);
}

function exportStudentCsv(student, schoolYear) {
  const lines = [
    ['Absences'],
    ['Date', 'Motif', 'Heures', 'Demi-journée', 'Justifié', 'Santé'],
    ...student.absences.map((a) => [
      new Date(a.date).toLocaleDateString('fr-FR'),
      motifLabel(a),
      formatHeures(a.duree_heures),
      demiJourneeLabel(a.demi_journee),
      a.justifie ? 'OUI' : 'NON',
      a.sante ? 'OUI' : 'NON',
    ]),
    [],
    ['Retards'],
    ['Date', 'Début', 'Durée', 'Matière', 'Motif', 'Justifié'],
    ...student.retards.map((l) => [
      new Date(l.date).toLocaleDateString('fr-FR'),
      l.heure_debut?.slice(0, 5),
      formatMinutes(l.duree_minutes),
      l.matiere || '',
      motifLabel(l),
      l.justifie ? 'OUI' : 'NON',
    ]),
    [],
    ['Élève', student.fullName],
    ['Classe', student.classeNom],
    ['Année scolaire', schoolYear.label],
  ];
  downloadCsv(`recap-absences-${slug(student.fullName)}-${slug(schoolYear.label)}.csv`, lines);
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const btnPrimary = { fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' };
const btnSecondary = { fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' };
const thStyle = { textAlign: 'left', padding: '6px 4px', fontWeight: 700 };
const thRightStyle = { textAlign: 'right', padding: '6px 4px', fontWeight: 700 };
const thCenterStyle = { textAlign: 'center', padding: '6px 4px', fontWeight: 700 };
const tdStyle = { padding: '6px 4px' };
const tdRightStyle = { padding: '6px 4px', textAlign: 'right' };
const tdCenterStyle = { padding: '6px 4px', textAlign: 'center' };
