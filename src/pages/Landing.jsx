import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_EMAIL, supportWhatsappLink, supportMailLink } from '../lib/utils.js';
import './Landing.css';

// Page d'accueil publique, affichée à la racine pour tout visiteur non
// connecté (voir App.jsx). L'inscription d'une école exige un code à usage
// unique (SignUp.jsx) : l'appel à l'action principal mène donc à un contact
// WhatsApp, pas à /inscription. Les écrans de l'application montrés ici sont
// des maquettes animées avec des données d'exemple, signalées comme telles :
// aucun chiffre n'est présenté comme une statistique réelle.

const WA_HELLO = supportWhatsappLink('Bonjour, je souhaite en savoir plus sur EcoGès pour mon école.');
const WA_QUOTE = supportWhatsappLink('Bonjour, je souhaite recevoir un devis pour EcoGès.');

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function fmtNum(n, decimals = 0) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Pose .is-in sur le conteneur la première fois qu'il entre à l'écran ; tout
// le CSS de Landing.css part de cette classe.
function InView({ as: Tag = 'div', className = '', threshold = 0.25, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <Tag ref={ref} className={`${className} ${inView ? 'is-in' : ''}`} {...rest}>
      {typeof children === 'function' ? children(inView) : children}
    </Tag>
  );
}

function CountUp({ to, start, duration = 1700, delay = 0, decimals = 0 }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return undefined;
    if (prefersReducedMotion()) { setValue(to); return undefined; }
    let raf;
    let t0;
    const timer = setTimeout(() => {
      const step = (ts) => {
        if (t0 === undefined) t0 = ts;
        const p = Math.min(1, (ts - t0) / duration);
        setValue(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [start, to, duration, delay]);
  return fmtNum(value, decimals);
}

// Titre découpé mot par mot, chaque mot remonte derrière un masque.
function Words({ text, startDelay = 0, step = 70 }) {
  return text.split(' ').map((w, i) => (
    <span key={i}>
      <span className="lp-mask"><span style={{ '--d': `${startDelay + i * step}ms` }}>{w}</span></span>
      {' '}
    </span>
  ));
}

// ---------- Icônes (tracés SVG : la police d'icônes n'est pas fiable en prod) ----------
function Svg({ size = 20, children, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}
const I = {
  check: (s) => <Svg size={s} stroke={2.6}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>,
  x: (s) => <Svg size={s} stroke={2.6}><path d="M6 6l12 12M18 6L6 18" /></Svg>,
  whatsapp: (s) => (
    <Svg size={s}>
      <path d="M12 3a9 9 0 0 0-7.8 13.4L3 21l4.7-1.2A9 9 0 1 0 12 3z" />
      <path d="M9 8.6c.3 2.9 2.9 5.9 6.2 6.6l1.1-1.4-1.9-1-.9.8c-1.2-.5-2.3-1.6-2.8-2.8l.8-.9-1-1.9L9 8.6z" />
    </Svg>
  ),
  mail: (s) => <Svg size={s}><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="M3 6.5l9 6.5 9-6.5" /></Svg>,
  arrow: (s) => <Svg size={s} stroke={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>,
  users: (s) => <Svg size={s}><circle cx="8" cy="8" r="3.2" /><path d="M2.5 19c0-3.3 2.9-5.7 5.5-5.7s5.5 2.4 5.5 5.7" /><circle cx="16.5" cy="8.5" r="2.3" /><path d="M15 13.3c2.3.2 4 2.3 4.2 4.5" /></Svg>,
  briefcase: (s) => <Svg size={s}><rect x="3" y="8" width="18" height="11" rx="1.6" /><path d="M8.5 8V6.2c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6V8M3 13h18" /></Svg>,
  clock: (s) => <Svg size={s}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4M8 13h3M8 16.5h6" /></Svg>,
  speaker: (s) => <Svg size={s}><path d="M3 9v6h3l7 4V5L6 9H3z" /><path d="M16 9.5c1 .8 1 3.2 0 4M18.5 7.5c2 1.8 2 6.2 0 8" /></Svg>,
  folder: (s) => <Svg size={s}><path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8H12l-2-2.5H4.5A1.5 1.5 0 0 0 3 7z" /></Svg>,
  chart: (s) => <Svg size={s}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>,
  stairs: (s) => <Svg size={s}><path d="M3 20h5v-5h5v-5h5V5h3" /><path d="M14 4h7v7" /></Svg>,
  shield: (s) => <Svg size={s}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></Svg>,
  money: (s) => <Svg size={s}><rect x="2.5" y="6" width="19" height="12" rx="1.8" /><circle cx="12" cy="12" r="2.5" /></Svg>,
  doc: (s) => <Svg size={s}><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>,
};

// ---------- Navigation + barre de progression ----------
function Nav() {
  const [solid, setSolid] = useState(false);
  const barRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        setSolid(y > 40);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={barRef} className="lp-progress" />
      <header className={`lp-nav ${solid ? 'is-solid' : ''}`}>
        <div className="lp-wrap lp-nav-inner">
          <a href="#top" className="lp-brand" aria-label="EcoGès, retour en haut">
            <span className="lp-brand-mark">EG</span>
            <span className="lp-brand-name">Eco<b>Gès</b></span>
          </a>
          <nav className="lp-nav-links">
            <a href="#fonctions">Fonctions</a>
            <a href="#terrain">Pensé pour le terrain</a>
            <a href="#demarrer">Démarrer</a>
            <a href="#tarifs">Tarifs</a>
          </nav>
          <Link to="/connexion" className="lp-login">Se connecter</Link>
        </div>
      </header>
    </>
  );
}

// ---------- Hero ----------
const SPARKS = [
  [8, 12, 0], [18, 40, 2.4], [27, 8, 5.1], [36, 30, 1.2], [44, 5, 6.3], [52, 22, 3.6], [61, 10, 0.8],
  [70, 34, 4.4], [78, 14, 2], [86, 26, 5.8], [93, 6, 3.1], [14, 60, 7], [58, 50, 7.8], [82, 56, 1.6],
];

function PhoneMock() {
  const bars = [38, 52, 46, 64, 58, 86];
  const pays = [
    { i: 'AK', n: 'Aïcha K.', c: 'CM2 · 3e tranche', m: '25.000 F', bg: '#FBEADE', fg: '#8F4620' },
    { i: 'KM', n: 'Koffi M.', c: '6e A · 2e tranche', m: '40.000 F', bg: '#E4EEE9', fg: '#0F4C3A' },
    { i: 'GA', n: 'Grâce A.', c: 'CE1 · 1re tranche', m: '15.000 F', bg: '#FBF1DD', fg: '#A5680E' },
    { i: 'YD', n: 'Yao D.', c: 'CP · 2e tranche', m: '20.000 F', bg: '#E4EEE9', fg: '#0F4C3A' },
  ];
  return (
    <div className="lp-phone">
      <div className="lp-screen">
        <div className="lp-notch" />
        <div className="lp-sb"><span>9:41</span><span>●●● 4G</span></div>
        <div className="lp-app-head">
          <small>Complexe scolaire Les Palmiers</small>
          <p>Tableau de bord</p>
        </div>
        <InView className="lp-app-body" threshold={0.1}>
          {(inView) => (
            <>
              <div className="lp-card">
                <div className="lp-kpi-label">Encaissé ce mois</div>
                <div className="lp-kpi-val"><CountUp to={4850000} start={inView} delay={900} duration={2200} /><small>F CFA</small></div>
              </div>
              <div className="lp-row2">
                <div className="lp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div className="lp-kpi-label">Recouvrement</div>
                  <div style={{ position: 'relative' }}>
                    <svg className="lp-ring" viewBox="0 0 64 64"><circle className="t" cx="32" cy="32" r="28" /><circle className="v" cx="32" cy="32" r="28" /></svg>
                    <b style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'var(--serif)' }}>
                      <CountUp to={78} start={inView} delay={1200} duration={1800} />%
                    </b>
                  </div>
                </div>
                <div className="lp-card">
                  <div className="lp-kpi-label">Paiements</div>
                  <div className="lp-bars">
                    {bars.map((h, i) => <i key={i} style={{ height: `${h}%`, transitionDelay: `${1100 + i * 110}ms` }} />)}
                  </div>
                </div>
              </div>
              <div className="lp-card" style={{ paddingTop: 10, paddingBottom: 6 }}>
                <div className="lp-kpi-label" style={{ marginBottom: 4 }}>Derniers paiements</div>
                {pays.map((p, i) => (
                  <div className="lp-pay" key={p.n} style={{ transitionDelay: `${1700 + i * 260}ms` }}>
                    <span className="lp-avatar" style={{ background: p.bg, color: p.fg }}>{p.i}</span>
                    <div><b>{p.n}</b><span>{p.c}</span></div>
                    <em>+{p.m}</em>
                  </div>
                ))}
              </div>
            </>
          )}
        </InView>
        <div className="lp-tabbar">
          {['Accueil', 'Argent', 'École', 'Comptes'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}><i />{t}</span>)}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const [ready, setReady] = useState(false);
  const stageRef = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(timer);
  }, []);

  function onMove(e) {
    if (!stageRef.current || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    stageRef.current.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3) * 2);
    stageRef.current.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3) * 2);
  }
  function onLeave() {
    stageRef.current?.style.setProperty('--mx', 0);
    stageRef.current?.style.setProperty('--my', 0);
  }

  return (
    <section id="top" className={`lp-hero ${ready ? 'is-in' : ''}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="lp-aurora lp-aurora-1" />
      <div className="lp-aurora lp-aurora-2" />
      <div className="lp-aurora lp-aurora-3" />
      <div className="lp-gridlines" />
      {SPARKS.map(([x, y, d], i) => <span key={i} className="lp-spark" style={{ left: `${x}%`, bottom: `${y}%`, animationDelay: `${d}s` }} />)}
      <div className="lp-grain" />

      <div className="lp-wrap lp-hero-grid">
        <div>
          <div className="lp-reveal" style={{ '--d': '0ms' }}>
            <span className="lp-chip"><span className="lp-live" />Pour les écoles privées d’Afrique de l’Ouest</span>
          </div>
          <h1 className="lp-h1">
            <span className="lp-h1-line"><Words text="Toute votre école." startDelay={120} /></span>
            <br />
            <span className="lp-underline lp-gold lp-h1-line">
              <Words text="Dans votre poche." startDelay={380} />
              <svg viewBox="0 0 400 24" preserveAspectRatio="none"><path d="M4 16 C 90 4, 190 4, 250 12 S 360 20, 396 8" /></svg>
            </span>
          </h1>
          <p className="lp-lead lp-reveal" style={{ '--d': '700ms' }}>
            Élèves, écolage, bulletins, présences, personnel et parents : <strong>EcoGès remplace les cahiers,
            les fichiers Excel et les calculs à la main</strong> par une seule application, claire et rapide.
          </p>
          <div className="lp-ctas lp-reveal" style={{ '--d': '850ms' }}>
            <a className="lp-btn lp-btn-gold" href={WA_HELLO} target="_blank" rel="noreferrer">{I.whatsapp(20)}Demander un accès</a>
            <Link className="lp-btn lp-btn-ghost" to="/inscription">J’ai un code d’invitation{I.arrow(18)}</Link>
          </div>
          <ul className="lp-checks lp-reveal" style={{ '--d': '1000ms' }}>
            <li>{I.check(16)}Aucune installation</li>
            <li>{I.check(16)}Téléphone et ordinateur</li>
            <li>{I.check(16)}Chaque école a son espace sécurisé</li>
          </ul>
        </div>

        <div className="lp-stage" ref={stageRef}>
          <div className="lp-orbit lp-orbit-2" />
          <div className="lp-orbit lp-orbit-1" />
          <div className="lp-glow" />
          <div className="lp-par lp-par-phone">
            <div className="lp-phone-in">
              <div className="lp-phone-float"><PhoneMock /></div>
            </div>
          </div>
          <div className="lp-par lp-par-1" style={{ position: 'absolute', inset: 0 }}>
            <div className="lp-notif n1" style={{ '--d': '1.6s' }}>
              <span className="lp-notif-ico" style={{ background: 'var(--success)' }}>{I.check(18)}</span>
              <div><b>Paiement reçu</b><span>Aïcha K. · 25.000 F CFA</span></div>
            </div>
            <div className="lp-notif n3" style={{ '--d': '8.6s' }}>
              <span className="lp-notif-ico" style={{ background: 'var(--lp-gold)' }}>{I.doc(18)}</span>
              <div><b>Bulletins prêts</b><span>CM2 · 1er trimestre</span></div>
            </div>
          </div>
          <div className="lp-par lp-par-2" style={{ position: 'absolute', inset: 0 }}>
            <div className="lp-notif n2" style={{ '--d': '5.1s' }}>
              <span className="lp-notif-ico" style={{ background: '#25D366' }}>{I.whatsapp(18)}</span>
              <div><b>Rappels envoyés</b><span>42 parents · échéance du 15 mars</span></div>
            </div>
          </div>
          <p className="lp-stage-note">Aperçu illustratif · données d’exemple</p>
        </div>
      </div>
      <div className="lp-scroll-cue" aria-hidden="true" />
    </section>
  );
}

function Bands() {
  const a = ['Élèves', 'Écolage', 'Bulletins', 'Présences', 'Personnel', 'Salaires', 'Portail parents', 'WhatsApp'];
  const b = ['Emploi du temps', 'Annonces', 'Rapports', 'Documents', 'Relances', 'Moratoires', 'Inscriptions', 'Reçus'];
  const row = (items) => [...items, ...items, ...items, ...items].map((t, i) => <span key={i}>{t}</span>);
  return (
    <div className="lp-bands" aria-hidden="true">
      <div className="lp-band lp-band-2"><div className="lp-track">{row(b)}</div></div>
      <div className="lp-band lp-band-1"><div className="lp-track">{row(a)}</div></div>
    </div>
  );
}

// ---------- Avant / après ----------
const GONE = [
  'Les cahiers de caisse raturés',
  'Les moyennes calculées à la main',
  'Les parents qui appellent pour connaître le solde',
  'Les fichiers Excel introuvables',
];

function Gone() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <InView threshold={0.3}>
          <p className="lp-eyebrow lp-reveal">Avant / après</p>
          <h2 className="lp-h2"><Words text="Ce qu’EcoGès fait disparaître." step={60} /></h2>
        </InView>
        <InView as="ul" className="lp-gone" threshold={0.35}>
          {GONE.map((g, i) => (
            <li key={g} style={{ '--d': `${i * 280}ms` }}>
              <span className="n">0{i + 1}</span>
              <span className="txt"><span className="strike">{g}</span></span>
              <span className="x">{I.x(15)}</span>
            </li>
          ))}
        </InView>
        <InView className="lp-after" threshold={0.6}>
          <span className="lp-reveal">Place à une gestion <em>claire, en temps réel.</em></span>
        </InView>
      </div>
    </section>
  );
}

// ---------- Scènes ----------
function SceneText({ n, title, text, bullets }) {
  return (
    <InView threshold={0.3}>
      <div className="lp-num lp-reveal">{n}</div>
      <h3 className="lp-h3 lp-reveal" style={{ '--d': '80ms' }}>{title}</h3>
      <p className="lp-sub lp-reveal" style={{ '--d': '160ms' }}>{text}</p>
      <ul className="lp-bullets">
        {bullets.map((b, i) => <li key={b} className="lp-reveal" style={{ '--d': `${260 + i * 90}ms` }}><i>{I.check(13)}</i>{b}</li>)}
      </ul>
    </InView>
  );
}

function ArtEcolage() {
  const tranches = [
    { t: '1re tranche', m: '40.000 F', w: 1 },
    { t: '2e tranche', m: '35.000 F', w: 1 },
    { t: '3e tranche', m: '5.000 / 30.000 F', w: 0.17, part: true },
  ];
  return (
    <InView className="lp-scene-art" threshold={0.35}>
      <div className="lp-art-bg c" />
      <div className="lp-art-card lp-pop">
        <div className="lp-stu">
          <span className="lp-avatar" style={{ background: '#FBEADE', color: '#8F4620' }}>AK</span>
          <div><b>Aïcha Konaté</b><span>CM2 · Année 2025-2026</span></div>
        </div>
        {tranches.map((t, i) => (
          <div className="lp-tr" key={t.t}>
            <div className="lp-tr-top"><span>{t.t}</span><span>{t.m}</span></div>
            <div className="lp-meter"><i className={t.part ? 'part' : ''} style={{ '--w': t.w, '--d': `${500 + i * 350}ms` }} /></div>
          </div>
        ))}
        <div className="lp-solde">
          <div><span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Reste à payer</span><br /><b>25.000 F CFA</b></div>
          <span className="lp-badge r">● À relancer</span>
        </div>
      </div>
      <div className="lp-float-chip lp-pop lp-bob" style={{ right: '6%', bottom: '2%', '--d': '1900ms' }}>
        <span className="dot">{I.whatsapp(15)}</span>Relance envoyée au parent
      </div>
    </InView>
  );
}

function ArtBulletin() {
  const grades = [['Mathématiques', 4, '15,50'], ['Français', 3, '13,00'], ['SVT', 2, '14,00'], ['Anglais', 2, '16,00']];
  return (
    <InView className="lp-scene-art" threshold={0.35}>
      {(inView) => (
        <>
          <div className="lp-art-bg l" />
          <div className="lp-art-card lp-pop">
            <span className="lp-stamp">Prêt à imprimer</span>
            <div className="lp-bul-head">
              <div><b>Bulletin de notes</b><span>1er trimestre · Koffi Mensah · 6e A</span></div>
            </div>
            {grades.map(([m, c, n], i) => (
              <div className="lp-grade" key={m} style={{ '--d': `${400 + i * 180}ms` }}>
                <span>{m}</span><span className="co">coef. {c}</span><span className="nt">{n}</span>
              </div>
            ))}
            <div className="lp-moy">
              <div><small>Moyenne</small><br /><b><CountUp to={14.64} decimals={2} start={inView} delay={1200} duration={1300} /></b></div>
              <div className="lp-rank">Rang<br /><span style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>3<sup>e</sup></span> / 32</div>
            </div>
          </div>
        </>
      )}
    </InView>
  );
}

// p : présent, r : retard, a : absent. Retard compté comme présent.
const ATT = ['ppppp', 'pprpp', 'ppppa', 'ppppp'];
function ArtPresences() {
  const cells = ATT.join('');
  const rate = Math.round((cells.split('').filter((c) => c !== 'a').length / cells.length) * 100);
  return (
    <InView className="lp-scene-art" threshold={0.35}>
      {(inView) => (
        <>
          <div className="lp-art-bg c" />
          <div className="lp-art-card lp-pop">
            <div className="lp-att-head">
              <div><b>Présences</b><span>Aïcha Konaté · février</span></div>
              <div className="lp-att-big"><CountUp to={rate} start={inView} delay={1400} duration={1200} /> %</div>
            </div>
            <div className="lp-att-grid">
              <span />
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d) => <span key={d} className="h">{d}</span>)}
              {ATT.map((week, w) => (
                <FragmentRow key={w} label={`S${w + 1}`} week={week} w={w} />
              ))}
            </div>
            <div className="lp-legend">
              <span><i style={{ background: 'var(--lp-green)' }} />Présent</span>
              <span><i style={{ background: 'var(--lp-gold)' }} />Retard</span>
              <span><i style={{ background: 'var(--clay)' }} />Absent</span>
            </div>
          </div>
        </>
      )}
    </InView>
  );
}
function FragmentRow({ label, week, w }) {
  return (
    <>
      <span className="w">{label}</span>
      {week.split('').map((c, d) => (
        <span key={d} className={`lp-cell ${c}`} style={{ '--d': `${400 + (w * 5 + d) * 45}ms` }}>
          {c === 'p' ? I.check(12) : c === 'a' ? I.x(11) : null}
        </span>
      ))}
    </>
  );
}

function ArtWhatsApp() {
  return (
    <InView className="lp-scene-art" threshold={0.35}>
      <div className="lp-art-bg w" />
      <div className="lp-chat lp-pop">
        <div className="lp-chat-head">
          <span className="lp-avatar">LP</span>
          <div><b>Complexe scolaire Les Palmiers</b><span>en ligne</span></div>
        </div>
        <div className="lp-chat-body">
          <div className="lp-msg in" style={{ '--d': '500ms' }}>
            Bonjour M. Konaté, la 3e tranche de l’écolage d’Aïcha (25.000 F CFA) arrive à échéance le 15 mars.<time>08:02</time>
          </div>
          <div className="lp-msg out" style={{ '--d': '1700ms' }}>Merci, je passe la régler demain.<time>08:15</time></div>
          <div className="lp-typing" style={{ '--d': '2500ms' }}><i /><i /><i /></div>
          <div className="lp-msg in" style={{ '--d': '4100ms' }}>
            Pour suivre ses notes, ses présences et ses paiements en ligne, voici votre code d’accès parent : <code>K7QM4X2P</code><time>08:16</time>
          </div>
        </div>
        <div className="lp-chat-foot"><span>Message</span><i>{I.arrow(16)}</i></div>
      </div>
    </InView>
  );
}

const SCENES = [
  {
    n: '01 · Écolage',
    title: 'Chaque franc suivi. Chaque retard repéré.',
    text: 'Grille tarifaire par tranche, paiements enregistrés en quelques secondes, soldes calculés tout seuls. EcoGès vous montre qui relancer, et quand.',
    bullets: ['Tranches et échéances configurables', 'Moratoires pour les familles en difficulté', 'Reçus et historique complet par élève'],
    Art: ArtEcolage,
  },
  {
    n: '02 · Bulletins',
    title: 'Des bulletins prêts, sans nuit blanche.',
    text: 'Vous saisissez les notes, EcoGès calcule les moyennes avec les coefficients et classe les élèves. Fini les erreurs de calcul en fin de trimestre.',
    bullets: ['Coefficients par matière', 'Moyennes et rangs automatiques', 'Bulletins prêts à imprimer'],
    Art: ArtBulletin,
  },
  {
    n: '03 · Présences',
    title: 'L’appel en quelques secondes.',
    text: 'Présences, absences et retards notés depuis un téléphone, directement en classe. Les statistiques par élève et par période se construisent toutes seules.',
    bullets: ['Appel rapide sur téléphone', 'Absences et retards distingués', 'Taux de présence par élève et par classe'],
    Art: ArtPresences,
  },
  {
    n: '04 · Parents & WhatsApp',
    title: 'Des parents informés, sans un seul appel.',
    text: 'Chaque parent reçoit un code pour suivre en ligne les notes, les présences et les paiements de son enfant. Rappels d’échéance et annonces partent sur WhatsApp.',
    bullets: ['Portail parent avec code personnel', 'Rappels de paiement sur WhatsApp', 'Annonces à toute l’école en un envoi'],
    Art: ArtWhatsApp,
  },
];

function Scenes() {
  return (
    <section id="fonctions" className="lp-section" style={{ paddingTop: 40, background: 'var(--paper)' }}>
      <div className="lp-wrap">
        <InView threshold={0.3} style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 20px' }}>
          <p className="lp-eyebrow lp-reveal" style={{ justifyContent: 'center' }}>Fonctions</p>
          <h2 className="lp-h2"><Words text="Tout ce qui fait tourner une école." step={55} /></h2>
          <p className="lp-sub lp-reveal" style={{ margin: '0 auto', '--d': '400ms' }}>Quatre moments du quotidien, transformés.</p>
        </InView>
        {SCENES.map((s, i) => (
          <div key={s.n} className={`lp-scene ${i % 2 ? 'flip' : ''}`}>
            <SceneText {...s} />
            <s.Art />
          </div>
        ))}
      </div>
    </section>
  );
}

const MODS = [
  { icon: I.users, t: 'Élèves & inscriptions', p: 'Fiches complètes, inscriptions par année, import depuis un fichier CSV.' },
  { icon: I.briefcase, t: 'Personnel & salaires', p: 'Dossiers du personnel, salaires versés et avances sur salaire.' },
  { icon: I.clock, t: 'Emploi du temps', p: 'Les cours de chaque classe, organisés par créneau.' },
  { icon: I.speaker, t: 'Annonces', p: 'Brouillon, publication, archivage : les parents sont tenus au courant.' },
  { icon: I.folder, t: 'Documents', p: 'Les documents de l’école rangés au même endroit.' },
  { icon: I.chart, t: 'Rapports & exports', p: 'Rapports financiers et exports CSV prêts à transmettre.' },
  { icon: I.stairs, t: 'Passage d’année', p: 'Passages, redoublements et départs décidés en quelques clics.' },
  { icon: I.shield, t: 'Rôles & accès', p: 'Fondateur, directeur, secrétaire, enseignant : chacun voit ce qui le concerne.' },
];

function Modules() {
  return (
    <section className="lp-section" style={{ paddingTop: 30 }}>
      <div className="lp-wrap">
        <InView threshold={0.3}>
          <p className="lp-eyebrow lp-reveal">Et aussi</p>
          <h2 className="lp-h2" style={{ maxWidth: 720 }}><Words text="Un seul outil à la place de dix." step={55} /></h2>
        </InView>
        <InView className="lp-mods" threshold={0.15}>
          {MODS.map((m, i) => (
            <div key={m.t} className="lp-mod lp-reveal" style={{ '--d': `${i * 70}ms` }}>
              <div className="lp-mod-ico">{m.icon(22)}</div>
              <b>{m.t}</b>
              <p>{m.p}</p>
            </div>
          ))}
        </InView>
      </div>
    </section>
  );
}

function Terrain() {
  return (
    <section id="terrain" className="lp-section lp-dark">
      <div className="lp-aurora lp-aurora-1" style={{ opacity: 0.2 }} />
      <div className="lp-wrap" style={{ position: 'relative' }}>
        <InView threshold={0.3}>
          <p className="lp-eyebrow lp-reveal">Pensé pour le terrain</p>
          <h2 className="lp-h2" style={{ maxWidth: 760 }}><Words text="Fait pour la réalité des écoles d’ici." step={55} /></h2>
          <p className="lp-sub lp-reveal" style={{ '--d': '500ms' }}>Réseau qui coupe, téléphone plutôt qu’ordinateur, paiements en francs CFA : EcoGès a été conçu pour ce quotidien-là.</p>
        </InView>
        <InView className="lp-pillars" threshold={0.2}>
          <div className="lp-pillar lp-reveal" style={{ '--d': '0ms' }}>
            <div className="lp-pillar-ico lp-devices">
              <svg width="92" height="56" viewBox="0 0 92 56" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="6" width="58" height="36" rx="4" /><path d="M0 48h66" strokeLinecap="round" />
                <rect x="66" y="16" width="22" height="38" rx="4" fill="#06251C" /><path d="M74 49h6" strokeLinecap="round" />
              </svg>
            </div>
            <b>Téléphone ou ordinateur</b>
            <p>Aucune installation : un navigateur suffit, sur l’appareil que vous avez déjà.</p>
          </div>
          <div className="lp-pillar lp-reveal" style={{ '--d': '120ms' }}>
            <div className="lp-pillar-ico">
              <span className="lp-sig">
                {[14, 22, 30, 38].map((h, i) => <i key={h} style={{ height: h, '--d': `${i * 0.08}s` }} />)}
              </span>
              <span className="lp-sig-cache">Données gardées</span>
            </div>
            <b>Tient les coupures</b>
            <p>Si la connexion coupe, les dernières données consultées restent affichées au lieu d’un écran vide.</p>
          </div>
          <div className="lp-pillar lp-reveal" style={{ '--d': '240ms' }}>
            <div className="lp-pillar-ico">
              <svg className="lp-lock" width="48" height="56" viewBox="0 0 48 56" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 24V16a12 12 0 0 1 24 0v8" /><rect x="5" y="24" width="38" height="28" rx="6" /><path d="M24 35v7" />
              </svg>
            </div>
            <b>Chaque école dans son coffre</b>
            <p>Les données d’une école ne sont jamais visibles par une autre. Chacun ne voit que ce que son rôle permet.</p>
          </div>
          <div className="lp-pillar lp-reveal" style={{ '--d': '360ms' }}>
            <div className="lp-pillar-ico"><span className="lp-cfa">F CFA</span></div>
            <b>En français, en francs CFA</b>
            <p>Pensé pour les écoles privées du Bénin et d’Afrique de l’Ouest, avec leur façon de fonctionner.</p>
          </div>
        </InView>
      </div>
    </section>
  );
}

const STEPS = [
  { t: 'Écrivez-nous', p: 'Sur WhatsApp ou par e-mail, présentez-nous votre école en quelques mots.' },
  { t: 'Recevez votre code', p: 'Nous préparons votre espace et vous envoyons un code d’inscription à usage unique.' },
  { t: 'Lancez-vous', p: 'Créez votre compte, invitez votre équipe, importez vos élèves. C’est prêt.' },
];

function Steps() {
  return (
    <section id="demarrer" className="lp-section">
      <div className="lp-wrap">
        <InView threshold={0.3} style={{ textAlign: 'center' }}>
          <p className="lp-eyebrow lp-reveal" style={{ justifyContent: 'center' }}>Démarrer</p>
          <h2 className="lp-h2"><Words text="Trois étapes, et c’est parti." step={60} /></h2>
        </InView>
        <InView className="lp-steps" threshold={0.3}>
          <div className="lp-steps-line"><i /></div>
          {STEPS.map((s, i) => (
            <div key={s.t} className="lp-step lp-reveal" style={{ '--d': `${200 + i * 350}ms` }}>
              <div className="lp-step-n" style={{ '--d': `${500 + i * 450}ms` }}>{i + 1}</div>
              <div><b>{s.t}</b><p>{s.p}</p></div>
            </div>
          ))}
        </InView>
      </div>
    </section>
  );
}

function Price() {
  return (
    <section id="tarifs" className="lp-section" style={{ paddingTop: 20 }}>
      <div className="lp-wrap">
        <InView className="lp-price lp-reveal" threshold={0.3}>
          <p className="lp-eyebrow" style={{ justifyContent: 'center' }}>Tarifs</p>
          <div className="lp-price-big">Sur devis</div>
          <p className="lp-sub" style={{ margin: '0 auto 30px', maxWidth: 480 }}>
            Le tarif dépend de la taille et des besoins de votre école. Écrivez-nous pour recevoir un devis personnalisé, sans engagement.
          </p>
          <div className="lp-ctas" style={{ justifyContent: 'center' }}>
            <a className="lp-btn lp-btn-dark" href={WA_QUOTE} target="_blank" rel="noreferrer">{I.whatsapp(19)}Demander un devis</a>
            <a className="lp-btn lp-btn-line" href={supportMailLink('Demande de devis EcoGès')}>{I.mail(18)}Nous écrire</a>
          </div>
        </InView>
      </div>
    </section>
  );
}

function Final() {
  return (
    <InView as="section" className="lp-final" threshold={0.3}>
      <div className="lp-aurora lp-aurora-1" />
      <div className="lp-aurora lp-aurora-2" />
      <div className="lp-orbit lp-orbit-2" />
      <div className="lp-orbit lp-orbit-1" />
      <div className="lp-grain" />
      <div className="lp-wrap">
        <h2>
          <Words text="Votre école mérite mieux" step={60} />
          <br />
          <span className="lp-gold"><Words text="qu’un cahier." startDelay={300} step={80} /></span>
        </h2>
        <p className="lp-reveal" style={{ '--d': '600ms' }}>Réponse rapide sur WhatsApp · <span className="lp-nowrap">{SUPPORT_WHATSAPP_DISPLAY}</span></p>
        <div className="lp-ctas lp-reveal" style={{ '--d': '750ms' }}>
          <a className="lp-btn lp-btn-gold" href={WA_HELLO} target="_blank" rel="noreferrer">{I.whatsapp(20)}Demander un accès</a>
          <Link className="lp-btn lp-btn-ghost" to="/inscription">J’ai un code d’invitation{I.arrow(18)}</Link>
        </div>
      </div>
    </InView>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <Nav />
      <Hero />
      <Bands />
      <Gone />
      <Scenes />
      <Modules />
      <Terrain />
      <Steps />
      <Price />
      <Final />
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span>© {new Date().getFullYear()} EcoGès · Gestion scolaire</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <a href={supportMailLink('Contact EcoGès')}>{SUPPORT_EMAIL}</a>
            <a href={WA_HELLO} target="_blank" rel="noreferrer">{SUPPORT_WHATSAPP_DISPLAY}</a>
            <Link to="/connexion">Se connecter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
