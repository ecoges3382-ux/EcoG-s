import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import NewScheduleEntryModal from '../components/NewScheduleEntryModal.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const CRENEAUX = ['8h-9h', '9h-10h', '10h-11h', '11h-12h', '15h-16h'];

export default function Schedule() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState(null);
  const [enseignants, setEnseignants] = useState([]);
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('classe');
  const [filter, setFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    const [{ data: sched, error: schedError }, { data: staff }] = await Promise.all([
      supabase.from('schedule_entries').select('*'),
      supabase.from('staff').select('full_name').eq('role', 'Enseignant'),
    ]);
    if (schedError) { setError(schedError.message); return; }
    setEntries(sched);
    setEnseignants((staff || []).map((s) => s.full_name));
  }

  useEffect(() => {
    reload();
    // Les classes proposées pour un créneau sont celles réellement créées
    // par l'école (page Classes) — pas une liste générique de niveaux.
    supabase.from('classes').select('nom').order('nom').then(({ data }) => {
      setClasses((data || []).map((c) => c.nom));
    });
  }, []);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!entries) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const options = view === 'classe'
    ? [...new Set(entries.map((e) => e.classe))].sort()
    : [...new Set(entries.map((e) => e.enseignant).filter(Boolean))].sort();
  const activeFilter = filter ?? options[0] ?? null;
  const filtered = activeFilter ? entries.filter((e) => (view === 'classe' ? e.classe : e.enseignant) === activeFilter) : [];

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Emploi du temps</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setView('classe'); setFilter(null); }} style={toggleStyle(view === 'classe')}>Par classe</button>
        <button onClick={() => { setView('enseignant'); setFilter(null); }} style={toggleStyle(view === 'enseignant')}>Par enseignant</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {options.map((o) => (
          <button key={o} onClick={() => setFilter(o)} style={toggleStyle(o === activeFilter)}>{o}</button>
        ))}
        {options.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {view === 'classe' ? "Aucun créneau pour l'instant." : "Aucun enseignant dans l'emploi du temps pour l'instant."}
          </p>
        )}
      </div>

      <div className="schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {JOURS.map((j) => {
          const coursJour = filtered.filter((e) => e.jour === j).sort((a, b) => CRENEAUX.indexOf(a.creneau) - CRENEAUX.indexOf(b.creneau));
          return (
            <div key={j}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{j}</p>
              {coursJour.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun cours</p>}
              {coursJour.map((c) => (
                <div key={c.id} className="card-bold" style={{ padding: '10px 12px', marginBottom: 8 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '12.5px', fontWeight: 600 }}>{c.matiere}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--muted)' }}>{view === 'classe' ? c.enseignant : c.classe}</p>
                  <span style={{ fontSize: 11, color: 'var(--forest)', fontWeight: 600 }}>{c.creneau}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setModalOpen(true)}
        disabled={classes === null}
        style={{ marginTop: 24, background: 'var(--clay)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: '13px 22px', borderRadius: 'var(--radius)', opacity: classes === null ? 0.7 : 1 }}
      >
        <i className="ti ti-plus" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>Ajouter un créneau
      </button>

      {modalOpen && (
        <NewScheduleEntryModal
          schoolId={profile.school_id}
          niveaux={classes || []}
          enseignants={enseignants}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function toggleStyle(active) {
  return {
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
    background: active ? 'var(--forest)' : 'var(--paper)', color: active ? '#fff' : 'var(--ink)',
  };
}
