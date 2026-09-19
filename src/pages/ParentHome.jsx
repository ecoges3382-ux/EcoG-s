import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fmt, initials } from '../lib/utils.js';

export default function ParentHome() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    // La RLS ("students: select (parent)") ne renvoie déjà que les enfants
    // liés à ce compte — pas besoin de filtrer côté client.
    supabase
      .from('students')
      .select('*')
      .order('full_name')
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else {
          setStudents(data);
          if (data?.length) setSelectedId(data[0].id);
        }
      });
  }, []);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  if (students.length === 0) {
    return (
      <div className="card-bold" style={{ padding: '20px 22px', maxWidth: 480 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
          Aucun élève n'est encore rattaché à ce compte. Contactez le secrétariat de l'école.
        </p>
      </div>
    );
  }

  const s = students.find((x) => x.id === selectedId) || students[0];
  const reste = Number(s.montant_du) - Number(s.montant_paye);
  const resteFrais = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 22px', fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
        Bonjour.
      </p>

      {students.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {students.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, border: `1px solid ${c.id === selectedId ? 'var(--forest)' : 'var(--line-strong)'}`, background: c.id === selectedId ? 'var(--forest)' : 'var(--paper)', color: c.id === selectedId ? '#fff' : 'var(--ink)' }}
            >
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ width: 50, height: 50, borderRadius: 12, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
          {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>{s.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{s.niveau}</p>
        </div>
      </div>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Reste à payer</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(reste)} F</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Frais connexes restants</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700, color: resteFrais > 0 ? 'var(--amber)' : 'var(--success)' }}>{fmt(resteFrais)} F</p>
        </div>
        <div className="card-bold" style={{ padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Classe</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700 }}>{s.niveau}</p>
        </div>
      </div>

      <div className="card-bold" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Bulletin</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              {s.moyenne != null ? `Moyenne : ${s.moyenne}/20` : 'Moyenne non encore renseignée'}
            </p>
          </div>
          <span style={{ background: s.bulletin_pret ? 'var(--success-light)' : '#F0EDE5', color: s.bulletin_pret ? 'var(--success)' : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20 }}>
            {s.bulletin_pret ? 'Prêt' : 'En cours'}
          </span>
        </div>
      </div>
    </div>
  );
}
