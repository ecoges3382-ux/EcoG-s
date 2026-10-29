import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { supabaseConfigured } from './lib/supabase.js';
import Landing from './pages/Landing.jsx';
import Shell from './layout/Shell.jsx';
import { SkeletonScreen } from './components/Skeleton.jsx';

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
const Recouvrement = lazy(() => import('./pages/Recouvrement.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const FirstTimeSetup = lazy(() => import('./pages/FirstTimeSetup.jsx'));
const CGU = lazy(() => import('./pages/CGU.jsx'));
const Confidentialite = lazy(() => import('./pages/Confidentialite.jsx'));
const Aide = lazy(() => import('./pages/Aide.jsx'));

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
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/connexion" replace />;
  }
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
        <Route path="recouvrement" element={<Recouvrement />} />
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
        <Route path="aide" element={<Aide />} />
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
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/parent-access" element={<ParentAccess />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
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
