import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { supabaseConfigured } from './lib/supabase.js';
import Landing from './pages/Landing.jsx';
import Shell from './layout/Shell.jsx';
import { SkeletonScreen } from './components/Skeleton.jsx';

// Landing (vitrine publique) et Shell (ossature de l'app une fois connecté)
// restent en import direct : ce sont les deux seuls écrans garantis de
// s'afficher au tout premier chargement, quel que soit le profil de la
// personne qui arrive. Chaque page derrière — accessible seulement après
// authentification ou navigation explicite — est chargée à la demande
// (un fichier JS par page) plutôt que rapatriée en un seul gros paquet dès
// le départ, pour que le premier chargement de l'app ne paie jamais pour
// des écrans que la session en cours ne visitera peut-être jamais.
const Login = lazy(() => import('./pages/Login.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const AdminSignUp = lazy(() => import('./pages/AdminSignUp.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const ParentAccess = lazy(() => import('./pages/ParentAccess.jsx'));
const PlatformAdmin = lazy(() => import('./pages/PlatformAdmin.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Students = lazy(() => import('./pages/Students.jsx'));
const StudentDetail = lazy(() => import('./pages/StudentDetail.jsx'));
const Parents = lazy(() => import('./pages/Parents.jsx'));
const ParentDetail = lazy(() => import('./pages/ParentDetail.jsx'));
const Staff = lazy(() => import('./pages/Staff.jsx'));
const StaffDetail = lazy(() => import('./pages/StaffDetail.jsx'));
const Classes = lazy(() => import('./pages/Classes.jsx'));
const Subjects = lazy(() => import('./pages/Subjects.jsx'));
const Notes = lazy(() => import('./pages/Notes.jsx'));
const Grades = lazy(() => import('./pages/Grades.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
const Schedule = lazy(() => import('./pages/Schedule.jsx'));
const Announce = lazy(() => import('./pages/Announce.jsx'));
const Documents = lazy(() => import('./pages/Documents.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const SchoolYearSettings = lazy(() => import('./pages/SchoolYearSettings.jsx'));
const SettingsWhatsApp = lazy(() => import('./pages/SettingsWhatsApp.jsx'));
const PrepareSchoolYear = lazy(() => import('./pages/PrepareSchoolYear.jsx'));
const Money = lazy(() => import('./pages/Money.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const FirstTimeSetup = lazy(() => import('./pages/FirstTimeSetup.jsx'));

function SetupNeeded() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
      <div style={{ maxWidth: 460 }}>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginBottom: 10 }}>Configuration manquante</p>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
          Les identifiants Supabase (<code>VITE_SUPABASE_URL</code> et{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>) ne sont pas configurés pour ce
          déploiement. Ajoutez-les dans Vercel (Settings → Environment
          Variables, cochées pour Production), puis relancez un
          déploiement.
        </p>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, profile, loading, isPlatformAdmin, adminLoading } = useAuth();
  const location = useLocation();
  if (loading || adminLoading) {
    return <SkeletonScreen />;
  }
  if (!user) {
    // Racine du domaine, personne connectée : vitrine publique plutôt que
    // la redirection vers /connexion appliquée à toute autre page protégée
    // (ex. un lien direct vers /eleves, partagé puis ouvert déconnecté).
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/connexion" replace />;
  }
  // Un administrateur de la plateforme n'a rien à faire dans l'interface
  // d'une école, MÊME s'il a par ailleurs un profil d'école (ex. compte créé
  // via "Créer une école" avant d'être ajouté aux administrateurs de la
  // plateforme — voir PlatformAdmin.jsx → onglet Administrateurs) :
  // priorité vérifiée avant même de regarder le profil, pour ne jamais
  // laisser passer un administrateur dans Élèves/Argent/etc.
  if (isPlatformAdmin) return <Navigate to="/admin" replace />;
  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', maxWidth: 420 }}>
          Ce compte n'a pas de profil associé à une école. Contactez l'administrateur
          pour faire créer votre profil.
        </p>
      </div>
    );
  }
  // Une école suspendue/résiliée (statut posé par l'administrateur de la
  // plateforme, voir PlatformAdmin.jsx) rend current_school_id() NULL côté
  // base pour tous ses comptes : la policy RLS "schools: lecture de sa
  // propre école" ne renvoie alors plus rien pour l'objet "schools" imbriqué
  // ici, alors que "profiles" lui-même reste lisible (policy indépendante).
  // C'est le signal fiable — jamais un champ statut lu côté client, qui
  // serait de toute façon déjà bloqué par la même RLS.
  if (profile.school_id && !profile.schools) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', maxWidth: 420 }}>
          L'accès de cette école a été suspendu. Contactez l'administrateur de la
          plateforme pour plus d'informations.
        </p>
      </div>
    );
  }
  return children;
}

// Indépendant de RequireAuth : un administrateur de la plateforme n'a pas
// forcément de profil d'école (RequireAuth le bloquerait sur ce critère).
function RequirePlatformAdmin({ children }) {
  const { user, isPlatformAdmin, adminLoading } = useAuth();
  if (adminLoading) {
    return <SkeletonScreen />;
  }
  if (!user) return <Navigate to="/connexion" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function RoleRouter() {
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="argent" element={<Money />} />
        <Route path="eleves" element={<Students />} />
        <Route path="eleves/:id" element={<StudentDetail />} />
        <Route path="parents" element={<Parents />} />
        <Route path="parents/:id" element={<ParentDetail />} />
        <Route path="personnel" element={<Staff />} />
        <Route path="personnel/:id" element={<StaffDetail />} />
        <Route path="classes" element={<Classes />} />
        <Route path="matieres" element={<Subjects />} />
        <Route path="notes" element={<Notes />} />
        <Route path="bulletins" element={<Grades />} />
        <Route path="emploi-du-temps" element={<Schedule />} />
        <Route path="presences" element={<Attendance />} />
        <Route path="annonces" element={<Announce />} />
        <Route path="documents" element={<Documents />} />
        <Route path="rapports" element={<Reports />} />
        <Route path="parametres" element={<Settings />} />
        <Route path="parametres/annee-scolaire" element={<SchoolYearSettings />} />
        <Route path="parametres/annee-scolaire/preparation" element={<PrepareSchoolYear />} />
        <Route path="parametres/whatsapp" element={<SettingsWhatsApp />} />
        <Route path="premiers-pas" element={<FirstTimeSetup />} />
        <Route path="comptes" element={<Accounts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <Suspense fallback={<SkeletonScreen />}>
        <Routes>
          <Route path="/connexion" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/inscription" element={<RedirectIfAuthed><SignUp /></RedirectIfAuthed>} />
          <Route path="/inscription-administrateur" element={<RedirectIfAuthed><AdminSignUp /></RedirectIfAuthed>} />
          <Route path="/mot-de-passe-oublie" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
          {/* Pas de RedirectIfAuthed ici : Supabase pose une session "recovery"
              dès l'arrivée sur ce lien, RedirectIfAuthed la prendrait pour une
              connexion normale et renverrait vers "/" avant que la personne
              ait pu choisir son nouveau mot de passe. */}
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/parent-access" element={<ParentAccess />} />
          <Route
            path="/admin"
            element={
              <RequirePlatformAdmin>
                <PlatformAdmin />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <RoleRouter />
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
