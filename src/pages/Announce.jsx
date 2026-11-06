import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ROLES } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Dropdown from '../components/Dropdown.jsx';
import DatePicker from '../components/DatePicker.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { guardedFetch } from '../lib/offlineCache.js';

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
  const confirm = useConfirm();
  const { schoolYear, activeYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [items, setItems] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [filtre, setFiltre] = useState('actives');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function reloadClasses() {
    if (!activeYear) return;
    const { data } = await supabase.from('enrollments').select('classes ( id, nom )').eq('school_year_id', activeYear.id);
    const map = new Map();
    (data || []).forEach((e) => { if (e.classes) map.set(e.classes.id, e.classes.nom); });
    setClasses([...map.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom)));
  }

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `announcements_${schoolYear.id}`,
      hasData: items !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('announcements')
          .select('*, classes ( nom )')
          .or(`school_year_id.eq.${schoolYear.id},school_year_id.is.null`)
          .order('created_at', { ascending: false });
        return fetchError ? { error: fetchError } : { data };
      },
      setData: setItems,
      setOffline,
      onError: (err) => setError(err.message),
      onSuccess: () => setError(''),
    });
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
    const label = item.statut === 'brouillon' ? 'ce brouillon' : item.statut === 'archivee' ? 'cette annonce archivée' : 'cette annonce';
    if (!(await confirm(`Supprimer définitivement ${label} ? Cette action est irréversible.`, { confirmLabel: 'Supprimer' }))) return;
    setDeletingId(item.id);
    setError('');
    const { data: deleted, error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', item.id)
      .select('id');
    setDeletingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée. La policy RLS bloque probablement cette action.");
      return;
    }
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
      {offline && <OfflineBanner />}
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

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>Erreur : {error}</p>}
      {!error && !items && <div className="card-bold"><SkeletonRow count={3} avatar={false} /></div>}

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
                deleting={deletingId === a.id}
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
  const showToast = useToast();
  const [audience, setAudience] = useState(editing?.audience || 'parents');
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
    if (audience === 'parents' && portee === 'Une classe' && !classeCibleId) { onError('Choisis une classe.'); return; }
    
    setSubmitting(statut);
    onError('');
    const payload = {
      titre: titre.trim(),
      contenu: contenu.trim(),
      audience,
      portee: audience === 'personnel' ? 'École entière' : portee,
      classe_cible_id: (audience === 'parents' && portee === 'Une classe') ? classeCibleId : null,
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
    showToast('Enregistré');
    onSaved();
  }

  // Composant réutilisable pour les boutons de sélection
  const SelectBtn = ({ active, onClick, icon, label }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 10,
        fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
        border: `1px solid ${active ? 'var(--clay)' : 'var(--line-strong)'}`,
        background: active ? 'rgba(160, 71, 47, 0.08)' : 'var(--paper)',
        color: active ? 'var(--clay-dark)' : 'var(--muted)',
        cursor: 'pointer'
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
      {label}
    </button>
  );

  return (
    <div style={{ background: 'var(--paper)', borderRadius: 16, padding: '28px', marginBottom: 24, maxWidth: 720, boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--clay-dark)' }}>
          <i className="ti ti-speakerphone" style={{ fontSize: 20 }} aria-hidden="true"></i>
        </div>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            {editing ? "Modifier l'annonce" : 'Nouvelle annonce'}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Rédigée en tant que {ROLES[profile.role]?.label || profile.role}</p>
        </div>
      </div>
      
      {/* 1. Destinataires */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Destinataires</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SelectBtn active={audience === 'parents'} onClick={() => setAudience('parents')} icon="ti-users" label="Parents" />
          <SelectBtn active={audience === 'personnel'} onClick={() => setAudience('personnel')} icon="ti-briefcase" label="Enseignants / Équipe" />
          <SelectBtn active={audience === 'tous'} onClick={() => setAudience('tous')} icon="ti-users-group" label="Parents et Personnel" />
        </div>
      </div>

      {/* 2. Ciblage (Conditionnel) */}
      {audience === 'parents' && (
        <div style={{ marginBottom: 20, padding: '16px', background: 'var(--cream)', borderRadius: 12, border: '1px solid var(--line)' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ciblage</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <SelectBtn active={portee === 'École entière'} onClick={() => setPortee('École entière')} icon="ti-building-school" label="École entière" />
            <SelectBtn active={portee === 'Une classe'} onClick={() => setPortee('Une classe')} icon="ti-door" label="Une classe" />
            
            {portee === 'Une classe' && (
              <div style={{ marginLeft: 'auto' }}>
                <Dropdown
                  value={classeCibleId}
                  onChange={setClasseCibleId}
                  options={classes.length === 0 ? [{ value: '', label: 'Aucune classe' }] : classes.map((c) => ({ value: c.id, label: c.nom }))}
                  style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, background: 'var(--paper)', borderRadius: 8, border: '1px solid var(--line-strong)' }}
                  wrapperStyle={{ width: 'auto', minWidth: 200 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Contenu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Titre de l'annonce</label>
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex: Réunion de parents d'élèves"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', background: 'var(--paper)', outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--forest)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--line-strong)'}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Détail (facultatif)</label>
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Précisez l'heure, le lieu, l'ordre du jour…"
            rows={4}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', background: 'var(--paper)', resize: 'vertical', outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--forest)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--line-strong)'}
          />
        </div>

        <div style={{ width: 'fit-content' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date d'expiration (facultatif)</label>
          <DatePicker
            value={dateExpiration} onChange={setDateExpiration} min={todayIso()}
            style={{ width: 'auto', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)', background: 'var(--paper)' }}
          />
        </div>
      </div>

      {/* 4. Actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--line)' }}>
        <button
          type="button" onClick={() => submit('publiee')} disabled={!!submitting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--clay)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13.5, padding: '11px 22px', borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(160, 71, 47, 0.2)' }}
        >
          <i className="ti ti-send" style={{ fontSize: 16 }} aria-hidden="true"></i>
          {submitting === 'publiee' ? 'Publication…' : 'Publier l\'annonce'}
        </button>
        <button
          type="button" onClick={() => submit('brouillon')} disabled={!!submitting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--paper)', border: '1px solid var(--line-strong)', color: 'var(--ink)', fontWeight: 600, fontSize: 13.5, padding: '11px 22px', borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
        >
          <i className="ti ti-device-floppy" style={{ fontSize: 16 }} aria-hidden="true"></i>
          {submitting === 'brouillon' ? 'Enregistrement…' : 'Enregistrer en brouillon'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, padding: '11px 12px', cursor: 'pointer', marginLeft: 'auto' }}>
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

function AnnounceRow({ a, isLast, canManage, deleting, onEdit, onSetStatut, onDelete }) {
  const confirm = useConfirm();
  const cibleLabel = a.portee === 'Une classe' ? (a.classes?.nom || a.classe_cible || 'Classe') : a.portee;
  const audienceLabel = a.audience === 'tous' ? 'Parents & Personnel' : a.audience === 'personnel' ? 'Personnel' : 'Parents';
  const expiree = a.date_expiration && a.date_expiration < todayIso() && a.statut === 'publiee';
  const st = STATUT_LABELS[a.statut] || STATUT_LABELS.publiee;
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);

  async function diffuserWhatsApp() {
    if (!(await confirm(`Diffuser « ${a.titre} » par WhatsApp à ${audienceLabel} ?`, { confirmLabel: 'Diffuser', danger: false }))) return;
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
    <div style={{ padding: '16px 20px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'var(--gold-light)', color: 'var(--clay-dark)' }}>
          {audienceLabel}
        </span>
        {a.audience !== 'personnel' && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: a.portee === 'École entière' ? 'var(--forest-light)' : 'var(--gold-light)', color: a.portee === 'École entière' ? 'var(--forest-dark)' : 'var(--clay-dark)' }}>
            {cibleLabel}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
        {expiree && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#F0EDE5', color: 'var(--muted)' }}>Expirée</span>}
        <span style={{ fontSize: '11.5px', color: 'var(--muted)', marginLeft: 'auto' }}>
          {a.statut === 'brouillon' ? `Créée · ${timeAgo(a.created_at)}` : `Publiée · ${timeAgo(a.published_at || a.created_at)}`}
        </span>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{a.titre}</p>
      {a.contenu && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.contenu}</p>}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <i className="ti ti-user" aria-hidden="true"></i> {a.auteur} · {a.role}
      </p>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {a.statut === 'brouillon' && (
            <>
              <button onClick={() => onSetStatut('publiee')} style={actionBtnStyle('var(--forest)', '#fff')}>Publier</button>
              <button onClick={onEdit} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Modifier</button>
              <button onClick={onDelete} disabled={deleting} style={actionBtnStyle('var(--paper)', 'var(--danger)', true)}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
          {a.statut === 'publiee' && (
            <>
              <button onClick={onEdit} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Modifier</button>
              <button onClick={() => onSetStatut('archivee')} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Archiver</button>
              <button onClick={diffuserWhatsApp} disabled={waSending} style={actionBtnStyle('#25D366', '#fff')}>
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true"></i>
                {waSending ? 'Diffusion…' : 'Diffuser par WhatsApp'}
              </button>
            </>
          )}
          {a.statut === 'archivee' && (
            <>
              <button onClick={() => onSetStatut('publiee')} style={actionBtnStyle('var(--paper)', 'var(--ink)', true)}>Republier</button>
              <button onClick={onDelete} disabled={deleting} style={actionBtnStyle('var(--paper)', 'var(--danger)', true)}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
        </div>
      )}
      {waResult && (
        <p style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 600, color: waResult.ok ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className={`ti ${waResult.ok ? 'ti-check' : 'ti-alert-circle'}`} aria-hidden="true"></i> {waResult.text}
        </p>
      )}
    </div>
  );
}

function actionBtnStyle(bg, color, bordered) {
  return { display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: bordered ? '1px solid var(--line-strong)' : 'none', background: bg, color, cursor: 'pointer', transition: 'opacity 0.2s' };
}
