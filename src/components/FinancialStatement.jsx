import { fmtF, trancheLabel } from '../lib/utils.js';
import { printDocument, slug } from '../lib/print.js';
import DocumentHeader from './DocumentHeader.jsx';

// Situation financière imprimable d'un élève pour UNE année scolaire
// précise — reçoit les échéances/paiements déjà calculés par l'écran
// appelant (StudentDetail.jsx, ParentAccess.jsx), jamais un second calcul :
// une situation 2025-2026 ne peut donc jamais mélanger des paiements d'une
// autre année, puisqu'elle affiche exactement ce que l'écran affiche déjà.
export default function FinancialStatement({ studentName, classeNom, schoolYearLabel, montantDu, montantPaye, resteFrais, echeances, payments, school, onClose }) {
  const reste = montantDu - montantPaye;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="print-sheet" style={{ padding: '26px 24px' }}>
          <DocumentHeader school={school} title="Situation financière" subtitle={`Année scolaire ${schoolYearLabel || ''}`} />

          <p style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 600 }}>{studentName}{classeNom ? ` · ${classeNom}` : ''}</p>

          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <MiniCard label="Droit d'écolage — reste" value={fmtF(reste)} color={reste > 0 ? 'var(--danger)' : 'var(--success)'} />
            <MiniCard label="Frais connexes — reste" value={fmtF(resteFrais)} color={resteFrais > 0 ? 'var(--amber)' : 'var(--success)'} />
          </div>

          {echeances?.length > 0 && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Échéancier</p>
              <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 16 }}>
                {echeances.map((ec, i) => (
                  <div key={ec.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                    <span>{ec.label}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{fmtF(ec.montant)} — {ec.statut === 'payee' ? 'payée' : ec.statut === 'partielle' ? `partielle (${fmtF(ec.montantPaye)})` : 'impayée'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Paiements enregistrés</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {(payments || []).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                <span>{new Date(p.date).toLocaleDateString('fr-FR')} · {trancheLabel(p.tranche)}</span>
                <span style={{ fontWeight: 600 }}>{fmtF(p.montant)}</span>
              </div>
            ))}
            {(!payments || payments.length === 0) && <p style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12.5 }}>Aucun paiement enregistré.</p>}
          </div>

          <p style={{ margin: '18px 0 0', fontSize: 10.5, color: 'var(--muted)' }}>
            Document généré le {new Date().toLocaleDateString('fr-FR')} à partir des données réellement enregistrées dans EcoGès.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 24px 20px', borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => printDocument(`situation-financiere-${slug(studentName)}-${slug(schoolYearLabel)}`)}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}
          >
            <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
