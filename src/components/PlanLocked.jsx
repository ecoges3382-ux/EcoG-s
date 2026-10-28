// src/components/PlanLocked.jsx
import { supportWhatsappLink } from '../lib/utils.js';

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function PlanLocked({ currentPlanLabel, requiredPlanLabel, featureDescription }) {
  const waMessage = `Bonjour, je souhaite passer au plan ${requiredPlanLabel} d'EcoGès pour débloquer : ${featureDescription}. Pouvez-vous me donner les prochaines étapes ?`;
  return (
    <div className="card-bold" style={{ padding: '36px 24px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--gold-light)', color: 'var(--clay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <LockIcon />
      </div>
      <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>
        Fonctionnalité non incluse dans votre plan
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
        L'accès à <strong>« {featureDescription} »</strong> est réservé aux plans <strong>{requiredPlanLabel}</strong> et supérieurs.<br />
        Votre école est actuellement en plan <strong>{currentPlanLabel}</strong>.
      </p>
      <a
        href={supportWhatsappLink(waMessage)}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, background: 'var(--forest)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13.5 }}
      >
        <i className="ti ti-brand-whatsapp" style={{ fontSize: 15 }} aria-hidden="true"></i>
        Passer à {requiredPlanLabel} sur WhatsApp
      </a>
    </div>
  );
}
