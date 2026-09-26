import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, todayIso, startOfWeekIso, endOfWeekIso, startOfMonthIso, endOfMonthIso } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { useToast } from '../components/Toast.jsx';
import Dropdown from '../components/Dropdown.jsx';

const STATUTS = [
  { id: 'present', label: 'Présent', bg: 'var(--success-light)', fg: 'var(--success)' },
  { id: 'absent', label: 'Absent', bg: 'var(--danger-light)', fg: 'var(--danger)' },
  { id: 'retard', label: 'Retard', bg: 'var(--amber-light)', fg: 'var(--amber)' },
];

export default function Attendance() {
  const showToast = useToast();
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
  const [tab, setTab] = useState('appel');

  // La classe d'un élève est propre à l'année scolaire sélectionnée
  // (enrollments) — students ne garde que son identité. Un ancien élève
  // qui n'est plus inscrit cette année n'apparaît jamais ici, même s'il
  // existe encore dans la table students.
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
    // upsert sur (student_id, school_year_id, date) : une nouvelle saisie
    // pour une date déjà enregistrée corrige la ligne existante, ne crée
    // jamais de doublon — sûr même en cas de double clic ou de nouvel
    // enregistrement après rafraîchissement.
    const { error: upsertError } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'student_id,school_year_id,date' });
    setSaving(false);
    if (upsertError) setError(upsertError.message);
    else { setSaved(true); showToast('Enregistré'); }
  }

  function markAllPresent() {
    const map = {};
    studentsInNiveau.forEach((s) => { map[s.id] = 'present'; });
    setStatuts(map);
    setSaved(false);
  }

  const counts = { present: 0, absent: 0, retard: 0 };
  studentsInNiveau.forEach((s) => { counts[statuts[s.id] || 'present'] += 1; });

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Présences</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'appel', label: "Faire l'appel" }, { id: 'stats', label: 'Statistiques' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: '8px 15px', borderRadius: 10, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {niveaux.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun élève inscrit pour l'instant.</p>}

      {niveaux.length > 0 && tab === 'appel' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <Dropdown value={niveau} onChange={setNiveau} options={niveaux} style={selectStyle} wrapperStyle={{ width: 'auto', minWidth: 140 }} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={selectStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }} className="desktop-grid-3">
            <Stat label="Présents" value={counts.present} color="var(--success)" />
            <Stat label="Absents" value={counts.absent} color="var(--danger)" />
            <Stat label="Retards" value={counts.retard} color="var(--amber)" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              onClick={markAllPresent}
              disabled={studentsInNiveau.length === 0}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
            >
              <i className="ti ti-check" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Marquer tous présents
            </button>
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

      {niveaux.length > 0 && tab === 'stats' && (
        <AttendanceStats schoolYear={schoolYear} niveaux={niveaux} students={students} />
      )}
    </div>
  );
}

function AttendanceStats({ schoolYear, niveaux, students }) {
  const [niveau, setNiveau] = useState(niveaux[0]);
  const [periode, setPeriode] = useState('jour');
  const [dateRef, setDateRef] = useState(todayIso());
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [records, setRecords] = useState(null);

  useEffect(() => {
    if (!niveaux.includes(niveau)) setNiveau(niveaux[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveaux]);

  const studentsInNiveau = students.filter((s) => s.niveau === niveau);

  const { start, end } = useMemo(() => {
    if (periode === 'jour') return { start: dateRef, end: dateRef };
    if (periode === 'semaine') return { start: startOfWeekIso(dateRef), end: endOfWeekIso(dateRef) };
    if (periode === 'mois') return { start: startOfMonthIso(dateRef), end: endOfMonthIso(dateRef) };
    return { start: customStart, end: customEnd };
  }, [periode, dateRef, customStart, customEnd]);

  useEffect(() => {
    if (!schoolYear || studentsInNiveau.length === 0) { setRecords([]); return; }
    const ids = studentsInNiveau.map((s) => s.id);
    setRecords(null);
    supabase
      .from('attendance_records')
      .select('student_id, date, statut')
      .eq('school_year_id', schoolYear.id)
      .gte('date', start)
      .lte('date', end)
      .in('student_id', ids)
      .then(({ data }) => setRecords(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id, niveau, start, end]);

  const counts = { present: 0, absent: 0, retard: 0 };
  (records || []).forEach((r) => { counts[r.statut] = (counts[r.statut] || 0) + 1; });
  const total = (records || []).length;
  // "Retard" reste une présence physique — le taux de présence compte
  // présent + retard, distinct du taux de ponctualité.
  const tauxPresence = total > 0 ? Math.round(((counts.present + counts.retard) / total) * 100) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <Dropdown value={niveau} onChange={setNiveau} options={niveaux} style={selectStyle} wrapperStyle={{ width: 'auto', minWidth: 140 }} />
        <Dropdown
          value={periode}
          onChange={setPeriode}
          options={[
            { value: 'jour', label: 'Un jour' },
            { value: 'semaine', label: 'Cette semaine' },
            { value: 'mois', label: 'Ce mois' },
            { value: 'personnalise', label: 'Période personnalisée' },
          ]}
          style={selectStyle}
          wrapperStyle={{ width: 'auto', minWidth: 170 }}
        />
        {periode === 'jour' && <input type="date" value={dateRef} onChange={(e) => setDateRef(e.target.value)} style={selectStyle} />}
        {(periode === 'semaine' || periode === 'mois') && (
          <input type="date" value={dateRef} onChange={(e) => setDateRef(e.target.value)} style={selectStyle} title="Une date dans la période souhaitée" />
        )}
        {periode === 'personnalise' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={selectStyle} />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={selectStyle} />
          </>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
        {studentsInNiveau.length} élève{studentsInNiveau.length > 1 ? 's' : ''} inscrit{studentsInNiveau.length > 1 ? 's' : ''} · du {new Date(start).toLocaleDateString('fr-FR')} au {new Date(end).toLocaleDateString('fr-FR')}
      </p>

      {records === null ? (
        <p style={{ color: 'var(--muted)' }}>Chargement…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }} className="desktop-grid-4">
          <Stat label="Élèves inscrits" value={studentsInNiveau.length} />
          <Stat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
          <Stat label="Absences" value={counts.absent} color="var(--danger)" />
          <Stat label="Retards" value={counts.retard} color="var(--amber)" />
        </div>
      )}
      {records !== null && total === 0 && (
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>Aucun appel enregistré sur cette période pour cette classe.</p>
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
