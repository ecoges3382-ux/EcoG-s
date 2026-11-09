import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { saveCache, loadCache } from '../lib/offlineCache.js'; // 👈 NOUVEL IMPORT

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(undefined); 
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

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

  useEffect(() => {
    if (!session?.user) {
      setIsPlatformAdmin(false);
      return;
    }
    let cancelled = false;
    setAdminLoading(true);
    supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setIsPlatformAdmin(!!data);
          setAdminLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function loadOrProvisionProfile(user) {
    const select = 'id, full_name, role, school_id, permissions, schools ( id, name, color, logo_url, adresse, telephone, email, plan )';
    
    // 1. On essaie de charger depuis internet
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Impossible de charger le profil depuis internet, tentative depuis le cache :', error.message);
      // 2. Si ça échoue (hors-ligne), on récupère la carte d'identité depuis IndexedDB
      const cached = await loadCache(`user_profile_${user.id}`);
      if (cached) return cached.data;
      return null;
    }
    
    // 3. Si ça réussit, on met à jour le cache pour la prochaine fois
    if (data) {
      await saveCache(`user_profile_${user.id}`, data);
      return data;
    }

    // 4. Logique de création d'école (si pas de profil du tout)
    const meta = user.user_metadata || {};
    if (!meta.school_name || !meta.full_name) return null;

    const { error: rpcError } = await supabase.rpc('provision_school', {
      p_school_name: meta.school_name,
      p_full_name: meta.full_name,
    });
    if (rpcError) return null;

    const { data: created, error: reloadError } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', user.id)
      .maybeSingle();
      
    if (reloadError) return null;
    if (created) await saveCache(`user_profile_${user.id}`, created);
    return created;
  }

  async function refreshProfile() {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, school_id, permissions, schools ( id, name, color, logo_url, adresse, telephone, email, plan )')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      await saveCache(`user_profile_${session.user.id}`, data); // 👈 On sauvegarde aussi ici
    }
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isPlatformAdmin,
    adminLoading: session === undefined || (session !== null && adminLoading),
    loading: session === undefined || (session !== null && profileLoading),
    signIn: (identifier, password) => (
      identifier.includes('@')
        ? supabase.auth.signInWithPassword({ email: identifier, password })
        : supabase.auth.signInWithPassword({ phone: identifier, password })
    ),
    signOut: () => {
      navigate('/', { replace: true });
      return supabase.auth.signOut();
    },
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
