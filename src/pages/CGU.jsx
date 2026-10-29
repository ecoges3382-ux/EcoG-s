import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Logo.jsx';

export default function CGU() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-block', marginBottom: 24 }}>
          <Wordmark tone="onLight" height={40} />
        </Link>

        <div className="card-bold" style={{ padding: '32px 28px' }}>
          <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>
            Conditions Générales d'Utilisation
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--muted)' }}>
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>1. Objet</h2>
            <p>Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme EcoGès (ci-après « le Service »), service de gestion scolaire en ligne édité par <strong>Récrate ADOHINZIN</strong> (ci-après « l'Éditeur »).</p>
            <p>Le Service est destiné aux établissements scolaires privés (ci-après « l'École » ou « le Client ») et à leur personnel autorisé.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>2. Acceptation des CGU</h2>
            <p>L'utilisation du Service implique l'acceptation pleine et entière des présentes CGU. Si l'École n'accepte pas ces conditions, elle ne doit pas utiliser le Service. L'École garantit avoir le pouvoir et la capacité de conclure le présent contrat au nom de l'établissement.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>3. Accès au Service</h2>
            <p><strong>3.1.</strong> Le Service est accessible 24h/24 et 7j/7, sous réserve des périodes de maintenance planifiées ou imprévues.</p>
            <p><strong>3.2.</strong> L'École est responsable de la confidentialité de ses identifiants et de ceux de son personnel. Toute action effectuée avec ces identifiants est réputée avoir été faite par l'École.</p>
            <p><strong>3.3.</strong> L'Éditeur se réserve le droit de suspendre l'accès au Service en cas de non-paiement, de violation des présentes CGU, ou de comportement mettant en péril la sécurité de la plateforme.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>4. Fonctionnalités et Plans</h2>
            <p><strong>4.1.</strong> Le Service est proposé sous différents plans (Découverte, Essentiel, Standard, Premium). Les fonctionnalités et les limites (nombre d'élèves, de comptes) sont détaillées sur la page Tarifs.</p>
            <p><strong>4.2.</strong> Le plan Découverte est gratuit et limité. Les plans payants sont facturés annuellement ou mensuellement, selon les conditions choisies lors de la souscription.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>5. Obligations de l'École</h2>
            <p><strong>5.1.</strong> L'École s'engage à utiliser le Service conformément à sa destination (gestion scolaire) et à la législation en vigueur.</p>
            <p><strong>5.2.</strong> L'École est seule responsable du contenu qu'elle saisit dans le Service, notamment les données personnelles des élèves, des parents et du personnel.</p>
            <p><strong>5.3.</strong> L'École s'engage à informer les parents et le personnel de l'utilisation de la plateforme pour la gestion de leurs données, et à recueillir leur consentement lorsque la loi l'exige.</p>
            <p><strong>5.4.</strong> L'École s'engage à ne pas partager ses accès avec des personnes extérieures à l'établissement.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>6. Protection des données personnelles</h2>
            <p><strong>6.1.</strong> Le Service héberge des données personnelles, y compris des données concernant des mineurs.</p>
            <p><strong>6.2.</strong> Dans le cadre de l'utilisation du Service, l'École agit en tant que « Responsable du traitement » et l'Éditeur agit en tant que « Sous-traitant ».</p>
            <p><strong>6.3.</strong> L'Éditeur met en œuvre les mesures techniques et organisationnelles appropriées pour garantir la sécurité des données (hébergement sécurisé, isolation des données par école, chiffrement en transit).</p>
            <p><strong>6.4.</strong> L'Éditeur ne vend ni ne partage les données de l'École avec des tiers à des fins commerciales.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>7. Propriété intellectuelle</h2>
            <p><strong>7.1.</strong> L'Éditeur est propriétaire exclusif du code source, des marques, des logos et de la structure du Service EcoGès.</p>
            <p><strong>7.2.</strong> L'École dispose d'un droit d'usage non exclusif et non transférable du Service pour la durée de son abonnement.</p>
            <p><strong>7.3.</strong> Les données saisies par l'École restent sa propriété exclusive. L'École peut à tout moment exporter ses données au format CSV via les fonctionnalités prévues à cet effet.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>8. Tarifs et Paiement</h2>
            <p><strong>8.1.</strong> Les tarifs sont indiqués en Francs CFA (F CFA). Ils peuvent être modifiés par l'Éditeur, avec un préavis de 30 jours pour les abonnements en cours.</p>
            <p><strong>8.2.</strong> Le paiement s'effectue par virement bancaire ou Mobile Money (Orange Money, MTN MoMo), selon les instructions fournies par l'Éditeur.</p>
            <p><strong>8.3.</strong> Les abonnements sont payables d'avance (annuellement ou mensuellement). En cas de non-paiement, l'accès au Service peut être suspendu après relance.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>9. Responsabilité</h2>
            <p><strong>9.1.</strong> L'Éditeur met tout en œuvre pour assurer la disponibilité et la fiabilité du Service, mais ne peut être tenu responsable des interruptions liées à Internet, à des pannes techniques imprévues ou à des cas de force majeure.</p>
            <p><strong>9.2.</strong> L'Éditeur ne peut être tenu responsable des erreurs de saisie, des pertes de données dues à une mauvaise utilisation par l'École, ou de la non-conformité des données de l'École avec la réglementation locale.</p>
            <p><strong>9.3.</strong> La responsabilité globale de l'Éditeur, en cas de dommage avéré, est limitée au montant de l'abonnement annuel payé par l'École.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>10. Résiliation</h2>
            <p><strong>10.1.</strong> L'École peut résilier son abonnement à tout moment. La résiliation prend effet à la fin de la période en cours (année ou mois).</p>
            <p><strong>10.2.</strong> En cas de résiliation, l'École conserve l'accès en lecture à ses données pendant 30 jours pour lui permettre de les exporter, puis les données sont définitivement supprimées des serveurs.</p>
            <p><strong>10.3.</strong> L'Éditeur peut résilier le contrat en cas de violation grave des CGU.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>11. Droit applicable et litiges</h2>
            <p>Les présentes CGU sont soumises au droit béninois. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents de Cotonou seront seuls saisis.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>12. Contact</h2>
            <p>Pour toute question relative aux présentes CGU, l'École peut contacter l'Éditeur à l'adresse : <strong>ecoges3382@gmail.com</strong></p>
          </div>
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          <Link to="/" style={{ color: 'var(--forest)', fontWeight: 600, marginRight: 16 }}>Retour à l'accueil</Link>
          <Link to="/confidentialite" style={{ color: 'var(--forest)', fontWeight: 600 }}>Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}
