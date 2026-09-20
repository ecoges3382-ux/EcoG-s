import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmt, initials } from '../lib/utils.js';

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setStudent(data);
      });
    // Séparé de la fiche élève : un enseignant (RLS bloque parent_access
    // pour ce rôle) verra simplement une liste vide plutôt qu'une erreur.
    supabase
      .from('parent_access_students')
      .select('parent_access ( id, full_name, phone )')
      .eq('student_id', id)
      .then(({ data }) => {
        if (!cancelled) setParents((data || []).map((row) => row.parent_access).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!student) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const reste = Number(student.montant_du) - Number(student.montant_paye);
  const resteFrais = Number(student.frais_connexe_du) - Number(student.frais_connexe_paye);

  return (
    <div>
      <Link to="/eleves" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux élèves
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden' }}>
          {student.photo_url ? <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(student.full_name)}
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600 }}>{student.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{student.niveau} · Parent : {student.parent_phone || '—'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640 }}>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Droit d'écolage</p>
          <Row label="Dû" value={`${fmt(student.montant_du)} F`} />
          <Row label="Payé" value={`${fmt(student.montant_paye)} F`} color="var(--success)" />
          <Row label="Reste" value={`${fmt(reste)} F`} bold color="var(--danger)" topBorder />
        </div>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais connexes</p>
          <Row label="Dû" value={`${fmt(student.frais_connexe_du)} F`} />
          <Row label="Payé" value={`${fmt(student.frais_connexe_paye)} F`} color="var(--success)" />
          <Row label="Reste" value={`${fmt(resteFrais)} F`} bold color={resteFrais > 0 ? 'var(--danger)' : 'var(--success)'} topBorder />
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Parent{parents?.length > 1 ? 's' : ''}</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
        {parents === null && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>}
        {parents?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun parent relié pour l'instant.</p>}
        {parents?.map((p, i) => (
          <Link
            key={p.id}
            to={`/parents/${p.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{p.phone || 'Pas de numéro'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, color, bold, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : '13.5px', marginBottom: bold ? 0 : 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: bold ? undefined : 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color }}>{value}</span>
    </div>
  );
}
