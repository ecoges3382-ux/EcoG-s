import { supabase } from './supabase.js';
import { saveCache } from './offlineCache.js';
import { TYPES_FRAIS } from './utils.js';

// Identifiant du type de frais « inscription » (les inscriptions se suivent à part).
export function getInscriptionTypeId() {
  return TYPES_FRAIS.find(
    (t) => /inscription/i.test(t.id || '') || /inscription/i.test(t.label || ''),
  )?.id;
}

export const inscriptionsCacheKey = (schoolYearId) => `recouv_inscriptions_${schoolYearId}`;
export const remindersCacheKey = (schoolId) => `recouv_reminders_${schoolId}`;

// Total des frais d'inscription payés, par élève.
export async function loadInscriptions(schoolYearId, inscriptionTypeId) {
  const { data, error } = await supabase
    .from('payments')
    .select('student_id, montant')
    .eq('school_year_id', schoolYearId)
    .eq('type_frais', inscriptionTypeId);
  if (error) return { error };
  const map = {};
  (data || []).forEach((p) => {
    map[p.student_id] = (map[p.student_id] || 0) + Number(p.montant);
  });
  return { data: map };
}

// Relances WhatsApp : automatiques (par élève) et dernière relance manuelle envoyée.
export async function loadReminders(schoolId) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('student_id, template_name, created_at, statut')
    .eq('school_id', schoolId)
    .eq('type', 'relance_paiement')
    .order('created_at', { ascending: false });
  if (error) return { error };
  const auto = {};
  const manual = {};
  (data || []).forEach((m) => {
    const isAuto = m.template_name && m.template_name.startsWith('rappel_j');
    if (isAuto) {
      if (!auto[m.student_id]) auto[m.student_id] = [];
      auto[m.student_id].push(m);
    } else if (!manual[m.student_id] && m.statut === 'envoye') {
      manual[m.student_id] = m;
    }
  });
  return { data: { auto, manual } };
}

// Remplit le cache local en arrière-plan pour que la page s'ouvre instantanément.
export async function prefetchRecouvrement(schoolYear, schoolId) {
  if (!schoolYear || !schoolId) return;
  try {
    const typeId = getInscriptionTypeId();
    const jobs = [loadReminders(schoolId).then(({ data }) => data && saveCache(remindersCacheKey(schoolId), data))];
    if (typeId) jobs.push(loadInscriptions(schoolYear.id, typeId).then(({ data }) => data && saveCache(inscriptionsCacheKey(schoolYear.id), data)));
    await Promise.all(jobs);
  } catch { /* préchargement : sans importance si ça échoue */ }
}
