import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { supabaseConfigured } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import ParentAccess from './pages/ParentAccess.jsx';
import PlatformAdmin from './pages/PlatformAdmin.jsx';
import Shell from './layout/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Staff from './pages/Staff.jsx';
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
  const { user, profile, loading } = useAuth();
  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Chargement…</div>;
  }
  if (!user) return <Navigate to="/connexion" replace />;
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
        <Route path="personnel" element={<Staff />} />
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
