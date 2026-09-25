import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import NewScheduleEntryModal from '../components/NewScheduleEntryModal.jsx';
import ScheduleSlotsModal from '../components/ScheduleSlotsModal.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// Scopé à l'année scolaire en cours (school_year_id) — jusqu'ici le seul
// module sans "contexte annuel" : les créneaux d'une année se mélangeaient
// avec ceux de l'année suivante. Les créneaux horaires (colonnes de la
// grille) viennent maintenant de schedule_slots, configurables par l'école
// (bouton "Gérer les créneaux") plutôt que 5 créneaux fixes codés en dur.
// classe/enseignant sont de vraies références (classe_id/enseignant_id) —
// la détection de conflit (voir NewScheduleEntryModal) en dépend, une
// comparaison sur du texte libre n'aurait jamais été fiable.
export default function Schedule() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [entries, setEntries] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState(null);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState('classe');
  const [filter, setFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [slotsModalOpen, setSlotsModalOpen] = useState(false);

  async function reload() {
    if (!schoolYear) return;
    const [{ data: sched, error: schedError }, { data: staff }, { data: cl }, { data: sl }] = await Promise.all([
      supabase.from('schedule_entries')
        .select('*, classes ( nom ), staff ( full_name )')
        .eq('school_year_id', schoolYear.id),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
      supabase.from('classes').select('id, nom, niveau, section'),
      supabase.from('schedule_slots').select('*').eq('school_id', profile.school_id).order('ordre'),
    ]);
    if (schedError) { setError(schedError.message); return; }
    setEntries(sched);
    setTeachers(staff || []);
    setClasses(sortClasses(cl || []));
    setSlots(sl || []);
  }

  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleDelete(entry) {
    if (!window.confirm(`Supprimer ce créneau (${entry.matiere}) ?`)) return;
    const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entry.id);
    if (deleteError) { setError(deleteError.message); return; }
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!entries || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const options = view === 'classe'
    ? [...new Set(entries.map((e) => e.classes?.nom).filter(Boolean))].sort()
    : [...new Set(entries.map((e) => e.staff?.full_name).filter(Boolean))].sort();
  const activeFilter = filter ?? options[0] ?? null;
  const filtered = activeFilter
    ? entries.filter((e) => (view === 'classe' ? e.classes?.nom : e.staff?.full_name) === activeFilter)
    : [];
  const slotOrdre = Object.fromEntries(slots.map((s) => [s.id, s.ordre]));
  const slotLabel = Object.fromEntries(slots.map((s) => [s.id, s.label]));

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Emploi du temps</p>
        <span style={{ fontSize: '12.5px', fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>
          Année scolaire {schoolYear.label}
        </span>
      </div>

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

      <div className="schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14 }}>
        {JOURS.map((j) => {
          const coursJour = filtered.filter((e) => e.jour === j).sort((a, b) => (slotOrdre[a.slot_id] ?? 0) - (slotOrdre[b.slot_id] ?? 0));
          return (
            <div key={j}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{j}</p>
              {coursJour.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun cours</p>}
              {coursJour.map((c) => (
                <div key={c.id} className="card-bold" style={{ padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '12.5px', fontWeight: 600 }}>{c.matiere}</p>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditing(c); setModalOpen(true); }} style={iconBtnStyle('var(--ink)')} title="Modifier">
                        <i className="ti ti-pencil" style={{ fontSize: 13 }} aria-hidden="true"></i>
                      </button>
                      <button onClick={() => handleDelete(c)} style={iconBtnStyle('var(--danger)')} title="Supprimer">
                        <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--muted)' }}>{view === 'classe' ? (c.staff?.full_name || '—') : c.classes?.nom}</p>
                  <span style={{ fontSize: 11, color: 'var(--forest)', fontWeight: 600 }}>{slotLabel[c.slot_id] || '—'}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          disabled={classes === null}
          style={{ background: 'var(--clay)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: '13px 22px', borderRadius: 'var(--radius)', opacity: classes === null ? 0.7 : 1 }}
        >
          <i className="ti ti-plus" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>Ajouter un créneau
        </button>
        <button
          onClick={() => setSlotsModalOpen(true)}
          style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line-strong)', fontWeight: 600, fontSize: 14, padding: '13px 22px', borderRadius: 'var(--radius)' }}
        >
          <i className="ti ti-clock" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>Gérer les créneaux
        </button>
      </div>

      {modalOpen && (
        <NewScheduleEntryModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          classes={classes || []}
          teachers={teachers}
          slots={slots}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reload(); }}
        />
      )}
      {slotsModalOpen && (
        <ScheduleSlotsModal
          schoolId={profile.school_id}
          slots={slots}
          onClose={() => setSlotsModalOpen(false)}
          onChanged={reload}
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

function iconBtnStyle(color) {
  return { background: 'none', border: 'none', cursor: 'pointer', color, padding: 0, lineHeight: 1 };
}
