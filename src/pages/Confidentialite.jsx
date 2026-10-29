import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Logo.jsx';

function ArrowUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut"
      title="Remonter en haut"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 40,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        background: 'var(--forest)',
        color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(15,76,58,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ArrowUpIcon />
    </button>
  );
}

export default function Confidentialite() {
  useEffect(() => {
    document.body.classList.remove('app-mode');
    const styleId = 'confid-scroll-fix';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        html, body, #root {
          overflow: auto !important;
          overflow-y: auto !important;
          height: auto !important;
          min-height: 100vh !important;
          position: static !important;
          display: block !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-block', marginBottom: 24 }}>
          <Wordmark tone="onLight" height={40} />
        </Link>

        <div className="card-bold" style={{ padding: '32px 28px' }}>
          <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>
            Politique de confidentialité
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--muted)' }}>
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink)' }}>
            <p>La présente politique décrit comment EcoGès collecte, utilise et protège les données personnelles des utilisateurs de sa plateforme.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>1. Qui sommes-nous ?</h2>
            <p>EcoGès est un service de gestion scolaire en ligne édité par <strong>Récrate ADOHINZIN</strong>, basé à Cotonou, Bénin.</p>
            <p>Contact : ecoges3382@gmail.com</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>2. Quelles données collectons-nous ?</h2>
            <p>Dans le cadre de l'utilisation de la plateforme, nous hébergeons plusieurs types de données :</p>
            <p><strong>A. Données de l'École (compte client)</strong><br />
            Nom de l'école, adresse, téléphone, email, logo, informations de facturation, identifiants de connexion du personnel (nom, email, téléphone, rôle, mot de passe chiffré).</p>
            <p><strong>B. Données des élèves</strong><br />
            Nom, prénom, date de naissance, sexe, photo (optionnelle), classe, matricule, notes, présences, absences, données financières (montant dû, montant payé, historique des paiements).</p>
            <p><strong>C. Données des parents</strong><br />
            Nom, prénom, téléphone, email (optionnel), informations sur le lien de parenté (père, mère, tuteur).</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>3. Pourquoi collectons-nous ces données ?</h2>
            <p>Les données sont collectées uniquement pour les finalités suivantes :</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Permettre à l'École de gérer sa scolarité (inscriptions, notes, bulletins, paiements, présences).</li>
              <li>Permettre aux parents de consulter la scolarité de leur enfant via un code d'accès sécurisé.</li>
              <li>Permettre à l'Éditeur d'assurer le support technique et la maintenance du Service.</li>
              <li>Établir les factures et gérer les abonnements.</li>
            </ul>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>4. Qui a accès aux données ?</h2>
            <ul style={{ paddingLeft: 20 }}>
              <li>L'École et son personnel autorisé (selon leur rôle).</li>
              <li>Les parents, uniquement pour les données de leurs enfants, via un code d'accès personnel.</li>
              <li>L'Éditeur (EcoGès), pour la maintenance et le support technique.</li>
              <li>L'hébergeur (Supabase), qui stocke les données de manière sécurisée.</li>
            </ul>
            <p>Nous ne vendons, ne louons et ne partageons jamais vos données avec des tiers à des fins commerciales ou publicitaires.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>5. Où sont hébergées les données ?</h2>
            <p>Les données sont hébergées sur les serveurs de <strong>Supabase</strong> (base de données PostgreSQL sécurisée), situés dans l'Union Européenne (région de Francfort, Allemagne). Cet hébergement respecte les normes de sécurité internationales (RGPD).</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>6. Combien de temps conservons-nous les données ?</h2>
            <ul style={{ paddingLeft: 20 }}>
              <li>Pendant toute la durée de l'abonnement de l'École.</li>
              <li>En cas de résiliation, les données sont conservées 30 jours pour permettre l'export, puis définitivement supprimées.</li>
              <li>Les données comptables (factures) sont conservées 10 ans conformément à la loi.</li>
            </ul>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>7. Comment protégeons-nous les données ?</h2>
            <ul style={{ paddingLeft: 20 }}>
              <li><strong>Isolation totale</strong> : chaque école ne peut voir que ses propres données. Une école ne peut jamais accéder aux données d'une autre.</li>
              <li><strong>Chiffrement en transit</strong> (HTTPS) : toutes les communications entre votre navigateur et nos serveurs sont chiffrées.</li>
              <li><strong>Contrôle d'accès</strong> : chaque membre du personnel a un rôle (fondateur, directeur, secrétaire, enseignant) qui limite ce qu'il peut voir et faire.</li>
              <li><strong>Sauvegardes automatiques</strong> : des sauvegardes quotidiennes sont effectuées par Supabase.</li>
            </ul>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>8. Quels sont vos droits ?</h2>
            <p>Conformément aux lois sur la protection des données (y compris le RGPD pour les résidents européens) :</p>
            <ul style={{ paddingLeft: 20 }}>
              <li><strong>Droit d'accès</strong> : vous pouvez demander une copie de vos données à tout moment. L'École peut exporter ses données en CSV directement depuis la plateforme.</li>
              <li><strong>Droit de rectification</strong> : vous pouvez corriger vos données depuis la plateforme.</li>
              <li><strong>Droit à l'effacement</strong> : vous pouvez supprimer vos données. En cas de suppression de compte, les données sont effacées après 30 jours.</li>
              <li><strong>Droit d'opposition</strong> : vous pouvez nous contacter pour vous opposer à un traitement.</li>
            </ul>
            <p>Pour exercer ces droits, contactez-nous à ecoges3382@gmail.com.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>9. Cookies</h2>
            <p>EcoGès n'utilise pas de cookies publicitaires ou de traçage tiers. Seuls des cookies techniques strictement nécessaires au fonctionnement du Service (maintien de la session) sont utilisés.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>10. Modifications de cette politique</h2>
            <p>Cette politique peut être mise à jour. En cas de modification majeure, les Écoles seront informées par email ou via une notification sur la plateforme.</p>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 24 }}>11. Contact</h2>
            <p>Pour toute question relative à la protection de vos données :<br />
            Email : ecoges3382@gmail.com</p>
          </div>
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          <Link to="/" style={{ color: 'var(--forest)', fontWeight: 600, marginRight: 16 }}>Retour à l'accueil</Link>
          <Link to="/cgu" style={{ color: 'var(--forest)', fontWeight: 600 }}>Conditions d'utilisation</Link>
        </p>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
