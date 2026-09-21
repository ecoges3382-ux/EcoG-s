import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const SELECT = 'id, label, is_current, statut, date_tranche1, date_tranche2, date_tranche3, date_connexe';

// Distingue l'année ACTIVE de l'école (school_years.is_current — jamais
// modifiée par une simple consultation) de l'année SÉLECTIONNÉE par
// l'utilisateur pour parcourir l'historique (état local à la session,
// jamais persisté en base, jamais écrit sur school_years).
//
// - useCurrentSchoolYear() : l'année active, quoi qu'on soit en train de
//   consulter ailleurs dans l'appli. Pour tout ce qui paramètre l'année en
//   cours elle-même (grille tarifaire, seuils de passage, calendrier de
//   paiement) ou fait progresser le cycle de vie de l'école (assistant de
//   préparation) — jamais pour de la simple lecture annuelle.
// - useSelectedSchoolYear() : l'année active par défaut, ou une année
//   clôturée choisie via le sélecteur global (Shell) — jamais l'année en
//   préparation (elle ne doit être une "année de travail" que depuis
//   l'assistant de rollover). À utiliser dans tous les écrans annuels de
//   consultation/quotidien (Élèves, Notes, Bulletins, Présences, Argent,
//   Rapports, Dashboard, fiche élève).
//
// Une seule requête pour toute l'appli (le Provider est monté une fois
// dans Shell.jsx) : les deux hooks partagent le même état, pas de fetch
// dupliqué ni de dérive entre écrans.
const SchoolYearContext = createContext(null);

export function SchoolYearProvider({ schoolId, children }) {
  const [years, setYears] = useState(null);
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!schoolId) return Promise.resolve(null);
    return supabase
      .from('school_years')
      .select(SELECT)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const all = data || [];
        setYears(all);
        return all.find((y) => y.is_current) || null;
      });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    reload().then((active) => {
      if (cancelled) return;
      // Ne touche jamais une sélection déjà en cours (ex. un refresh
      // déclenché par un écran de config pendant qu'on consulte un
      // historique ailleurs) — seulement au tout premier chargement.
      setSelectedYearId((prev) => (prev !== null ? prev : (active?.id ?? null)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId, reload]);

  const activeYear = (years || []).find((y) => y.is_current) || null;
  // L'historique consultable exclut une préparation en cours : elle ne
  // doit être accessible comme "année de travail" que depuis l'assistant
  // de rollover, jamais via ce sélecteur global.
  const selectableYears = (years || []).filter((y) => y.statut !== 'preparation');
  const selectedYear = selectableYears.find((y) => y.id === selectedYearId) || activeYear;

  function selectYear(yearId) {
    setSelectedYearId(yearId);
  }
  function resetToActive() {
    setSelectedYearId(activeYear?.id ?? null);
  }

  const value = {
    activeYear,
    selectedYear,
    selectableYears,
    isHistorical: !!(selectedYear && activeYear && selectedYear.id !== activeYear.id),
    loading,
    selectYear,
    resetToActive,
    refresh: reload,
  };

  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

function useSchoolYearContext() {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) throw new Error('useSchoolYearContext doit être utilisé sous SchoolYearProvider (voir Shell.jsx)');
  return ctx;
}

// L'année active de l'école, jamais affectée par la consultation d'un
// historique ailleurs dans l'appli. schoolId accepté pour compatibilité
// avec les appels existants mais ignoré : le Provider (Shell.jsx) le
// connaît déjà.
export function useCurrentSchoolYear() {
  const { activeYear, loading, refresh } = useSchoolYearContext();
  return { schoolYear: activeYear, loading, refresh };
}

// L'année sélectionnée pour consultation — l'année active par défaut, ou
// une année clôturée choisie via le sélecteur global. Ne modifie jamais
// school_years.is_current.
export function useSelectedSchoolYear() {
  const { selectedYear, activeYear, isHistorical, loading, refresh } = useSchoolYearContext();
  return { schoolYear: selectedYear, activeYear, isHistorical, loading, refresh };
}

// Pour le composant de sélection lui-même (Shell.jsx).
export function useSchoolYearSelector() {
  const { activeYear, selectedYear, selectableYears, isHistorical, selectYear, resetToActive, loading } = useSchoolYearContext();
  return { activeYear, selectedYear, selectableYears, isHistorical, selectYear, resetToActive, loading };
}
