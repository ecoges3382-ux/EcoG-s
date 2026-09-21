import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/utils.js';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function StaffDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setPerson(data);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!person) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement ${person.full_name} de l'équipe ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    navigate('/personnel');
  }

  return (
    <div>
      <Link to="/personnel" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour au personnel
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--forest)', overflow: 'hidden' }}>
          {person.photo_url ? <img src={person.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(person.full_name)}
        </div>
        <div>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{person.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{person.role}{person.matricule ? ` · ${person.matricule}` : ''}</p>
        </div>
      </div>

      <div className="card-bold" style={{ padding: '18px 20px', maxWidth: 640, marginBottom: 20 }}>
        <Row label="Niveau d'études" value={person.niveau_etudes || '—'} />
        <Row label="Classe(s)" value={(person.classes || []).length ? person.classes.join(', ') : '—'} />
        <Row label="Téléphone" value={person.phone || '—'} />
        <Row label="E-mail" value={person.email || '—'} topBorder />
      </div>

      {CAN_DELETE_ROLES.includes(profile.role) && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
        >
          {deleting ? 'Suppression…' : 'Supprimer du personnel'}
        </button>
      )}
    </div>
  );
}

function Row({ label, value, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
