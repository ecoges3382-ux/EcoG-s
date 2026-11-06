import { fmtF, trancheLabel } from '../../lib/utils.js';
import { computeEcheances } from '../../lib/retard.js';
import { toCalcEnrollment } from '../../lib/parentPortal.js';

export function EcheanceBadge({ statut, montantPaye, montantRestant }) {
  const map = {
    payee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
    partielle: { label: `Partielle · ${fmtF(montantPaye)} payés · reste ${fmtF(montantRestant)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { label: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
    a_venir: { label: 'À venir', bg: '#F0EDE5', fg: 'var(--muted)' },
  };
  const s = map[statut] || map.impayee;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>
  );
}

export function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

export default function ChildFinance({ enrollment, payments, schoolYear, setReceiptPayment, setShowStatement }) {
  const reste = Number(enrollment.montant_du) - Number(enrollment.montant_paye);
  const resteFrais = Number(enrollment.frais_connexe_du) - Number(enrollment.frais_connexe_paye);
  const echeances = computeEcheances(toCalcEnrollment(enrollment), schoolYear, null);

  return (
    <>
      <Section title="Situation financière">
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
          <Stat label="Reste à payer (écolage)" value={fmtF(reste)} color={reste > 0 ? 'var(--danger)' : 'var(--success)'} />
          <Stat label="Reste (frais connexes)" value={fmtF(resteFrais)} color={resteFrais > 0 ? 'var(--amber)' : 'var(--success)'} />
        </div>
        {enrollment.has_arrangement && (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
            Un arrangement de paiement est en cours pour cet élève — contacte le secrétariat pour le détail.
          </p>
        )}
        {echeances.length > 0 && (
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {echeances.map((ec, i) => (
              <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ec.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                    {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <EcheanceBadge statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowStatement(true)}
          style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
        >
          <i className="ti ti-file-invoice" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
          Imprimer la situation financière
        </button>
      </Section>

      <Section title="Paiements enregistrés">
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {(payments || []).slice(0, 10).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div>
                <span style={{ fontSize: 13 }}>{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 8 }}>{trancheLabel(p.tranche)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtF(p.montant)}</span>
                <button
                  type="button"
                  onClick={() => setReceiptPayment(p)}
                  title="Imprimer le reçu"
                  style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <i className="ti ti-receipt" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </button>
              </div>
            </div>
          ))}
          {(payments || []).length === 0 && <p style={{ padding: '14px 18px', color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré.</p>}
        </div>
      </Section>
    </>
  );
}
