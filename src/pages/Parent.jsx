import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fmt, initials } from '../lib/utils.js';

export default function Parent() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
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

  const s = students.find((x) => x.id === selectedId);
  const reste = s ? Number(s.montant_du) - Number(s.montant_paye) : 0;
  const resteFrais = s ? Number(s.frais_connexe_du) - Number(s.frais_connexe_paye) : 0;

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Vue parent</p>
      <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--muted)' }}>
        Aperçu de ce qu'un parent verrait pour l'élève choisi ci-dessous. Il n'existe pas encore de vrai
        compte parent séparé — c'est un aperçu réservé au personnel de l'école pour l'instant.
      </p>

      <div className="desktop-split" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="card-bold" style={{ padding: 16 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Élèves</p>
          {students.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 10, cursor: 'pointer', marginBottom: 6, background: c.id === selectedId ? 'var(--forest-light)' : 'transparent' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: c.id === selectedId ? 'var(--forest)' : 'var(--clay-light)', color: c.id === selectedId ? '#fff' : 'var(--clay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                {initials(c.full_name)}
              </div>
              <div><p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>{c.full_name}</p><p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{c.niveau}</p></div>
            </div>
          ))}
          {students.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Aucun élève.</p>}
        </div>

        {s && (
          <div>
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
        )}
      </div>
    </div>
  );
}
