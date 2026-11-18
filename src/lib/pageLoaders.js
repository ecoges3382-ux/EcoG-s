// Chargeurs des pages (code découpé en morceaux). App.jsx s'en sert pour les routes,
// et le préchargement ci-dessous s'en sert pour télécharger une page AVANT qu'on clique :
// au clic, le morceau est déjà là et la page s'affiche sans attente.
export const pageLoaders = {
  Dashboard: () => import('../pages/Dashboard.jsx'),
  Students: () => import('../pages/Students.jsx'),
  StudentDetail: () => import('../pages/StudentDetail.jsx'),
  Parents: () => import('../pages/Parents.jsx'),
  ParentDetail: () => import('../pages/ParentDetail.jsx'),
  Staff: () => import('../pages/Staff.jsx'),
  StaffDetail: () => import('../pages/StaffDetail.jsx'),
  Classes: () => import('../pages/Classes.jsx'),
  Subjects: () => import('../pages/Subjects.jsx'),
  Notes: () => import('../pages/Notes.jsx'),
  Grades: () => import('../pages/Grades.jsx'),
  Attendance: () => import('../pages/Attendance.jsx'),
  Schedule: () => import('../pages/Schedule.jsx'),
  Announce: () => import('../pages/Announce.jsx'),
  Documents: () => import('../pages/Documents.jsx'),
  Reports: () => import('../pages/Reports.jsx'),
  Settings: () => import('../pages/Settings.jsx'),
  Money: () => import('../pages/Money.jsx'),
  Recouvrement: () => import('../pages/Recouvrement.jsx'),
  Accounts: () => import('../pages/Accounts.jsx'),
  Aide: () => import('../pages/Aide.jsx'),
  Chat: () => import('../pages/Chat.jsx'),
};

const ROUTE_TO_PAGE = {
  '/': 'Dashboard',
  '/chat': 'Chat',
  '/argent': 'Money',
  '/recouvrement': 'Recouvrement',
  '/eleves': 'Students',
  '/parents': 'Parents',
  '/personnel': 'Staff',
  '/classes': 'Classes',
  '/matieres': 'Subjects',
  '/notes': 'Notes',
  '/bulletins': 'Grades',
  '/emploi-du-temps': 'Schedule',
  '/presences': 'Attendance',
  '/annonces': 'Announce',
  '/documents': 'Documents',
  '/rapports': 'Reports',
  '/parametres': 'Settings',
  '/comptes': 'Accounts',
  '/aide': 'Aide',
};

const started = new Set();

// Connexion qui ne supporte pas un téléchargement « pour rien » : mode économie de données ou 2G.
export function canPrefetch() {
  if (typeof navigator === 'undefined') return false;
  if (navigator.onLine === false) return false;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
  return true;
}

// Télécharge le code d'une page (une seule fois). Sans effet si la connexion est économe.
export function prefetchRoute(pathname) {
  const key = ROUTE_TO_PAGE[pathname];
  if (!key || started.has(key) || !canPrefetch()) return Promise.resolve();
  started.add(key);
  return pageLoaders[key]().catch(() => { started.delete(key); });
}

// Télécharge les pages une par une (jamais deux en même temps), avec une pause entre chaque,
// pour laisser la place à ce que l'utilisateur est en train de faire.
export function prefetchRoutesWhenIdle(pathnames) {
  if (!canPrefetch()) return () => {};
  const queue = [...pathnames];
  let cancelled = false;
  let handle = 0;
  const idle = typeof window !== 'undefined' && window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 4000 })
    : (fn) => setTimeout(fn, 800);
  const stop = typeof window !== 'undefined' && window.cancelIdleCallback ? window.cancelIdleCallback.bind(window) : clearTimeout;
  function next() {
    if (cancelled || queue.length === 0) return;
    if (!canPrefetch()) return;
    prefetchRoute(queue.shift()).finally(() => {
      if (cancelled) return;
      handle = setTimeout(() => { handle = idle(next); }, 300);
    });
  }
  handle = idle(next);
  return () => { cancelled = true; stop(handle); clearTimeout(handle); };
}

// À étaler sur un lien de navigation : le code de la page se télécharge dès que le doigt
// ou la souris s'en approche, avant même le clic.
export function prefetchHandlers(pathname) {
  const go = () => prefetchRoute(pathname);
  return { onMouseEnter: go, onTouchStart: go, onFocus: go };
}

// Attend que la page ait fini de se charger (plus aucun téléchargement depuis un moment), pour que
// la préparation en arrière-plan ne ralentisse jamais l'affichage de la page en cours.
export function whenNetworkQuiet(callback, { quietMs = 1500, maxWaitMs = 30000, ready = () => true } = {}) {
  if (typeof window === 'undefined' || !window.performance) { callback(); return () => {}; }
  const startedAt = Date.now();
  let timer = 0;
  let stopped = false;
  function check() {
    if (stopped) return;
    const entries = performance.getEntriesByType('resource');
    const last = entries.length ? entries[entries.length - 1] : null;
    const lastEnd = last ? last.responseEnd : 0;
    const quiet = performance.now() - lastEnd >= quietMs;
    if ((document.readyState === 'complete' && quiet && ready()) || Date.now() - startedAt > maxWaitMs) { callback(); return; }
    timer = setTimeout(check, 500);
  }
  timer = setTimeout(check, 500);
  return () => { stopped = true; clearTimeout(timer); };
}
