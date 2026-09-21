import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

const STATUTS = [
  { id: 'present', label: 'Présent', bg: 'var(--success-light)', fg: 'var(--success)' },
  { id: 'absent', label: 'Absent', bg: 'var(--danger-light)', fg: 'var(--danger)' },
  { id: 'retard', label: 'Retard', bg: 'var(--amber-light)', fg: 'var(--amber)' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [niveau, setNiveau] = useState('');
  const [date, setDate] = useState(todayIso());
  const [statuts, setStatuts] = useState({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité.
  useEffect(() => {
    if (!schoolYear) return;
    supabase
      .from('enrollments')
      .select('classes ( nom ), students ( id, full_name, photo_url )')
      .eq('school_year_id', schoolYear.id)
      .then(({ data, error: fetchError }) => {
        if (fetchError) { setError(fetchError.message); return; }
        const st = (data || [])
          .map((e) => ({ id: e.students.id, full_name: e.students.full_name, photo_url: e.students.photo_url, niveau: e.classes?.nom || '—' }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
        setStudents(st);
        if (st.length) setNiveau(st[0].niveau);
      });
  }, [schoolYear?.id]);

  const niveaux = useMemo(() => [...new Set((students || []).map((s) => s.niveau))].sort(), [students]);
  const studentsInNiveau = (students || []).filter((s) => s.niveau === niveau);

  useEffect(() => {
    if (!schoolYear || !niveau || studentsInNiveau.length === 0) { setStatuts({}); return; }
    setLoadingRecords(true);
    setSaved(false);
    const ids = studentsInNiveau.map((s) => s.id);
    // school_year_id est nécessaire ici (pas seulement school_id/date) : la
    // contrainte d'unicité porte sur (student_id, school_year_id, date) —
    // un redoublant ou un élève réinscrit une autre année pourrait sinon
    // faire remonter le statut d'une année différente pour la même date.
    supabase
      .from('attendance_records')
      .select('student_id, statut')
      .eq('date', date)
      .eq('school_year_id', schoolYear.id)
      .in('student_id', ids)
      .then(({ data }) => {
        const map = {};
        studentsInNiveau.forEach((s) => { map[s.id] = 'present'; });
        (data || []).forEach((r) => { map[r.student_id] = r.statut; });
        setStatuts(map);
        setLoadingRecords(false);
      });
  }, [schoolYear?.id, niveau, date, students]);

  async function handleSave() {
    setSaving(true);
    setError('');
    const rows = studentsInNiveau.map((s) => ({
      school_id: profile.school_id, school_year_id: schoolYear.id, student_id: s.id, date, statut: statuts[s.id] || 'present',
    }));
    const { error: upsertError } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'student_id,school_year_id,date' });
    setSaving(false);
    if (upsertError) setError(upsertError.message);
    else setSaved(true);
  }

  const counts = { present: 0, absent: 0, retard: 0 };
  studentsInNiveau.forEach((s) => { counts[statuts[s.id] || 'present'] += 1; });

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Présences</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={selectStyle}>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={selectStyle} />
      </div>

      {niveaux.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun élève inscrit pour l'instant.</p>}

      {niveaux.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }} className="desktop-grid-3">
            <Stat label="Présents" value={counts.present} color="var(--success)" />
            <Stat label="Absents" value={counts.absent} color="var(--danger)" />
            <Stat label="Retards" value={counts.retard} color="var(--amber)" />
          </div>

          <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 18, opacity: loadingRecords ? 0.6 : 1 }}>
            {studentsInNiveau.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < studentsInNiveau.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                    {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                  </div>
                  <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {STATUTS.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => { setStatuts((prev) => ({ ...prev, [s.id]: st.id })); setSaved(false); }}
                      style={{
                        fontSize: 11.5, fontWeight: 600, padding: '6px 11px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${statuts[s.id] === st.id ? st.fg : 'var(--line-strong)'}`,
                        background: statuts[s.id] === st.id ? st.bg : 'var(--paper)',
                        color: statuts[s.id] === st.id ? st.fg : 'var(--muted)',
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {studentsInNiveau.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève dans ce niveau.</p>}
          </div>

          {studentsInNiveau.length > 0 && (
            <button onClick={handleSave} disabled={saving} style={{ fontSize: 14, fontWeight: 600, padding: '12px 22px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enregistrement…' : "Enregistrer l'appel"}
            </button>
          )}
          {saved && <span style={{ marginLeft: 12, fontSize: '12.5px', color: 'var(--success)', fontWeight: 600 }}>Appel enregistré.</span>}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const selectStyle = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--paper)' };
