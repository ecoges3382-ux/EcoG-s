import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';

// Publication/modification/archivage réservés à fondateur/directeur/
// secrétaire — même périmètre que les autres actions administratives de
// l'appli (Comptes, Argent). Un enseignant peut lire les annonces mais
// n'en publie plus (imposé aussi côté RLS, pas seulement ici).
const CAN_MANAGE_ROLES = ['fondateur', 'directeur', 'secretaire'];

const STATUT_LABELS = {
  brouillon: { label: 'Brouillon', bg: '#F0EDE5', fg: 'var(--muted)' },
  publiee: { label: 'Publiée', bg: 'var(--success-light)', fg: 'var(--success)' },
  archivee: { label: 'Archivée', bg: '#F0EDE5', fg: 'var(--muted)' },
};

const FILTRES = [
  { id: 'actives', label: 'Actives' },
  { id: 'brouillon', label: 'Brouillons' },
  { id: 'archivee', label: 'Archivées' },
  { id: 'toutes', label: 'Toutes' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Announce() {
  const { profile } = useAuth();
  const { schoolYear, activeYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [items, setItems] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [filtre, setFiltre] = useState('actives');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // annonce en cours d'édition, ou null

  // Les classes proposées comme cible sont celles qui ont des élèves
  // inscrits dans l'année active (une annonce se crée toujours pour
  // l'année active, jamais pour une année consultée en historique) —
  // jamais une liste générique.
  async function reloadClasses() {
    if (!activeYear) return;
    const { data } = await supabase.from('enrollments').select('classes ( id, nom )').eq('school_year_id', activeYear.id);
    const map = new Map();
    (data || []).forEach((e) => { if (e.classes) map.set(e.classes.id, e.classes.nom); });
    setClasses([...map.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom)));
  }

  // Une annonce ciblée sur une classe de 2025-2026 ne doit jamais
  // apparaître comme concernant "la même classe" en 2026-2027 : on
  // n'affiche que les annonces de l'année consultée, plus celles qui sont
  // globales/permanentes (school_year_id nul), toujours visibles.
  async function reload() {
    if (!schoolYear) return;
    const { data, error: fetchError } = await supabase
      .from('announcements')
      .select('*, classes ( nom )')
      .or(`school_year_id.eq.${schoolYear.id},school_year_id.is.null`)
      .order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setItems(data);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  useEffect(() => {
    reloadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear?.id]);

  async function setStatut(item, statut) {
    const payload = { statut };
    if (statut === 'publiee' && !item.published_at) payload.published_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('announcements').update(payload).eq('id', item.id);
    if (updateError) { setError(updateError.message); return; }
    reload();
  }

  async function handleDelete(item) {
    if (!window.confirm('Supprimer définitivement ce brouillon ?')) return;
    const { error: deleteError } = await supabase.from('announcements').delete().eq('id', item.id);
    if (deleteError) { setError(deleteError.message); return; }
    reload();
  }

  const filtered = (items || []).filter((a) => {
    if (filtre === 'brouillon' && a.statut !== 'brouillon') return false;
    if (filtre === 'archivee' && a.statut !== 'archivee') return false;
    if (filtre === 'actives' && a.statut === 'archivee') return false;
    if (search.trim() && !`${a.titre} ${a.contenu}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Annonces</p>

      {canManage && !isHistorical && (
        <AnnounceForm
          key={editing?.id || 'new'}
          profile={profile}
          activeYear={activeYear}
          classes={classes}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          onError={setError}
        />
      )}
      {canManage && isHistorical && (
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
          Création désactivée en consultation d'un historique — reviens à l'année en cours pour publier une nouvelle annonce.
        </p>
      )}

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && !items && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {items && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FILTRES.map((f) => (
                <button
                  key={f.id} onClick={() => setFiltre(f.id)}
                  style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filtre === f.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: filtre === f.id ? 'var(--forest)' : 'var(--paper)', color: filtre === f.id ? '#fff' : 'var(--ink)' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 180, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
          </div>

          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 680 }}>
            {filtered.map((a, i) => (
              <AnnounceRow
                key={a.id}
                a={a}
                isLast={i === filtered.length - 1}
                canManage={canManage}
                onEdit={() => setEditing(a)}
                onSetStatut={(statut) => setStatut(a, statut)}
                onDelete={() => handleDelete(a)}
              />
            ))}
            {filtered.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune annonce ne correspond.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function AnnounceForm({ profile, activeYear, classes, editing, onCancelEdit, onSaved, onError }) {
  const [portee, setPortee] = useState(editing ? (editing.classe_cible_id ? 'Une classe' : 'École entière') : 'École entière');
  const [classeCibleId, setClasseCibleId] = useState(editing?.classe_cible_id || '');
  const [titre, setTitre] = useState(editing?.titre || '');
  const [contenu, setContenu] = useState(editing?.contenu || '');
  const [dateExpiration, setDateExpiration] = useState(editing?.date_expiration || '');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    if (portee === 'Une classe' && !classeCibleId && classes.length) setClasseCibleId(classes[0].id);
  }, [portee, classes, classeCibleId]);

  async function submit(statut) {
    if (!titre.trim()) { onError('Le titre est obligatoire.'); return; }
    if (portee === 'Une classe' && !classeCibleId) { onError('Choisis une classe.'); return; }
    setSubmitting(statut);
    onError('');
    const payload = {
      titre: titre.trim(),
      contenu: contenu.trim(),
      portee,
      classe_cible_id: portee === 'Une classe' ? classeCibleId : null,
      date_expiration: dateExpiration || null,
      statut,
      school_year_id: activeYear?.id || null,
    };
    if (statut === 'publiee' && !editing?.published_at) payload.published_at = new Date().toISOString();

    const { error } = editing
      ? await supabase.from('announcements').update(payload).eq('id', editing.id)
      : await supabase.from('announcements').insert({
          ...payload,
          school_id: profile.school_id,
          auteur: profile.full_name,
          role: ROLES[profile.role]?.label || profile.role,
        });
    setSubmitting('');
    if (error) { onError(error.message); return; }
    onSaved();
  }

  return (
    <div className="card-bold" style={{ padding: '20px 22px', marginBottom: 20, maxWidth: 640 }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        {editing ? 'Modifier l\'annonce' : 'Nouvelle annonce'} — en tant que {ROLES[profile.role]?.label || profile.role}
      </p>
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
          <select value={classeCibleId} onChange={(e) => setClasseCibleId(e.target.value)} style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            {classes.length === 0 && <option value="">Aucune classe</option>}
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        )}
      </div>
      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Titre de l'annonce…"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 10 }}
      />
      <textarea
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        placeholder="Détail de l'annonce (facultatif)…"
        rows={3}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 10, resize: 'vertical' }}
      />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Date d'expiration (facultatif)</label>
        <input
          type="date" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} min={todayIso()}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button" onClick={() => submit('publiee')} disabled={!!submitting}
          style={{ background: 'var(--clay)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13.5, padding: '11px 20px', borderRadius: 'var(--radius)', opacity: submitting ? 0.7 : 1 }}
        >
          <i className="ti ti-speakerphone" style={{ fontSize: 15, verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true"></i>
          {submitting === 'publiee' ? 'Publication…' : 'Publier'}
        </button>
        <button
          type="button" onClick={() => submit('brouillon')} disabled={!!submitting}
          style={{ background: 'var(--paper)', border: '1px solid var(--line-strong)', color: 'var(--ink)', fontWeight: 600, fontSize: 13.5, padding: '11px 20px', borderRadius: 'var(--radius)', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting === 'brouillon' ? 'Enregistrement…' : 'Enregistrer en brouillon'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, padding: '11px 8px', cursor: 'pointer' }}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

function AnnounceRow({ a, isLast, canManage, onEdit, onSetStatut, onDelete }) {
  const cibleLabel = a.portee === 'Une classe' ? (a.classes?.nom || a.classe_cible || 'Classe') : a.portee;
  const expiree = a.date_expiration && a.date_expiration < todayIso() && a.statut === 'publiee';
  const st = STATUT_LABELS[a.statut] || STATUT_LABELS.publiee;
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);

  async function diffuserWhatsApp() {
    if (!window.confirm(`Diffuser « ${a.titre} » par WhatsApp à ${cibleLabel === 'École entière' ? 'tous les parents' : `la classe « ${cibleLabel} »`} ?`)) return;
    setWaSending(true);
    setWaResult(null);
    try {
      const data = await sendWhatsAppMessage({ type: 'annonce', announcement_id: a.id });
      setWaResult({ ok: true, text: `Diffusée à ${data.envoyes}/${data.total} destinataire${data.total > 1 ? 's' : ''}${data.echecs ? ` (${data.echecs} échec${data.echecs > 1 ? 's' : ''})` : ''}${data.skipped_quota ? ` — ${data.skipped_quota} non envoyés (quota atteint)` : ''}.` });
    } catch (err) {
      setWaResult({ ok: false, text: err.message });
    }
    setWaSending(false);
  }

  return (
    <div style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: a.portee === 'École entière' ? 'var(--forest-light)' : 'var(--gold-light)', color: a.portee === 'École entière' ? 'var(--forest-dark)' : 'var(--clay-dark)' }}>
          {cibleLabel}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
        {expiree && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#F0EDE5', color: 'var(--muted)' }}>Expirée</span>}
        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
          {a.statut === 'brouillon' ? `Créée · ${timeAgo(a.created_at)}` : `Publiée · ${timeAgo(a.published_at || a.created_at)}`}
        </span>
      </div>
      <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>{a.titre}</p>
      {a.contenu && <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{a.contenu}</p>}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{a.auteur} · {a.role}</p>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {a.statut === 'brouillon' && (
            <>
              <button onClick={() => onSetStatut('publiee')} style={actionBtnStyle('var(--forest)', '#fff')}>Publier</button>
              <button onClick={onEdit} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Modifier</button>
              <button onClick={onDelete} style={actionBtnStyle('var(--paper)', 'var(--danger)', true)}>Supprimer</button>
            </>
          )}
          {a.statut === 'publiee' && (
            <>
              <button onClick={onEdit} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Modifier</button>
              <button onClick={() => onSetStatut('archivee')} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Archiver</button>
              <button onClick={diffuserWhatsApp} disabled={waSending} style={actionBtnStyle('#25D366', '#fff')}>
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
                {waSending ? 'Diffusion…' : 'Diffuser par WhatsApp'}
              </button>
            </>
          )}
          {a.statut === 'archivee' && (
            <button onClick={() => onSetStatut('publiee')} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Republier</button>
          )}
        </div>
      )}
      {waResult && (
        <p style={{ margin: '8px 0 0', fontSize: 11.5, fontWeight: 600, color: waResult.ok ? 'var(--success)' : 'var(--danger)' }}>{waResult.text}</p>
      )}
    </div>
  );
}

function actionBtnStyle(bg, color, bordered) {
  return { fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: bordered ? '1px solid var(--line-strong)' : 'none', background: bg, color, cursor: 'pointer' };
}
