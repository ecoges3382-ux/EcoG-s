import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_SEND_WHATSAPP_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function ParentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [access, setAccess] = useState(null);
  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité.
  const [niveauById, setNiveauById] = useState({});
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('parent_access')
      .select('*, parent_access_students ( students ( id, full_name ) )')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setAccess(data);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!access || !schoolYear) return;
    const ids = (access.parent_access_students || []).map((row) => row.students?.id).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    supabase
      .from('enrollments')
      .select('student_id, classes ( nom )')
      .eq('school_year_id', schoolYear.id)
      .in('student_id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach((e) => { map[e.student_id] = e.classes?.nom || '—'; });
        setNiveauById(map);
      });
    return () => { cancelled = true; };
  }, [access, schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!access) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const children = (access.parent_access_students || []).map((row) => row.students).filter(Boolean);

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${access.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement l'accès de ${access.full_name} ? Le lien qu'il a reçu cessera de fonctionner. Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('parent_access').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    navigate('/parents');
  }

  return (
    <div>
      <Link to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux parents
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--clay-dark)' }}>
          {initials(access.full_name)}
        </div>
        <div>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{access.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{access.phone || 'Pas de numéro enregistré'}</p>
        </div>
      </div>

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640, marginBottom: 20 }}>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Enfants dans l'école</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700 }}>{children.length}</p>
        </div>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Code d'accès</p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.06em' }}>{access.code}</p>
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Enfants</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640, marginBottom: 20 }}>
        {children.map((c, i) => (
          <Link
            key={c.id}
            to={`/eleves/${c.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < children.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11.5, fontWeight: 600, color: 'var(--forest)', flexShrink: 0 }}>
                {initials(c.full_name)}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.full_name}</p>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>{niveauById[c.id] || '—'}</span>
          </Link>
        ))}
        {children.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun enfant rattaché.</p>}
      </div>

      {CAN_SEND_WHATSAPP_ROLES.includes(profile.role) && access.phone && (
        <IndividualMessage parentAccessId={access.id} />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={copyLink}
          style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
        >
          {copied ? 'Lien copié !' : 'Copier le lien à envoyer'}
        </button>
        {CAN_DELETE_ROLES.includes(profile.role) && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? 'Suppression…' : "Supprimer l'accès"}
          </button>
        )}
      </div>
    </div>
  );
}

// Envoi ponctuel, hors relance/annonce — passe par le même canal serveur
// (whatsapp-send) que tout le reste : le frontend n'appelle jamais l'API
// WhatsApp lui-même. Nécessite qu'un template "message individuel" (avec un
// seul paramètre libre) soit configuré côté Paramètres → WhatsApp ; sinon
// le serveur refuse l'envoi avec une erreur claire, jamais silencieusement.
function IndividualMessage({ parentAccessId }) {
  const [contenu, setContenu] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSend() {
    if (!contenu.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const data = await sendWhatsAppMessage({ type: 'message_individuel', parent_access_id: parentAccessId, contenu: contenu.trim() });
      const ok = data.results?.[0]?.statut === 'envoye';
      setResult({ ok, text: ok ? 'Message envoyé.' : (data.results?.[0]?.erreur || "Échec de l'envoi.") });
      if (ok) setContenu('');
    } catch (err) {
      setResult({ ok: false, text: err.message });
    }
    setSending(false);
  }

  return (
    <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
      <p style={{ margin: '0 0 8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
        Message WhatsApp individuel
      </p>
      <textarea
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        placeholder="ex. Merci de passer au secrétariat cette semaine…"
        rows={3}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 10, resize: 'vertical' }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !contenu.trim()}
        style={{ fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#25D366', color: '#fff', opacity: (sending || !contenu.trim()) ? 0.7 : 1, cursor: (sending || !contenu.trim()) ? 'default' : 'pointer' }}
      >
        <i className="ti ti-brand-whatsapp" style={{ fontSize: 15, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
        {sending ? 'Envoi…' : 'Envoyer'}
      </button>
      {result && <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: result.ok ? 'var(--success)' : 'var(--danger)' }}>{result.text}</p>}
    </div>
  );
}
