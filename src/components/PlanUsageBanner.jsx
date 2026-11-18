// Avertit le fondateur ou le directeur quand l'école approche (90 %) ou atteint la limite d'élèves ou de comptes
// de son plan. Ne bloque rien : c'est seulement une information, avec un lien pour parler du plan supérieur.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { studentLimit, accountLimit, usageLevel, nextPlan, getPlanLabel } from '../lib/plan.js';
import { supportWhatsappLink } from '../lib/utils.js';

const ROLES_CONCERNES = ['fondateur', 'directeur'];

export default function PlanUsageBanner() {
  const { profile } = useAuth();
  const plan = profile?.schools?.plan || 'decouverte';
  const concerne = ROLES_CONCERNES.includes(profile?.role);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!concerne || !profile?.school_id) return;
    let cancelled = false;
    (async () => {
      const [students, accounts] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      ]);
      if (cancelled || students.error || accounts.error) return; // en cas de doute, on n'affiche rien
      setCounts({ students: students.count || 0, accounts: accounts.count || 0 });
    })();
    return () => { cancelled = true; };
  }, [concerne, profile?.school_id]);

  if (!concerne || !counts) return null;

  const lignes = [];
  const checks = [
    { nom: 'élèves', n: counts.students, limite: studentLimit(plan) },
    { nom: 'comptes', n: counts.accounts, limite: accountLimit(plan) },
  ];
  for (const c of checks) {
    const niveau = usageLevel(c.n, c.limite);
    if (niveau === 'ok') continue;
    // Comptes : être exactement à la limite, c'est l'usage normal du plan (Découverte = fondateur + directeur), pas un
    // signal. On n'avertit qu'à l'approche d'un plan plus grand, ou en cas de dépassement.
    if (c.nom === 'comptes' && niveau === 'full' && c.n === c.limite) continue;
    lignes.push({ ...c, niveau });
  }
  if (lignes.length === 0) return null;

  const suivant = nextPlan(plan);
  const complet = lignes.some((l) => l.niveau === 'full');
  const message = lignes
    .map((l) => (l.niveau === 'full'
      ? `${l.n} ${l.nom} sur ${l.limite} : la limite du plan ${getPlanLabel(plan)} est ${l.n > l.limite ? 'dépassée' : 'atteinte'}`
      : `${l.n} ${l.nom} sur ${l.limite} : vous approchez de la limite du plan ${getPlanLabel(plan)}`))
    .join(' · ');
  const waMessage = `Bonjour, mon école approche de la limite de son plan ${getPlanLabel(plan)} sur EcoGès${suivant ? ` et je souhaite en savoir plus sur le plan ${getPlanLabel(suivant)}` : ''}. Pouvez-vous me contacter ?`;

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        padding: '12px 16px', marginBottom: 18, borderRadius: 'var(--radius)',
        background: 'var(--gold-light)', color: 'var(--clay-text)',
        border: `1px solid ${complet ? 'var(--clay-text)' : 'var(--line-strong)'}`,
        fontSize: 13.5, lineHeight: 1.5,
      }}
    >
      <span>
        <strong>{message}.</strong>{' '}
        Rien n'est bloqué : vous pouvez continuer à travailler normalement.
      </span>
      <a
        href={supportWhatsappLink(waMessage)}
        target="_blank"
        rel="noreferrer"
        style={{ fontWeight: 600, color: 'var(--clay-text)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
      >
        {suivant ? `Parler du plan ${getPlanLabel(suivant)}` : 'Contacter le support'}
      </a>
    </div>
  );
}
