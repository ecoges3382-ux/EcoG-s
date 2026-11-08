import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const SELECT = 'id, label, is_current, statut, date_tranche1, date_tranche2, date_tranche3, date_connexe';

const SchoolYearContext = createContext(null);

// Timeout de sécurité : si Supabase ne répond pas en 8 secondes, on arrête
// d'attendre et on considère qu'il n'y a pas d'année.
const FETCH_TIMEOUT_MS = 8000;

export function SchoolYearProvider({ schoolId, children }) {
  const [years, setYears] = useState(null);
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!schoolId) {
      setYears([]);
      setLoading(false);
      setError(null);
      return Promise.resolve(null);
    }
    return supabase
      .from('school_years')
      .select(SELECT)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message || 'Erreur de chargement');
          setYears([]);
          setLoading(false);
          return null;
        }
        const all = data || [];
        setYears(all);
        setError(null);
        setLoading(false);
        return all.find((y) => y.is_current) || null;
      });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setYears([]);
      setSelectedYearId(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedYearId(null); // Reset quand on change d'école

    // 🛡️ Timeout de sécurité : si au bout de 8s rien ne revient, on arrête
    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, FETCH_TIMEOUT_MS);

    reload().then((active) => {
      if (cancelled) return;
      clearTimeout(timeoutId);
      setSelectedYearId(active?.id ?? null);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [schoolId, reload]);

  const activeYear = (years || []).find((y) => y.is_current) || null;
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
    error,
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

export function useCurrentSchoolYear() {
  const { activeYear, loading, error, refresh } = useSchoolYearContext();
  return { schoolYear: activeYear, loading, error, refresh };
}

export function useSelectedSchoolYear() {
  const { selectedYear, activeYear, isHistorical, loading, error, refresh } = useSchoolYearContext();
  return { schoolYear: selectedYear, activeYear, isHistorical, loading, error, refresh };
}

export function useSchoolYearSelector() {
  const { activeYear, selectedYear, selectableYears, isHistorical, selectYear, resetToActive, loading } = useSchoolYearContext();
  return { activeYear, selectedYear, selectableYears, isHistorical, selectYear, resetToActive, loading };
}
