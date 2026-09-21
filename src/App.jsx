import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { supabaseConfigured } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ParentAccess from './pages/ParentAccess.jsx';
import PlatformAdmin from './pages/PlatformAdmin.jsx';
import Shell from './layout/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Parents from './pages/Parents.jsx';
import ParentDetail from './pages/ParentDetail.jsx';
import Staff from './pages/Staff.jsx';
import StaffDetail from './pages/StaffDetail.jsx';
import Classes from './pages/Classes.jsx';
import Subjects from './pages/Subjects.jsx';
import Notes from './pages/Notes.jsx';
import Grades from './pages/Grades.jsx';
import Attendance from './pages/Attendance.jsx';
import Schedule from './pages/Schedule.jsx';
import Announce from './pages/Announce.jsx';
import Documents from './pages/Documents.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import SchoolYearSettings from './pages/SchoolYearSettings.jsx';
import SettingsWhatsApp from './pages/SettingsWhatsApp.jsx';
import PrepareSchoolYear from './pages/PrepareSchoolYear.jsx';
import Money from './pages/Money.jsx';
import Accounts from './pages/Accounts.jsx';

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
  if (loading || adminLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Chargement…</div>;
  }
  if (!user) return <Navigate to="/connexion" replace />;
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
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Chargement…</div>;
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
      <Routes>
        <Route path="/connexion" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/inscription" element={<RedirectIfAuthed><SignUp /></RedirectIfAuthed>} />
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
    </AuthProvider>
  );
}
