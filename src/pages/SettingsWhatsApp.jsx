import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getWhatsAppConfig, saveWhatsAppConfig, WHATSAPP_TYPE_LABELS, WHATSAPP_STATUT_LABELS } from '../lib/whatsapp.js';
import { useToast } from '../components/Toast.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonRow } from '../components/Skeleton.jsx';

const CAN_VIEW_ROLES = ['fondateur', 'directeur', 'secretaire'];
const MESSAGE_TYPES = Object.keys(WHATSAPP_TYPE_LABELS);

const STATUT_BADGE = {
  actif: { label: 'Connecté', bg: 'var(--success-light)', fg: 'var(--success)' },
  non_configure: { label: 'Non configuré', bg: 'var(--chip-bg)', fg: 'var(--muted)' },
  erreur: { label: 'Erreur', bg: 'var(--danger-light)', fg: 'var(--danger)' },
};

// Canal de communication optionnel : cet écran ne fait que consulter/écrire
// la configuration (jamais le jeton lui-même, voir lib/whatsapp.js) et
// afficher l'historique — tout l'envoi réel vit dans l'Edge Function
// whatsapp-send, déclenchée depuis les écrans métier (fiche élève,
// annonces), jamais depuis ici.
export default function SettingsWhatsApp() {
  const { profile } = useAuth();
  const canView = CAN_VIEW_ROLES.includes(profile.role);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState(null);
  const [offline, setOffline] = useState(false);
  // null = en cours de lecture, false = pas d'OpenWA pour cette école, objet = ligne openwa_configs active
  const [openwa, setOpenwa] = useState(null);

  async function reloadOpenwa() {
    const { data, error: openwaError } = await supabase
      .from('openwa_configs')
      .select('display_phone_number, statut')
      .eq('school_id', profile.school_id)
      .eq('statut', 'actif')
      .maybeSingle();
    setOpenwa(openwaError ? false : (data || false));
  }

  async function reloadConfig() {
    try {
      const data = await getWhatsAppConfig();
      setConfig(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reloadMessages() {
    await guardedFetch({
      cacheKey: `whatsapp_messages_${profile.school_id}`,
      hasData: messages !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('whatsapp_messages')
          .select('id, type, destinataire_phone, statut, erreur, created_at, students ( full_name )')
          .order('created_at', { ascending: false })
          .limit(25);
        return fetchError ? { error: fetchError } : { data: data || [] };
      },
      setData: setMessages,
      setOffline,
    });
  }

  useEffect(() => {
    if (!canView) return;
    reloadConfig();
    reloadMessages();
    reloadOpenwa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-text)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire ont accès à WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/parametres" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest-text)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux paramètres
      </Link>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>WhatsApp</p>

      {offline && <OfflineBanner />}
      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!error && !config && <div className="card-bold"><SkeletonRow count={3} avatar={false} /></div>}

      {config && (
        <>
          <HealthCard schoolId={profile.school_id} openwa={openwa} metaStatut={config.statut} />
          {openwa ? (
            // École sur OpenWA : le formulaire ci-dessous ne concerne que l'API officielle de Meta,
            // qu'elle n'utilise pas. On le range pour ne pas laisser croire que WhatsApp est « Non configuré ».
            <details style={{ marginBottom: 20, maxWidth: 560 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
                API officielle de Meta (non utilisée par votre école)
              </summary>
              <div style={{ marginTop: 12 }}><ConfigCard config={config} onSaved={reloadConfig} /></div>
            </details>
          ) : (
            <ConfigCard config={config} onSaved={reloadConfig} />
          )}
          <HistoryCard messages={messages} />
        </>
      )}
    </div>
  );
}

function ConfigCard({ config, onSaved }) {
  const showToast = useToast();
  const [phoneNumberId, setPhoneNumberId] = useState(config.phone_number_id || '');
  const [wabaId, setWabaId] = useState(config.waba_id || '');
  const [displayPhone, setDisplayPhone] = useState(config.display_phone_number || '');
  const [accessToken, setAccessToken] = useState('');
  const [templates, setTemplates] = useState(() => {
    const t = {};
    MESSAGE_TYPES.forEach((type) => { t[type] = { name: config.templates?.[type]?.name || '', lang: config.templates?.[type]?.lang || 'fr' }; });
    return t;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const badge = STATUT_BADGE[config.statut] || STATUT_BADGE.non_configure;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await saveWhatsAppConfig({
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        display_phone_number: displayPhone.trim(),
        access_token: accessToken.trim(), // vide = ne remplace pas le jeton déjà enregistré
        templates,
      });
      setAccessToken('');
      setSaved(true);
      showToast('Enregistré');
      onSaved();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="card-bold" style={{ padding: 22, maxWidth: 560, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Compte WhatsApp Business</p>
        <span style={{ background: badge.bg, color: badge.fg, fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20 }}>{badge.label}</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Propre à votre école — jamais partagé avec un autre établissement. Le jeton d'accès n'est jamais réaffiché
        une fois enregistré{config.has_token ? ' (un jeton est déjà enregistré : laisse le champ vide pour le conserver)' : ''}.
      </p>

      {!config.can_manage && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>Seuls le fondateur et le directeur peuvent modifier cette configuration.</p>
      )}

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Phone Number ID (Meta)</label>
          <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} disabled={!config.can_manage} style={inputStyle} placeholder="ex. 109876543210987" />
        </div>
        <div>
          <label style={labelStyle}>WhatsApp Business Account ID (facultatif)</label>
          <input value={wabaId} onChange={(e) => setWabaId(e.target.value)} disabled={!config.can_manage} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Numéro affiché (facultatif, pour repère)</label>
          <input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} disabled={!config.can_manage} style={inputStyle} placeholder="+229 XX XX XX XX" />
        </div>
        <div>
          <label style={labelStyle}>Jeton d'accès permanent (Meta)</label>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} disabled={!config.can_manage} style={inputStyle} placeholder={config.has_token ? '••••••••  (laisser vide pour conserver)' : 'Coller le jeton fourni par Meta'} />
        </div>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Templates approuvés</p>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Chaque type de message doit correspondre à un template déjà approuvé dans le Gestionnaire WhatsApp Business
        de Meta — EcoGès ne crée ni n'approuve aucun template, il utilise seulement le nom exact que vous indiquez ici.
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        {MESSAGE_TYPES.map((type) => (
          <div key={type} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8, alignItems: 'end' }} className="desktop-grid-3">
            <div>
              <label style={{ ...labelStyle, marginBottom: 3 }}>{WHATSAPP_TYPE_LABELS[type]}</label>
              <input
                value={templates[type].name}
                onChange={(e) => setTemplates((t) => ({ ...t, [type]: { ...t[type], name: e.target.value } }))}
                disabled={!config.can_manage}
                style={inputStyle}
                placeholder="nom_du_template"
              />
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: 3 }}>Langue</label>
              <input
                value={templates[type].lang}
                onChange={(e) => setTemplates((t) => ({ ...t, [type]: { ...t[type], lang: e.target.value } }))}
                disabled={!config.can_manage}
                style={inputStyle}
                placeholder="fr"
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      {saved && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--success)', fontWeight: 600 }}>Enregistré.</p>}

      {config.can_manage && (
        <button type="submit" disabled={saving} style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
    </form>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SENT_STATUTS = ['envoye', 'livre', 'lu'];

// Résume l'état des envois : ce que l'école voit du canal WhatsApp sans aller dans les journaux du serveur.
// Tout vient de l'historique enregistré (whatsapp_messages) : ce bloc ne vérifie PAS en direct que le
// téléphone de l'école est connecté à WhatsApp, il montre si les envois récents ont réussi ou échoué.
function HealthCard({ schoolId, openwa, metaStatut }) {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const now = Date.now();
        const since24 = new Date(now - DAY_MS).toISOString();
        const since7 = new Date(now - 7 * DAY_MS).toISOString();
        const stuckBefore = new Date(now - 10 * 60 * 1000).toISOString();
        const count = (statuts, since, before) => {
          let q = supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).in('statut', statuts).gte('created_at', since);
          if (before) q = q.lt('created_at', before);
          return q;
        };
        const [sent24, failed24, sent7, failed7, stuck, lastOk, failures] = await Promise.all([
          count(SENT_STATUTS, since24),
          count(['echec'], since24),
          count(SENT_STATUTS, since7),
          count(['echec'], since7),
          count(['en_attente'], since7, stuckBefore),
          supabase.from('whatsapp_messages').select('created_at').eq('school_id', schoolId).in('statut', SENT_STATUTS).order('created_at', { ascending: false }).limit(1),
          supabase.from('whatsapp_messages').select('id, type, erreur, created_at, students ( full_name ), parent_access ( full_name )').eq('school_id', schoolId).eq('statut', 'echec').gte('created_at', since7).order('created_at', { ascending: false }).limit(10),
        ]);
        const errored = [sent24, failed24, sent7, failed7, stuck, lastOk, failures].find((r) => r.error);
        if (errored) throw errored.error;
        if (cancelled) return;
        setHealth({
          sent24: sent24.count || 0,
          failed24: failed24.count || 0,
          sent7: sent7.count || 0,
          failed7: failed7.count || 0,
          stuck: stuck.count || 0,
          lastOk: lastOk.data?.[0]?.created_at || null,
          failures: failures.data || [],
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  if (failed) {
    return <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>Impossible de charger le suivi des envois.</p>;
  }
  if (!health || openwa === null) {
    return <div className="card-bold" style={{ maxWidth: 560, marginBottom: 20 }}><SkeletonRow count={2} avatar={false} /></div>;
  }

  const channelLabel = openwa
    ? `OpenWA${openwa.display_phone_number ? ` · ${openwa.display_phone_number}` : ''}`
    : (metaStatut === 'actif' ? 'API officielle de Meta' : 'Aucun canal configuré');

  let verdict;
  if (!openwa && metaStatut !== 'actif') {
    verdict = { tone: 'neutral', text: "Aucun canal WhatsApp n'est actif pour votre école." };
  } else if (health.sent24 + health.failed24 === 0) {
    verdict = { tone: 'neutral', text: 'Aucun envoi ces dernières 24 heures.' };
  } else if (health.failed24 === 0) {
    verdict = { tone: 'ok', text: 'Les envois des dernières 24 heures ont réussi.' };
  } else if (health.sent24 === 0) {
    verdict = { tone: 'bad', text: 'Tous les envois des dernières 24 heures ont échoué. Vérifiez que le serveur WhatsApp fonctionne et que le téléphone de l\'école est toujours connecté.' };
  } else {
    verdict = { tone: 'warn', text: `${health.failed24} envoi(s) en échec sur les dernières 24 heures.` };
  }
  const TONES = {
    ok: { bg: 'var(--success-light)', fg: 'var(--success)' },
    warn: { bg: 'var(--gold-light)', fg: 'var(--clay-text)' },
    bad: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
    neutral: { bg: 'var(--chip-bg)', fg: 'var(--muted)' },
  };
  const tone = TONES[verdict.tone];

  return (
    <div style={{ marginBottom: 22, maxWidth: 560 }}>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Suivi des envois</p>
      <div className="card-bold" style={{ padding: '16px 18px' }}>
        <div style={{ background: tone.bg, color: tone.fg, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
          {verdict.text}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <HealthStat label="24 heures" sent={health.sent24} failed={health.failed24} />
          <HealthStat label="7 jours" sent={health.sent7} failed={health.failed7} />
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--muted)' }}>Canal : <strong style={{ color: 'var(--ink)' }}>{channelLabel}</strong></p>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--muted)' }}>
          Dernier message envoyé : <strong style={{ color: 'var(--ink)' }}>{health.lastOk ? new Date(health.lastOk).toLocaleString('fr-FR') : 'aucun'}</strong>
        </p>
        {health.stuck > 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--clay-text)', fontWeight: 600 }}>
            {health.stuck === 1
              ? "1 message est resté « en attente » depuis plus de 10 minutes : on ne sait pas s'il est parti."
              : `${health.stuck} messages sont restés « en attente » depuis plus de 10 minutes : on ne sait pas s'ils sont partis.`}
          </p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Ce suivi résume les envois enregistrés. Il ne vérifie pas en direct que le téléphone est connecté à WhatsApp.
        </p>
      </div>

      {health.failures.length > 0 && (
        <>
          <p style={{ margin: '16px 0 8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Échecs des 7 derniers jours</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {health.failures.map((f, i) => (
              <div key={f.id} style={{ padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600 }}>
                  {WHATSAPP_TYPE_LABELS[f.type] || f.type}{f.students?.full_name ? ` · ${f.students.full_name}` : ''}{f.parent_access?.full_name ? ` · ${f.parent_access.full_name}` : ''}
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {new Date(f.created_at).toLocaleString('fr-FR')}
                  {f.erreur ? ` · ${String(f.erreur).slice(0, 140)}` : ''}
                  {f.erreur && /fetch failed|network|réseau|timed? ?out|ECONN|ENOTFOUND/i.test(f.erreur) ? ' · Le serveur WhatsApp est injoignable.' : ''}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HealthStat({ label, sent, failed }) {
  return (
    <div style={{ background: 'var(--chip-bg)', borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>
        <strong style={{ color: 'var(--success)' }}>{sent}</strong> envoyé(s) · <strong style={{ color: failed > 0 ? 'var(--danger)' : 'var(--muted)' }}>{failed}</strong> échec(s)
      </p>
    </div>
  );
}

function HistoryCard({ messages }) {
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Derniers envois</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 560 }}>
        {messages === null && <SkeletonRow count={2} avatar={false} />}
        {messages?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun message envoyé pour l'instant.</p>}
        {messages?.map((m, i) => {
          const st = WHATSAPP_STATUT_LABELS[m.statut] || WHATSAPP_STATUT_LABELS.en_attente;
          return (
            <div key={m.id} style={{ padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{WHATSAPP_TYPE_LABELS[m.type] || m.type}{m.students?.full_name ? ` · ${m.students.full_name}` : ''}</span>
                <span style={{ background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{st.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
                {new Date(m.created_at).toLocaleString('fr-FR')}{m.erreur ? ` · ${m.erreur}` : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
