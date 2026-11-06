import { supabase } from '../../lib/supabase.js';

export async function describeFunctionError(fnError) {
  if (!fnError) return null;
  try {
    const body = await fnError.context.json();
    if (body?.error) return body.error;
  } catch {
    // corps non lisible en JSON
  }
  return fnError.message;
}

export async function callPlatformAdmin(body) {
  const { data, error: fnError } = await supabase.functions.invoke('platform-admin', { body });
  if (fnError || data?.error) {
    return { data: null, error: data?.error || (await describeFunctionError(fnError)) };
  }
  return { data, error: null };
}

export const STATUT_LABELS = {
  essai: { label: 'Essai', bg: '#FEF3E2', fg: '#8F4620' },
  actif: { label: 'Actif', bg: '#D4F0E2', fg: '#0A7A4F' },
  suspendu: { label: 'Suspendu', bg: '#FCEEDC', fg: '#B4670E' },
  resilie: { label: 'Résilié', bg: '#FBE3DF', fg: '#B33B2A' },
};

export const PLAN_LABELS = {
  decouverte: { label: 'Découverte', bg: '#F0EDE5', fg: '#5C6E65' },
  essentiel: { label: 'Essentiel', bg: '#E4EEE9', fg: '#0F4C3A' },
  standard: { label: 'Standard', bg: '#FBF1DD', fg: '#A5680E' },
  premium: { label: 'Premium', bg: '#F0E4FA', fg: '#6B2E9E' },
};

export const PLAN_OPTIONS = [
  { value: 'decouverte', label: 'Découverte — Gratuit (50 élèves)' },
  { value: 'essentiel', label: 'Essentiel — 100 000 F/an (300 élèves)' },
  { value: 'standard', label: 'Standard — 160 000 F/an (800 élèves)' },
  { value: 'premium', label: 'Premium — 280 000 F/an (Illimité)' },
];

export const ROLE_LABELS = { fondateur: 'Fondateur', directeur: 'Directeur', secretaire: 'Secrétaire', enseignant: 'Enseignant' };

export const ACTION_LABELS = {
  set_statut: 'Changement de statut',
  set_plan: 'Changement de plan',
  set_note: 'Note modifiée',
  delete: 'École supprimée',
  impersonate: 'Connexion à la place d’un compte',
  reset_password: 'Lien de réinitialisation généré',
  add_admin: 'Administrateur ajouté',
  remove_admin: 'Administrateur retiré',
  create_school_invite: 'Code d’inscription créé',
  revoke_school_invite: 'Code d’inscription révoqué',
};

export function BuildingIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" /><path d="M9 20v-4h6v4" /><path d="M8 7.5h1.2M8 11h1.2M14.8 7.5H16M14.8 11H16" />
    </svg>
  );
}

export function UsersIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" /><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 14c2.4.2 4.2 2.4 4.4 4.7" />
    </svg>
  );
}

export function IdIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2.4" /><circle cx="12" cy="10.5" r="2.4" /><path d="M8.3 16.5c.5-1.7 1.9-2.6 3.7-2.6s3.2.9 3.7 2.6" />
    </svg>
  );
}

export function TrendIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
    </svg>
  );
}

export function AlertIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l9 16H3L12 3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export function healthIssues(school) {
  const issues = [];
  const now = Date.now();
  const created = new Date(school.created_at).getTime();
  const ageDays = Math.floor((now - created) / 86400000);

  if ((school.studentCount || 0) === 0) issues.push({ key: 'no_students', label: 'Aucun élève', severity: 'high' });
  if ((school.staffCount || 0) <= 1) issues.push({ key: 'solo_team', label: 'Équipe incomplète', severity: 'medium' });
  if (school.statut === 'essai' && ageDays > 30) issues.push({ key: 'trial_stale', label: 'Essai stagnant', severity: 'medium' });
  if ((school.statut === 'suspendu' || school.statut === 'resilie')) issues.push({ key: 'inactive', label: school.statut === 'suspendu' ? 'Suspendue' : 'Résiliée', severity: 'low' });
  return issues;
}

export function isSchoolHealthy(school) {
  return healthIssues(school).length === 0;
}

export function StatCard({ icon, accent, label, value, sub, onClick, highlight }) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{ padding: '16px 18px', background: highlight ? 'rgba(252,165,165,0.08)' : 'rgba(255,255,255,0.06)', border: `1px solid ${highlight ? 'rgba(252,165,165,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, cursor: isClickable ? 'pointer' : 'default', transition: 'background 0.2s, transform 0.2s' }}
      onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.background = highlight ? 'rgba(252,165,165,0.12)' : 'rgba(255,255,255,0.09)'; }}
      onMouseLeave={(e) => { if (isClickable) e.currentTarget.style.background = highlight ? 'rgba(252,165,165,0.08)' : 'rgba(255,255,255,0.06)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ color: accent, display: 'flex' }}>{icon}</div>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, color: '#fff' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: highlight ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>{sub}</p>}
    </div>
  );
}
