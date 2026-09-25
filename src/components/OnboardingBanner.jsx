import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const CAN_CONFIGURE_ROLES = ['fondateur', 'directeur'];

// Bandeau affiché en haut du tableau de bord tant qu'aucune classe n'a été
// créée — signal fiable qu'une école vient d'être créée et n'a pas encore
// été configurée (voir src/pages/FirstTimeSetup.jsx). Requête autonome
// (pas de dépendance sur ce que Dashboard.jsx charge déjà) pour ne rien
// changer à son fonctionnement existant : ce composant ne rend rien tant
// que le compte n'est pas connu, et disparaît de lui-même dès qu'au moins
// une classe existe.
export default function OnboardingBanner() {
  const { profile } = useAuth();
  const [classCount, setClassCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('classes').select('id', { count: 'exact', head: true }).then(({ count }) => {
      if (!cancelled) setClassCount(count || 0);
    });
    return () => { cancelled = true; };
  }, []);

  // Le tableau de bord vide n'est actionnable que pour qui peut créer des
  // classes/matières/tarifs — pas de bandeau pour un rôle qui atterrirait
  // sur une page qu'il n'a pas le droit de configurer (voir FirstTimeSetup.jsx).
  if (!CAN_CONFIGURE_ROLES.includes(profile?.role)) return null;
  if (classCount === null || classCount > 0) return null;

  return (
    <div className="card-bold" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '18px 22px', marginBottom: 20, background: 'var(--forest-light)', borderColor: 'var(--forest)' }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--forest-dark)' }}>Bienvenue sur EcoGès !</p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
          Configure d'abord tes classes, tes matières et tes tarifs pour pouvoir inscrire des élèves.
        </p>
      </div>
      <Link
        to="/premiers-pas"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--forest)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13.5, padding: '11px 18px', borderRadius: 'var(--radius)', whiteSpace: 'nowrap' }}
      >
        Assistant de configuration
        <i className="ti ti-arrow-right" style={{ fontSize: 15 }} aria-hidden="true"></i>
      </Link>
    </div>
  );
}
