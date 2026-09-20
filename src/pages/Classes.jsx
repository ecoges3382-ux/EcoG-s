import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { NIVEAUX } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';

export default function Classes() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function reload() {
    const [{ data: cl, error: clError }, { data: st }, { data: te }] = await Promise.all([
      supabase.from('classes').select('*, staff ( full_name )').order('nom'),
      supabase.from('students').select('niveau'),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
    ]);
    if (clError) setError(clError.message);
    else setClasses(cl);
    setStudents(st || []);
    setTeachers(te || []);
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(c) {
    if (!window.confirm(`Supprimer la classe ${c.nom} ?`)) return;
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', c.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Classes</p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Nouvelle classe
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!classes && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {classes && (
        <div className="card-bold" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr 0.8fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
              <span>Classe</span><span>Niveau</span><span>Salle</span><span>Effectif</span><span>Prof. principal</span><span></span>
            </div>
            {classes.map((c, i) => {
              const effectif = students.filter((s) => s.niveau === c.niveau).length;
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr 0.8fr', padding: '13px 20px', alignItems: 'center', borderBottom: i < classes.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{c.nom}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.niveau}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.salle || '—'}</span>
                  <span style={{ fontSize: 13 }}>{effectif}{c.capacite ? ` / ${c.capacite}` : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.staff?.full_name || '—'}</span>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditing(c); setModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }} title="Modifier">
                      <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    </button>
                    <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Supprimer">
                      <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              );
            })}
            {classes.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune classe pour l'instant.</p>}
          </div>
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
        L'effectif est compté à partir du niveau renseigné sur chaque fiche élève.
      </p>

      {modalOpen && (
        <ClassModal
          schoolId={profile.school_id}
          teachers={teachers}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function ClassModal({ schoolId, teachers, editing, onClose, onSaved }) {
  const [niveau, setNiveau] = useState(editing?.niveau || NIVEAUX[0]);
  const [section, setSection] = useState(editing?.section || '');
  const [salle, setSalle] = useState(editing?.salle || '');
  const [capacite, setCapacite] = useState(editing?.capacite ?? '');
  const [profPrincipalId, setProfPrincipalId] = useState(editing?.prof_principal_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      nom: section.trim() ? `${niveau} ${section.trim()}` : niveau,
      niveau,
      section: section.trim() || null,
      salle: salle.trim() || null,
      capacite: capacite === '' ? null : Number(capacite),
      prof_principal_id: profPrincipalId || null,
    };
    const { error: saveError } = editing
      ? await supabase.from('classes').update(payload).eq('id', editing.id)
      : await supabase.from('classes').insert({ school_id: schoolId, ...payload });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier la classe' : 'Nouvelle classe'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inputStyle}>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Section (optionnel)</label>
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="A" style={inputStyle} />
          </div>
        </div>
        <p style={{ margin: '-6px 0 12px', fontSize: '11.5px', color: 'var(--muted)' }}>
          Nom de la classe : <strong>{section.trim() ? `${niveau} ${section.trim()}` : niveau}</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Salle</label>
            <input value={salle} onChange={(e) => setSalle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Capacité</label>
            <input type="number" min="0" value={capacite} onChange={(e) => setCapacite(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Professeur principal</label>
        <select value={profPrincipalId} onChange={(e) => setProfPrincipalId(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}>
          <option value="">—</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
