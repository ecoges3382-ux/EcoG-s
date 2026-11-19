// Encadré en haut des formulaires d'encaissement : ce que l'élève doit, ce qu'il a déjà payé, et le détail tranche par
// tranche (laquelle est payée, laquelle l'est en partie et de combien, laquelle reste entière).
import { fmtF } from '../lib/utils.js';
import { detailEncaissements } from '../lib/paymentForm.js';

// Montant sans l'unité, pour garder les étiquettes courtes (« 23.000 » et non « 23.000 F CFA »).
const sansUnite = (n) => fmtF(n).replace(/\s*F CFA$/, '');

// Étiquette d'état d'une tranche. Plus courte que celle de la fiche élève et autorisée à passer à la ligne : dans un
// formulaire étroit (téléphone), l'originale dépassait du cadre.
function EtatTranche({ statut, montantPaye, montantRestant }) {
  const etats = {
    payee: { texte: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
    partielle: { texte: `Partielle · ${sansUnite(montantPaye)} payés · reste ${fmtF(montantRestant)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { texte: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
    a_venir: { texte: `À venir · ${fmtF(montantRestant)}`, bg: 'var(--chip-bg)', fg: 'var(--muted)' },
  };
  const e = etats[statut] || etats.impayee;
  return (
    <span style={{ background: e.bg, color: e.fg, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 14, lineHeight: 1.35, maxWidth: '100%', boxSizing: 'border-box' }}>
      {e.texte}
    </span>
  );
}

export default function PaymentProgress({ eleve, anneeScolaire, grilleFrais }) {
  if (!eleve) return null;
  const resteEcolage = Number(eleve.montant_du) - Number(eleve.montant_paye);
  const resteConnexe = Number(eleve.frais_connexe_du) - Number(eleve.frais_connexe_paye);
  const { echeances, prochaine, tropPercu } = detailEncaissements(eleve, anneeScolaire, grilleFrais);
  const texte = { margin: '2px 0 0', fontSize: 12, color: 'var(--forest-dark-text)' };

  return (
    <div style={{ background: 'var(--forest-light)', padding: '10px 14px', borderRadius: 9, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--forest-dark-text)', fontWeight: 600 }}>Écolage dû : {fmtF(eleve.montant_du)}</p>
          <p style={texte}>Déjà payé : {fmtF(eleve.montant_paye)}</p>
          {tropPercu > 0 && <p style={texte}>Dont {fmtF(tropPercu)} au-dessus du dû</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--forest-dark-text)', fontWeight: 600 }}>Reste écolage</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: resteEcolage > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(resteEcolage)}</p>
        </div>
      </div>

      {echeances.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line-strong)' }} aria-label="Détail des paiements par tranche">
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Détail par tranche</p>
          {echeances.map((ec) => (
            <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '5px 0' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--forest-dark-text)' }}>
                  {ec.label}
                  {ec.id === prochaine && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark-text)', border: '1px solid var(--forest-dark-text)', borderRadius: 20, padding: '1px 7px' }}>à payer en premier</span>}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--forest-dark-text)', opacity: 0.85 }}>
                  {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}{ec.enRetard ? ' · en retard' : ''}
                </p>
              </div>
              <EtatTranche statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
            </div>
          ))}
        </div>
      )}

      {echeances.length === 0 && (
        <p style={texte}>Connexes : {fmtF(eleve.frais_connexe_du)} / {fmtF(eleve.frais_connexe_paye)} · Reste connexes : {fmtF(resteConnexe)}</p>
      )}
    </div>
  );
}
