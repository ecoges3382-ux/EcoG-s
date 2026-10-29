import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supportWhatsappLink, SUPPORT_WHATSAPP_DISPLAY, supportMailLink } from '../lib/utils.js';

// --- Icônes ---
function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function CheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// --- Composant Accordéon ---
function Section({ title, icon, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-bold" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: open ? 'var(--forest-light)' : 'var(--paper)',
          border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: 'var(--forest)', display: 'flex' }}>{icon}</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--serif)' }}>{title}</span>
        </div>
        <div style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <ChevronDown />
        </div>
      </button>
      {open && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// --- Étape numérotée ---
function Step({ num, title, text, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>
        {num}
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{title}</p>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{text}</p>
        {children}
      </div>
    </div>
  );
}

export default function Aide() {
  const waMessage = "Bonjour, j'ai besoin d'aide sur EcoGès. Voici ma question : ";
  const waLink = supportWhatsappLink(waMessage);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 40 }}>
      
      {/* En-tête */}
      <div style={{ marginBottom: 28 }}>
        <p className="page-title" style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>
          Centre d'aide
        </p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          Retrouvez ici les réponses aux questions les plus fréquentes pour configurer et utiliser votre école sur EcoGès. Cliquez sur un thème pour l'ouvrir.
        </p>
      </div>

      {/* 1. Démarrage */}
      <Section title="1. Démarrage : Configuration initiale" icon={<CheckCircle />}>
        <p style={{ marginTop: 0 }}>Avant de pouvoir inscrire des élèves, vous devez préparer votre école en 3 étapes :</p>
        <Step num="1" title="Créer vos classes" text="Allez dans le menu « Classes » (ou « Configuration initiale »). Cliquez sur « Nouvelle classe », choisissez le niveau (ex: CM2) et validez. Répétez pour toutes vos classes." />
        <Step num="2" title="Configurer les tarifs" text="Allez dans « Paramètres » puis « Grille tarifaire ». Sélectionnez une classe, saisissez les montants des tranches et des frais connexes. Le montant total se calcule tout seul." />
        <Step num="3" title="Ajouter du personnel" text="Allez dans « Personnel », cliquez sur « Ajouter ». Puis allez dans « Comptes » pour leur créer un accès avec un email et un mot de passe." />
      </Section>

      {/* 2. Élèves */}
      <Section title="2. Gérer les élèves" icon={<CheckCircle />}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Comment inscrire un nouvel élève ?</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Allez dans le menu « Élèves » et cliquez sur « Ajouter ».</li>
          <li>Remplissez les informations (Nom, Prénom, Classe). Le montant de l'écolage dû se remplit automatiquement.</li>
          <li>Si le parent paie une partie aujourd'hui, enregistrez-la dans « Paiement à l'inscription ».</li>
          <li>Cliquez sur « Inscrire ».</li>
        </ol>

        <p style={{ marginTop: 16, fontWeight: 700 }}>Comment importer une liste Excel/CSV ?</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Dans « Élèves », cliquez sur « Télécharger le modèle » et ouvrez-le dans Excel.</li>
          <li>Remplissez vos élèves. <strong>Attention :</strong> le nom de la classe doit être écrit exactement comme dans EcoGès (ex: "CM2 A").</li>
          <li>Revenez sur EcoGès, cliquez sur « Importer » et choisissez votre fichier.</li>
        </ol>
      </Section>

      {/* 3. Argent */}
      <Section title="3. Gérer l'argent (Écolage et Paiements)" icon={<CheckCircle />}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Comment enregistrer un paiement ?</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Allez dans le menu « Argent » et cliquez sur l'onglet « Paiements ».</li>
          <li>Cliquez sur « Enregistrer un paiement ».</li>
          <li>Choisissez l'élève, le montant, la tranche et le mode (Espèces, Mobile Money).</li>
          <li>Validez. Le reçu est prêt à être imprimé.</li>
        </ol>

        <p style={{ marginTop: 16, fontWeight: 700 }}>Comment voir qui n'a pas payé ?</p>
        <p style={{ color: 'var(--muted)' }}>
          Allez dans le menu « Recouvrement ». Les élèves « À relancer » apparaissent en rouge, ceux « À jour » en vert. Utilisez les filtres pour voir uniquement les retards.
        </p>
      </Section>

      {/* 4. Notes */}
      <Section title="4. Notes et Bulletins" icon={<CheckCircle />}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Comment saisir une note ?</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Allez dans « Notes » et cliquez sur « Saisir une note ».</li>
          <li>Choisissez la classe, l'élève, la matière et le type (Interrogation, Devoir, Examen).</li>
          <li>Tapez la note et validez.</li>
        </ol>

        <p style={{ marginTop: 16, fontWeight: 700 }}>Comment imprimer un bulletin ?</p>
        <p style={{ color: 'var(--muted)' }}>
          Allez dans « Bulletins », sélectionnez la classe, l'élève et le trimestre. La moyenne et le rang se calculent automatiquement. Cliquez sur « Imprimer / PDF ».
        </p>
      </Section>

      {/* 5. Portail Parents */}
      <Section title="5. Le Portail Parents" icon={<CheckCircle />}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Comment créer un accès pour un parent ?</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Allez dans « Comptes » puis l'onglet « Accès parents ».</li>
          <li>Cliquez sur « Nouvel accès parent ». Renseignez son nom et cochez ses enfants.</li>
          <li>Un code unique (ex: K7QM4X2P) est généré. Copiez-le et envoyez-le au parent.</li>
        </ol>
        <p style={{ marginTop: 12, color: 'var(--muted)' }}>
          Le parent n'a pas besoin de mot de passe. Il va sur la page d'accueil de votre site, clique sur "Espace parent" et tape son code pour voir les notes, absences et soldes de son enfant.
        </p>
      </Section>

      {/* 6. Année Scolaire */}
      <Section title="6. Passer à l'année suivante" icon={<CheckCircle />}>
        <p style={{ marginTop: 0 }}>En fin d'année scolaire, voici comment préparer la rentrée suivante :</p>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Allez dans « Paramètres » > « Année scolaire ».</li>
          <li>Cliquez sur « Préparer la prochaine année ».</li>
          <li>EcoGès vous proposera de faire « Passer » ou « Redoubler » chaque élève. Vous pouvez ajuster.</li>
          <li>Une fois prêt, cliquez sur « Activer l'année ». L'ancienne année reste consultable en historique.</li>
        </ol>
      </Section>

      {/* 7. Support */}
      <Section title="7. Besoin d'aide supplémentaire ?" icon={<CheckCircle />}>
        <p style={{ marginTop: 0 }}>Si vous ne trouvez pas la réponse à votre question, notre équipe est là pour vous aider.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <a href={waLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13.5 }}>
            <i className="ti ti-brand-whatsapp" style={{ fontSize: 16 }} aria-hidden="true"></i>
            Discuter sur WhatsApp
          </a>
          <a href={supportMailLink('Demande d\'aide EcoGès')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', textDecoration: 'none', fontWeight: 600, fontSize: 13.5 }}>
            <i className="ti ti-mail" style={{ fontSize: 16 }} aria-hidden="true"></i>
            Envoyer un email
          </a>
        </div>
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
          Support disponible du lundi au samedi, de 8h à 19h. {SUPPORT_WHATSAPP_DISPLAY}
        </p>
      </Section>

    </div>
  );
}
