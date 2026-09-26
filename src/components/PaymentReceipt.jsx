import { fmtF, trancheLabel, typeFraisLabel, modeLabel } from '../lib/utils.js';
import { printDocument, slug } from '../lib/print.js';
import DocumentHeader from './DocumentHeader.jsx';

// Reçu imprimable d'UN paiement réellement enregistré — aucun champ n'est
// éditable ici, tout vient tel quel de la ligne "payments" passée en prop
// (jamais un montant ou une identité reconstruite/modifiée côté écran).
// Réutilisé à l'identique par l'admin (StudentDetail.jsx, Money.jsx) et le
// portail parent (ParentAccess.jsx) : mêmes données, même présentation.
export default function PaymentReceipt({ payment, studentName, classeNom, schoolYearLabel, school, montantDu, montantPaye, onClose }) {
  const reference = payment.id ? payment.id.slice(0, 8).toUpperCase() : '—';
  // Les frais d'inscription sont un montant fixe et ponctuel, sans lien
  // avec le solde de la scolarité — inutile d'y afficher un reste à payer.
  // Pour tout autre motif, si la scolarité n'est pas intégralement payée,
  // la famille doit le voir directement sur le reçu.
  const resteScolarite = montantDu != null && montantPaye != null ? Number(montantDu) - Number(montantPaye) : null;
  const showReste = payment.type_frais !== 'inscription' && resteScolarite > 0;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="print-sheet" style={{ padding: '26px 24px' }}>
          <DocumentHeader school={school} title="Reçu de paiement" subtitle={`Réf. ${reference}`} />

          <div style={{ marginBottom: 16 }}>
            <ReceiptRow label="Élève" value={studentName} />
            <ReceiptRow label="Classe" value={classeNom || '—'} />
            <ReceiptRow label="Année scolaire" value={schoolYearLabel || '—'} />
            <ReceiptRow label="Date du paiement" value={new Date(payment.date).toLocaleDateString('fr-FR')} />
            <ReceiptRow label="Motif" value={typeFraisLabel(payment.type_frais)} />
            <ReceiptRow label="Mode de paiement" value={modeLabel(payment.mode)} />
            <ReceiptRow label="Tranche" value={trancheLabel(payment.tranche)} />
            {payment.note && <ReceiptRow label="Note" value={payment.note} />}
          </div>

          <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '14px 18px', marginBottom: showReste ? 10 : 18 }}>
            <p style={{ margin: '0 0 3px', fontSize: 11.5, fontWeight: 600, color: 'var(--forest-dark)' }}>Montant reçu</p>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--forest-dark)' }}>{fmtF(payment.montant)}</p>
          </div>

          {showReste && (
            <div style={{ background: 'var(--danger-light)', borderRadius: 10, padding: '12px 18px', marginBottom: 18 }}>
              <p style={{ margin: '0 0 3px', fontSize: 11.5, fontWeight: 600, color: 'var(--danger)' }}>Reste à payer (scolarité)</p>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(resteScolarite)}</p>
            </div>
          )}

          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--muted)' }}>
            Document généré le {new Date().toLocaleDateString('fr-FR')} — atteste d'un paiement enregistré dans EcoGès.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26, fontSize: 12, color: 'var(--muted)' }}>
            <span>Signature / cachet</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 24px 20px', borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => printDocument(`recu-${slug(studentName)}-${payment.date}`)}
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

function ReceiptRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
