import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = pas encore chargé
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    loadOrProvisionProfile(session.user).then((p) => {
      if (!cancelled) {
        setProfile(p);
        setProfileLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function loadOrProvisionProfile(user) {
    const select = 'id, full_name, role, school_id, schools ( id, name, color, logo_url )';
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Impossible de charger le profil :', error.message);
      return null;
    }
    if (data) return data;

    // Pas de profil : si ce compte vient du formulaire "Créer une école"
    // (métadonnées posées au signUp) et que c'est la première connexion
    // après confirmation de l'e-mail, on crée l'école + le profil fondateur.
    const meta = user.user_metadata || {};
    if (!meta.school_name || !meta.full_name) return null;

    const { error: rpcError } = await supabase.rpc('provision_school', {
      p_school_name: meta.school_name,
      p_full_name: meta.full_name,
    });
    if (rpcError) {
      console.error('Échec de la création de l\'école :', rpcError.message);
      return null;
    }

    const { data: created, error: reloadError } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', user.id)
      .maybeSingle();
    if (reloadError) {
      console.error('Impossible de recharger le profil créé :', reloadError.message);
      return null;
    }
    return created;
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading: session === undefined || (session !== null && profileLoading),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
