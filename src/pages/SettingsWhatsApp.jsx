import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getWhatsAppConfig, saveWhatsAppConfig, WHATSAPP_TYPE_LABELS, WHATSAPP_STATUT_LABELS } from '../lib/whatsapp.js';

const CAN_VIEW_ROLES = ['fondateur', 'directeur', 'secretaire'];
const MESSAGE_TYPES = Object.keys(WHATSAPP_TYPE_LABELS);

const STATUT_BADGE = {
  actif: { label: 'Connecté', bg: 'var(--success-light)', fg: 'var(--success)' },
  non_configure: { label: 'Non configuré', bg: '#F0EDE5', fg: 'var(--muted)' },
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

  async function reloadConfig() {
    try {
      const data = await getWhatsAppConfig();
      setConfig(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reloadMessages() {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, type, destinataire_phone, statut, erreur, created_at, students ( full_name )')
      .order('created_at', { ascending: false })
      .limit(25);
    setMessages(data || []);
  }

  useEffect(() => {
    if (!canView) return;
    reloadConfig();
    reloadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire ont accès à WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/parametres" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux paramètres
      </Link>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>WhatsApp</p>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!error && !config && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {config && (
        <>
          <ConfigCard config={config} onSaved={reloadConfig} />
          <HistoryCard messages={messages} />
        </>
      )}
    </div>
  );
}

function ConfigCard({ config, onSaved }) {
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

function HistoryCard({ messages }) {
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Derniers envois</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 560 }}>
        {messages === null && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>}
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
