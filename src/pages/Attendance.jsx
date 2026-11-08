import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, todayIso, startOfWeekIso, endOfWeekIso, startOfMonthIso, endOfMonthIso } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { useToast } from '../components/Toast.jsx';
import Dropdown from '../components/Dropdown.jsx';
import DatePicker from '../components/DatePicker.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonRow } from '../components/Skeleton.jsx';
import StudentLink from '../components/StudentLink.jsx'; // 👈 NOUVEL IMPORT

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
  const [offline, setOffline] = useState(false);
  const [niveau, setNiveau] = useState('');
  const [date, setDate] = useState(todayIso());
  const [statuts, setStatuts] = useState({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('appel');

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `attendance_students_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('enrollments')
          .select('classes ( nom ), students ( id, full_name, photo_url )')
          .eq('school_year_id', schoolYear.id);
        if (fetchError) return { error: fetchError };
        return {
          data: (data || [])
            .map((e) => ({ id: e.students.id, full_name: e.students.full_name, photo_url: e.students.photo_url, niveau: e.classes?.nom || '—' }))
            .sort((a, b) => a.full_name.localeCompare(b.full_name)),
        };
      },
      setData: (st) => { 
        setStudents(st); 
        if (st.length > 0) setNiveau(st[0].niveau); 
      },
      setOffline,
      onError: (err) => setError(err.message),
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  const niveaux = useMemo(() => [...new Set((students || []).map((s) => s.niveau))].sort(), [students]);
  const studentsInNiveau = (students || []).filter((s) => s.niveau === niveau);

  useEffect(() => {
    if (!schoolYear || !niveau || studentsInNiveau.length === 0) { setStatuts({}); return; }
    setLoadingRecords(true);
    setSaved(false);
    const ids = studentsInNiveau.map((s) => s.id);
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
  if (!students) return <div className="card-bold" style={{ padding: 20 }}><SkeletonRow count={6} /></div>;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}
      
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

      {niveaux.length === 0 && (
        <div className="card-bold" style={{ padding: 20 }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Aucun élève inscrit pour l'instant. Inscris des élèves dans la page "Élèves" pour pouvoir faire l'appel.</p>
        </div>
      )}

      {niveaux.length > 0 && tab === 'appel' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <Dropdown value={niveau} onChange={setNiveau} options={niveaux} style={selectStyle} wrapperStyle={{ width: 'auto', minWidth: 140 }} />
            <DatePicker value={date} onChange={setDate} style={{ ...selectStyle, width: 'auto' }} />
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

          <div className="card-bold" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)', marginBottom: 18, opacity: loadingRecords ? 0.6 : 1 }}>
            {studentsInNiveau.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < studentsInNiveau.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                    {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                  </div>
                  {/* 🚀 NOM CLIQUABLE */}
                  <StudentLink studentId={s.id} name={s.full_name} style={{ fontSize: '13.5px', fontWeight: 600 }} />
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
  return <div>Statistiques en construction</div>;
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
