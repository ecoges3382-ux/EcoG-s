import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';

export default function Grades() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draftMoyenne, setDraftMoyenne] = useState('');
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('students')
      .select('id, full_name, niveau, moyenne, bulletin_pret')
      .order('full_name');
    if (fetchError) setError(fetchError.message);
    else setStudents(data);
  }

  useEffect(() => { reload(); }, []);

  function startEdit(s) {
    setEditingId(s.id);
    setDraftMoyenne(s.moyenne ?? '');
  }

  async function saveMoyenne(id) {
    setSaving(true);
    const value = draftMoyenne === '' ? null : Number(draftMoyenne);
    const { error: updateError } = await supabase.from('students').update({ moyenne: value }).eq('id', id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    reload();
  }

  async function toggleReady(s) {
    const { error: updateError } = await supabase.from('students').update({ bulletin_pret: !s.bulletin_pret }).eq('id', s.id);
    if (updateError) setError(updateError.message);
    else reload();
  }

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Notes et bulletins</p>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && !students && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {students && (
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {students.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>{s.full_name}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{s.niveau}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {editingId === s.id ? (
                  <>
                    <input
                      type="number" min="0" max="20" step="0.1"
                      value={draftMoyenne}
                      onChange={(e) => setDraftMoyenne(e.target.value)}
                      style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }}
                    />
                    <button onClick={() => saveMoyenne(s.id)} disabled={saving} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>OK</button>
                  </>
                ) : (
                  <button onClick={() => startEdit(s)} style={{ fontSize: 13, fontWeight: 600, background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
                    Moyenne : {s.moyenne != null ? `${s.moyenne}/20` : '—'}
                  </button>
                )}

                <button
                  onClick={() => toggleReady(s)}
                  style={{
                    fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: s.bulletin_pret ? 'var(--success-light)' : '#F0EDE5',
                    color: s.bulletin_pret ? 'var(--success)' : 'var(--muted)',
                  }}
                >
                  {s.bulletin_pret ? 'Bulletin prêt' : 'En cours'}
                </button>
              </div>
            </div>
          ))}
          {students.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève.</p>}
        </div>
      )}
    </div>
  );
}
