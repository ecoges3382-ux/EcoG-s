import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_EMAIL, supportWhatsappLink, supportMailLink } from '../lib/utils.js';

// Page d'accueil publique — affichée à la racine du domaine pour tout
// visiteur non connecté (voir App.jsx → RequireAuth). Avant cette page,
// eco-ges.vercel.app tombait directement sur l'écran de connexion, sans
// rien expliquer de l'application. L'inscription d'une école (SignUp.jsx)
// exige un code à usage unique généré depuis PlatformAdmin.jsx : un
// visiteur ne peut donc pas s'inscrire seul, d'où l'appel à l'action
// principal qui pointe vers un contact (WhatsApp/e-mail) plutôt que vers
// /inscription directement.
const WHATSAPP_DISPLAY = SUPPORT_WHATSAPP_DISPLAY;
const CONTACT_EMAIL = SUPPORT_EMAIL;
const whatsappLink = supportWhatsappLink;
const mailLink = supportMailLink;

// Anime l'entrée en vue (fade + léger déplacement vers le haut) une seule
// fois par élément, via IntersectionObserver — pas de dépendance externe
// (pas de framer-motion) pour une seule page. Respecte
// prefers-reduced-motion via la règle CSS correspondante dans styles.css.
function Reveal({ children, className = '', delay = 0, style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  { icon: 'ti-users', title: 'Élèves & inscriptions', text: 'Fiches élèves, inscriptions par année scolaire, historique conservé, passage de classe automatisé.' },
  { icon: 'ti-cash', title: 'Écolage & paiements', text: 'Grille tarifaire par tranche, suivi des paiements, relances automatiques et gestion des moratoires.' },
  { icon: 'ti-briefcase', title: 'Personnel & salaires', text: 'Dossiers du personnel, salaires versés, avances sur salaire, tout au même endroit.' },
  { icon: 'ti-certificate', title: 'Notes & bulletins', text: 'Saisie des notes, moyennes, rangs, bulletins prêts à imprimer.' },
  { icon: 'ti-calendar-check', title: 'Présences', text: 'Présences, absences, retards — statistiques par élève et par période.' },
  { icon: 'ti-speakerphone', title: 'Communication', text: 'Annonces aux parents : brouillon, publication, archivage.' },
  { icon: 'ti-device-mobile', title: 'Portail parents', text: 'Chaque parent suit en ligne le bulletin, les présences et les finances de son enfant.' },
  { icon: 'ti-brand-whatsapp', title: 'WhatsApp intégré', text: 'Codes d’accès parents et rappels de paiement envoyés directement sur WhatsApp.' },
];

const STEPS = [
  { n: '1', title: 'Contactez-nous', text: 'Écrivez-nous sur WhatsApp ou par e-mail pour présenter votre école.' },
  { n: '2', title: 'Recevez votre code', text: 'Nous créons votre espace et vous envoyons un code d’inscription à usage unique.' },
  { n: '3', title: 'Configurez et démarrez', text: 'Créez votre compte fondateur, invitez votre équipe, importez vos élèves — c’est parti.' },
];

function Logo({ size = 40, radius = 11, fontSize = 15 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius, background: 'var(--forest-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif)', fontWeight: 700, fontSize, color: '#fff', flexShrink: 0,
      }}
    >
      EG
    </div>
  );
}

function PrimaryButton({ href, children, style = {}, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`landing-btn ${className}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--forest-dark)', color: '#fff',
        border: 'none', fontWeight: 600, fontSize: 14.5, padding: '13px 22px', borderRadius: 'var(--radius)',
        textDecoration: 'none', ...style,
      }}
    >
      {children}
    </a>
  );
}

function SecondaryButton({ to, children, style = {} }) {
  return (
    <Link
      to={to}
      className="landing-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--paper)', color: 'var(--ink)',
        border: '2px solid var(--ink)', fontWeight: 600, fontSize: 14.5, padding: '11px 20px', borderRadius: 'var(--radius)',
        textDecoration: 'none', ...style,
      }}
    >
      {children}
    </Link>
  );
}

// Aperçu abstrait de l'application (squelette animé) plutôt qu'une capture
// d'écran ou des chiffres inventés : les libellés correspondent à de vrais
// modules du produit (voir Dashboard.jsx), mais aucune donnée/statistique
// n'est présentée comme réelle.
function ProductPreview() {
  const stats = [
    { icon: 'ti-users', label: 'Élèves' },
    { icon: 'ti-cash', label: 'Écolage' },
    { icon: 'ti-calendar-check', label: 'Présences' },
    { icon: 'ti-briefcase', label: 'Personnel' },
  ];
  return (
    <div className="card-bold" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,76,58,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--cream)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--clay)' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--forest)' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>app.eco-ges.vercel.app</span>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }} className="desktop-grid-4">
          {stats.map((s) => (
            <div key={s.label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 8px' }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 16, color: 'var(--forest)' }} aria-hidden="true" />
              <p style={{ margin: '6px 0 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</p>
              <div className="landing-skeleton" style={{ height: 8, width: '70%' }} />
            </div>
          ))}
        </div>
        {[100, 82, 91, 64].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--forest-light)', flexShrink: 0 }} />
            <div className="landing-skeleton" style={{ height: 8, width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* ---- Nav ---- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(250,248,244,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={36} radius={10} fontSize={13} />
            <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>EcoGès</span>
          </div>
          <nav className="landing-nav-links" style={{ alignItems: 'center', gap: 26 }}>
            <a href="#fonctionnalites" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Fonctionnalités</a>
            <a href="#comment-ca-marche" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Comment ça marche</a>
            <a href="#tarifs" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Tarifs</a>
          </nav>
          <Link to="/connexion" style={{ color: 'var(--forest-dark)', textDecoration: 'none', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Se connecter →
          </Link>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section style={{ position: 'relative', padding: '72px 20px 56px', overflow: 'hidden' }}>
        <div className="landing-blob" style={{ width: 360, height: 360, top: -120, right: -100, background: 'var(--forest)' }} />
        <div className="landing-blob" style={{ width: 300, height: 300, bottom: -140, left: -100, background: 'var(--gold)', animationDelay: '3s' }} />
        <div style={{ maxWidth: 1180, margin: '0 auto', position: 'relative', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }} className="desktop-grid-2">
          <div>
            <p className="landing-fade-up" style={{ display: 'inline-block', margin: '0 0 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--forest-dark)', background: 'var(--forest-light)', padding: '6px 12px', borderRadius: 20, letterSpacing: '0.02em' }}>
              Conçu pour les écoles privées d’Afrique de l’Ouest
            </p>
            <h1 className="landing-hero-title landing-fade-up" style={{ animationDelay: '0.08s', margin: '0 0 18px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 46, lineHeight: 1.12, color: 'var(--ink)' }}>
              La gestion scolaire, enfin simple.
            </h1>
            <p className="landing-hero-sub landing-fade-up" style={{ animationDelay: '0.16s', margin: '0 0 30px', fontSize: 17, lineHeight: 1.65, color: 'var(--muted)', maxWidth: 480 }}>
              Élèves, écolage, personnel, bulletins, présences et communication avec
              les parents : EcoGès réunit toute la gestion de votre école dans un
              seul outil, pensé pour le terrain.
            </p>
            <div className="landing-fade-up" style={{ animationDelay: '0.24s', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <PrimaryButton
                href={whatsappLink('Bonjour, je souhaite en savoir plus sur EcoGès pour mon école.')}
                className="landing-pulse-cta"
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 18 }} aria-hidden="true" />
                Demander un accès
              </PrimaryButton>
              <SecondaryButton to="/inscription">J’ai déjà un code d’invitation</SecondaryButton>
            </div>
          </div>
          {/* Au-dessus de la ligne de flottaison : entrée en fondu synchronisée
              avec le texte du hero (même mécanisme .landing-fade-up), pas
              d'attente de défilement comme le reste de la page — c'est la
              toute première chose que la visiteuse doit voir bouger. */}
          <div className="landing-fade-up" style={{ animationDelay: '0.32s' }}>
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ---- Fonctionnalités ---- */}
      <section id="fonctionnalites" style={{ padding: '64px 20px', maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: 'var(--clay-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fonctionnalités</p>
          <h2 style={{ margin: '0 0 40px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 30, color: 'var(--ink)', maxWidth: 560 }}>
            Tout ce qu’il faut pour piloter une école, sans jongler entre dix outils.
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="desktop-grid-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 80}>
              <div className="card landing-feature-card" style={{ padding: 20, height: '100%' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <i className={`ti ${f.icon}`} style={{ fontSize: 19, color: 'var(--forest-dark)' }} aria-hidden="true" />
                </div>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{f.title}</p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Comment ça marche ---- */}
      <section id="comment-ca-marche" style={{ padding: '64px 20px', background: 'var(--forest-dark)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Reveal>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Comment ça marche</p>
            <h2 style={{ margin: '0 0 48px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 30, color: '#fff', maxWidth: 560 }}>
              Trois étapes pour démarrer.
            </h2>
          </Reveal>
          <div style={{ position: 'relative' }}>
            <Reveal className="landing-reveal-line" style={{ position: 'absolute', top: 22, left: '16.5%', right: '16.5%', height: 2 }}>
              <div className="landing-line-fill" style={{ height: '100%', background: 'rgba(255,255,255,0.25)' }} />
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative' }} className="desktop-grid-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 120}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gold)', color: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, margin: '0 auto 18px', fontFamily: 'var(--serif)' }}>
                      {s.n}
                    </div>
                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 16, color: '#fff' }}>{s.title}</p>
                    <p style={{ margin: '0 auto', fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', maxWidth: 260 }}>{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Tarifs ---- */}
      <section id="tarifs" style={{ padding: '64px 20px', maxWidth: 780, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: 'var(--clay-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tarifs</p>
          <h2 style={{ margin: '0 0 28px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 30, color: 'var(--ink)' }}>
            Un tarif adapté à votre école.
          </h2>
          <div className="card-bold" style={{ padding: '36px 28px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>Sur devis</p>
            <p style={{ margin: '0 auto 26px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--muted)', maxWidth: 460 }}>
              Le tarif dépend de la taille et des besoins de votre école. Écrivez-nous
              pour recevoir un devis personnalisé, sans engagement.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <PrimaryButton href={whatsappLink('Bonjour, je souhaite recevoir un devis pour EcoGès.')}>
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 18 }} aria-hidden="true" />
                Demander un devis
              </PrimaryButton>
              <a
                href={mailLink('Demande de devis EcoGès')}
                className="landing-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--paper)', color: 'var(--ink)', border: '2px solid var(--ink)', fontWeight: 600, fontSize: 14.5, padding: '11px 20px', borderRadius: 'var(--radius)', textDecoration: 'none' }}
              >
                <i className="ti ti-mail" style={{ fontSize: 17 }} aria-hidden="true" />
                Nous écrire
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- CTA finale ---- */}
      <section style={{ padding: '56px 20px 72px', maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <div style={{ background: 'var(--forest)', borderRadius: 20, padding: '44px 32px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 26, color: '#fff' }}>
              Prêt·e à moderniser la gestion de votre école ?
            </h2>
            <p style={{ margin: '0 0 26px', fontSize: 14.5, color: 'rgba(255,255,255,0.82)' }}>
              Réponse rapide sur WhatsApp — {WHATSAPP_DISPLAY}
            </p>
            <PrimaryButton
              href={whatsappLink('Bonjour, je souhaite en savoir plus sur EcoGès pour mon école.')}
              style={{ background: '#fff', color: 'var(--forest-dark)' }}
            >
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 18 }} aria-hidden="true" />
              Discuter sur WhatsApp
            </PrimaryButton>
          </div>
        </Reveal>
      </section>

      {/* ---- Footer ---- */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 20px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={28} radius={8} fontSize={11} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>© {new Date().getFullYear()} EcoGès</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <a href={mailLink('Contact EcoGès')} style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>{CONTACT_EMAIL}</a>
            <a href={whatsappLink('Bonjour, je souhaite en savoir plus sur EcoGès pour mon école.')} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>{WHATSAPP_DISPLAY}</a>
            <Link to="/connexion" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>Se connecter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
