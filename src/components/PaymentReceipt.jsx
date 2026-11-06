import { createPortal } from 'react-dom';
import { useEffect, useMemo } from 'react';
import { fmtF, trancheLabel, typeFraisLabel, modeLabel } from '../lib/utils.js';
import { computeEcheances } from '../lib/retard.js';
import DocumentHeader from './DocumentHeader.jsx';

export default function PaymentReceipt({
  payment, studentName, classeNom, studentMatricule, schoolYearLabel, school,
  montantDu, montantPaye,
  enrollment, schoolYear, feeSchedule,
  autoPrint = false, // 👈 Modifié : false par défaut
  onClose,
}) {
  const reference = payment.id ? payment.id.slice(0, 8).toUpperCase() : '—';

  // Décomposition par tranche (uniquement pour paiement écolage)
  const breakdown = useMemo(() => {
    if (payment.type_frais !== 'scolarite') return null;
    if (!enrollment || !schoolYear) return null;
    try {
      const echeances = computeEcheances(enrollment, schoolYear, feeSchedule || null);
      const unpaid = echeances.filter((e) => e.id.startsWith('tranche') && e.montantRestant > 0);
      return unpaid.length > 0 ? unpaid : null;
    } catch {
      return null;
    }
  }, [payment.type_frais, enrollment, schoolYear, feeSchedule]);

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);

  // Auto-print (si demandé explicitement)
  useEffect(() => {
    if (!autoPrint) return undefined;
    const timer = setTimeout(() => triggerPrint(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  function triggerPrint() {
    document.body.classList.add('receipt-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('receipt-printing'), 800);
    }, 100);
  }

  const copyProps = {
    payment, studentName, classeNom, studentMatricule, schoolYearLabel, school,
    montantDu, montantPaye, reference, breakdown,
  };

  return createPortal(
    <div className="receipt-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Aperçu à l'écran */}
        <div className="receipt-screen-only" style={{ padding: '26px 24px' }}>
          <ReceiptBody {...copyProps} compact={false} />
        </div>

        {/* 4 copies pour l'impression (2×2 sur A4) */}
        <div className="receipt-quad-print">
          <div className="receipt-copy"><ReceiptBody {...copyProps} compact={true} /></div>
          <div className="receipt-copy"><ReceiptBody {...copyProps} compact={true} /></div>
          <div className="receipt-copy"><ReceiptBody {...copyProps} compact={true} /></div>
          <div className="receipt-copy"><ReceiptBody {...copyProps} compact={true} /></div>
        </div>

        {/* Boutons (cachés à l'impression) */}
        <div className="receipt-buttons" style={{ display: 'flex', gap: 10, padding: '14px 24px 20px', borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={triggerPrint}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}
          >
            <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            Imprimer (4 copies / A4)
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
    </div>,
    document.body
  );
}

function ReceiptBody({ payment, studentName, classeNom, studentMatricule, schoolYearLabel, school, montantDu, montantPaye, reference, breakdown, compact }) {
  const resteScolarite = montantDu != null && montantPaye != null ? Number(montantDu) - Number(montantPaye) : null;
  const showReste = payment.type_frais !== 'inscription' && resteScolarite > 0;

  const labelFont = compact ? 7.5 : 11.5;
  const rowFont = compact ? 8.5 : 13;
  const smallFont = compact ? 7 : 10.5;

  return (
    <>
      <DocumentHeader school={school} title="Reçu de paiement" subtitle={`Réf. ${reference}`} compact={compact} />

      <div style={{ marginBottom: compact ? 5 : 16 }}>
        <ReceiptRow label="Élève" value={studentName} compact={compact} />
        {studentMatricule && <ReceiptRow label="Matricule" value={studentMatricule} compact={compact} />}
        <ReceiptRow label="Classe" value={classeNom || '—'} compact={compact} />
        <ReceiptRow label="Année scolaire" value={schoolYearLabel || '—'} compact={compact} />
        <ReceiptRow label="Date du paiement" value={new Date(payment.date).toLocaleDateString('fr-FR')} compact={compact} />
        <ReceiptRow label="Tranche" value={trancheLabel(payment.tranche)} compact={compact} />
        <ReceiptRow label="Motif" value={typeFraisLabel(payment.type_frais)} compact={compact} />
        {payment.note && <ReceiptRow label="Note" value={payment.note} compact={compact} />}
        <ReceiptRow label="Mode de paiement" value={modeLabel(payment.mode)} compact={compact} />
      </div>

      <div style={{ background: 'var(--forest-light)', borderRadius: compact ? 5 : 10, padding: compact ? '4px 8px' : '14px 18px', marginBottom: compact ? 5 : showReste ? 10 : 18 }}>
        <p style={{ margin: '0 0 1px', fontSize: labelFont, fontWeight: 600, color: 'var(--forest-dark)' }}>Montant reçu</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: compact ? 14 : 22, fontWeight: 700, color: 'var(--forest-dark)' }}>{fmtF(payment.montant)}</p>
      </div>

      {showReste && (
        <div style={{ background: 'var(--danger-light)', borderRadius: compact ? 5 : 10, padding: compact ? '4px 8px' : '12px 18px', marginBottom: compact ? 5 : 14 }}>
          <p style={{ margin: '0 0 1px', fontSize: labelFont, fontWeight: 600, color: 'var(--danger)' }}>Reste à payer (scolarité)</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: compact ? 12 : 18, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(resteScolarite)}</p>
        </div>
      )}

      {breakdown && (
        <div style={{ marginBottom: compact ? 5 : 18 }}>
          <p style={{ margin: '0 0 3px', fontSize: labelFont, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Reste à payer par tranche
          </p>
          {breakdown.map((ec) => (
            <div key={ec.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6,
              fontSize: rowFont, padding: compact ? '1px 0' : '4px 0',
              borderBottom: '1px solid #F0ECE3',
            }}>
              <span style={{ flexShrink: 0 }}>{ec.label}</span>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{fmtF(ec.montantRestant)}</span>
              <span style={{ color: 'var(--muted)', fontSize: smallFont, textAlign: 'right' }}>
                {ec.dateLimite ? `avant ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 👇 MODIFICATION ICI : Mention de l'école au lieu d'EcoGès */}
      <p style={{ margin: 0, fontSize: smallFont, color: 'var(--muted)' }}>
        Généré le {new Date().toLocaleDateString('fr-FR')} — atteste d'un paiement enregistré à {school?.name || "l'école"}.
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: compact ? 8 : 26, fontSize: smallFont, color: 'var(--muted)' }}>
        <span>Signature / cachet</span>
      </div>
    </>
  );
}

function ReceiptRow({ label, value, compact }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 8,
      padding: compact ? '1px 0' : '7px 0',
      borderBottom: '1px solid var(--line)',
      fontSize: compact ? 8.5 : 13,
    }}>
      <span style={{ color: 'var(--muted)', fontSize: compact ? 7.5 : 11.5 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
