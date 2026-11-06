import { fmtF } from '../../lib/utils.js';
import { useAuth } from '../../auth/AuthProvider.jsx';

const CAN_SEND_WHATSAPP_ROLES = ['fondateur', 'directeur', 'secretaire'];

export function Row({ label, value, color, bold, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : '13.5px', marginBottom: bold ? 0 : 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: bold ? undefined : 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color }}>{value}</span>
    </div>
  );
}

export function EcheanceBadge({ statut, montantPaye, montantRestant }) {
  const map = {
    payee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
    partielle: { label: `Partielle · ${fmtF(montantPaye)} payés · reste ${fmtF(montantRestant)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { label: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
    a_venir: { label: 'À venir', bg: '#F0EDE5', fg: 'var(--muted)' },
  };
  const s = map[statut] || map.impayee;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export default function StudentFinancials({ 
  enrollment, reste, resteFrais, echeances, 
  isHistorical, sendRelance, whatsappSending, whatsappResult, setShowStatement 
}) {
  const { profile } = useAuth();

  return (
    <>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640, marginBottom: 20 }}>
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

      {echeances.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Échéancier</p>
          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
            {echeances.map((ec, i) => (
              <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < echeances.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{ec.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                    {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
                    {ec.enRetard ? ' · en retard' : ''}
                  </p>
                </div>
                <EcheanceBadge statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
              </div>
            ))}
          </div>
          {!isHistorical && CAN_SEND_WHATSAPP_ROLES.includes(profile.role) && echeances.some((e) => e.enRetard) && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={sendRelance}
                disabled={whatsappSending}
                style={{ fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#25D366', color: '#fff', opacity: whatsappSending ? 0.7 : 1, cursor: whatsappSending ? 'default' : 'pointer' }}
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 15, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
                {whatsappSending ? 'Envoi…' : 'Envoyer une relance WhatsApp'}
              </button>
              {whatsappResult && (
                <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: whatsappResult.ok ? 'var(--success)' : 'var(--danger)' }}>{whatsappResult.text}</p>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowStatement(true)}
        style={{ marginBottom: 20, fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
      >
        <i className="ti ti-file-invoice" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
        Imprimer la situation financière
      </button>
    </>
  );
}
