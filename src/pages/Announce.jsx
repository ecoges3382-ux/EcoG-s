import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

export default function Announce() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [items, setItems] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [error, setError] = useState('');
  const [portee, setPortee] = useState('École entière');
  const [classeCible, setClasseCible] = useState('');
  const [titre, setTitre] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Les classes proposées comme cible sont celles qui ont des élèves
  // inscrits cette année (enrollments) — students ne garde que son
  // identité, plus de niveau directement dessus.
  async function reload() {
    if (!schoolYear) return;
    const [{ data, error: fetchError }, { data: enr }] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('enrollments').select('classes ( nom )').eq('school_year_id', schoolYear.id),
    ]);
    if (fetchError) setError(fetchError.message);
    else setItems(data);
    const distinctNiveaux = [...new Set((enr || []).map((e) => e.classes?.nom).filter(Boolean))].sort();
    setNiveaux(distinctNiveaux);
    if (!classeCible && distinctNiveaux.length) setClasseCible(distinctNiveaux[0]);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!titre.trim()) return;
    if (portee === 'Une classe' && !classeCible) {
      setError('Choisis une classe.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supabase.from('announcements').insert({
      school_id: profile.school_id,
      auteur: profile.full_name,
      role: ROLES[profile.role]?.label || profile.role,
      portee,
      classe_cible: portee === 'Une classe' ? classeCible : null,
      titre: titre.trim(),
    });
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setTitre('');
    reload();
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    return `Il y a ${days} jours`;
  }

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Annonces</p>

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '20px 22px', marginBottom: 20, maxWidth: 640 }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Nouvelle annonce — en tant que {ROLES[profile.role]?.label || profile.role}</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {['École entière', 'Une classe'].map((p) => (
            <button
              type="button" key={p} onClick={() => setPortee(p)}
              style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: portee === p ? 'none' : '1px solid var(--line-strong)', background: portee === p ? 'var(--forest)' : 'var(--paper)', color: portee === p ? '#fff' : 'var(--ink)' }}
            >
              {p}
            </button>
          ))}
          {portee === 'Une classe' && (
            <select value={classeCible} onChange={(e) => setClasseCible(e.target.value)} style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
              {niveaux.length === 0 && <option value="">Aucune classe</option>}
              {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Écrire une annonce…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 }}
        />
        <button type="submit" disabled={submitting} style={{ background: 'var(--clay)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: '12px 22px', borderRadius: 'var(--radius)', opacity: submitting ? 0.7 : 1 }}>
          <i className="ti ti-speakerphone" style={{ fontSize: 15, verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true"></i>
          {submitting ? 'Publication…' : 'Publier'}
        </button>
      </form>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && !items && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {items && (
        <>
          <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Annonces récentes</p>
          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
            {items.map((a, i) => (
              <div key={a.id} style={{ padding: '14px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: a.portee === 'École entière' ? 'var(--forest-light)' : 'var(--gold-light)', color: a.portee === 'École entière' ? 'var(--forest-dark)' : 'var(--clay-dark)' }}>
                    {a.portee === 'Une classe' && a.classe_cible ? `${a.classe_cible}` : a.portee}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{timeAgo(a.created_at)}</span>
                </div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>{a.titre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{a.auteur} · {a.role}</p>
              </div>
            ))}
            {items.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune annonce pour l'instant.</p>}
          </div>
        </>
      )}
    </div>
  );
}
