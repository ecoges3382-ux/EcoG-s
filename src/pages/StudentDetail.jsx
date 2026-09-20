import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.js';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [student, setStudent] = useState(null);
  // undefined = pas encore chargé, null = chargé mais aucune inscription
  // cette année (élève sans classe pour l'année en cours).
  const [enrollment, setEnrollment] = useState(undefined);
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    supabase
      .from('enrollments')
      .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classes ( nom )')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setEnrollment(data || null); });
    return () => { cancelled = true; };
  }, [id, schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!student || enrollment === undefined) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const reste = Number(enrollment?.montant_du || 0) - Number(enrollment?.montant_paye || 0);
  const resteFrais = Number(enrollment?.frais_connexe_du || 0) - Number(enrollment?.frais_connexe_paye || 0);

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement ${student.full_name} ? Ses paiements, notes et présences seront aussi supprimés. Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    navigate('/eleves');
  }

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
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{student.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{enrollment?.classes?.nom || 'Aucune classe cette année'}</p>
        </div>
      </div>

      {enrollment ? (
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640 }}>
          <div className="card-bold" style={{ padding: '18px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Droit d'écolage</p>
            <Row label="Dû" value={fmtF(enrollment.montant_du)} />
            <Row label="Payé" value={fmtF(enrollment.montant_paye)} color="var(--success)" />
            <Row label="Reste" value={fmtF(reste)} bold color="var(--danger)" topBorder />
          </div>
          <div className="card-bold" style={{ padding: '18px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais connexes</p>
            <Row label="Dû" value={fmtF(enrollment.frais_connexe_du)} />
            <Row label="Payé" value={fmtF(enrollment.frais_connexe_paye)} color="var(--success)" />
            <Row label="Reste" value={fmtF(resteFrais)} bold color={resteFrais > 0 ? 'var(--danger)' : 'var(--success)'} topBorder />
          </div>
        </div>
      ) : (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Pas d'inscription pour l'année scolaire en cours{schoolYear ? ` (${schoolYear.label})` : ''}.
        </p>
      )}

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

      {CAN_DELETE_ROLES.includes(profile.role) && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{ marginTop: 24, padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
        >
          {deleting ? 'Suppression…' : "Supprimer l'élève"}
        </button>
      )}
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
