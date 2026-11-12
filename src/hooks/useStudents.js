import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { sortClasses } from '../lib/utils.js';

export function useStudents(schoolYearId) {
  return useQuery({
    queryKey: ['students', schoolYearId],
    queryFn: async () => {
      if (!schoolYearId) return { students: [], classes: [], feeSchedulesByNiveau: {} };

      // 1. Récupération des élèves
      const { data: enrData, error: enrError } = await supabase
        .from('enrollments')
        .select('id, created_at, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_actif, moratoire_date_fin, classes ( nom, niveau ), students ( id, full_name, nom, prenom, matricule, sexe, parent_phone, photo_url, date_naissance )')
        .eq('school_year_id', schoolYearId)
        .order('full_name', { foreignTable: 'students' });

      if (enrError) throw enrError;

      // 2. Récupération des classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, nom, niveau, section');
      
      if (classesError) throw classesError;

      // 3. Récupération de la grille tarifaire
      const { data: feesData, error: feesError } = await supabase
        .from('fee_schedules')
        .select('*')
        .eq('school_year_id', schoolYearId);
        
      if (feesError) throw feesError;

      // 4. Formatage des élèves
      const formattedStudents = (enrData || []).map((e) => ({
        id: e.students.id,
        enrollment_id: e.id,
        created_at: e.created_at,
        full_name: e.students.full_name,
        nom: e.students.nom,
        prenom: e.students.prenom,
        matricule: e.students.matricule,
        sexe: e.students.sexe,
        parent_phone: e.students.parent_phone,
        photo_url: e.students.photo_url,
        date_naissance: e.students.date_naissance,
        classe_id: e.classe_id,
        niveau: e.classes?.nom || '—',
        classeNiveau: e.classes?.niveau || null,
        montant_du: e.montant_du,
        montant_paye: e.montant_paye,
        frais_connexe_du: e.frais_connexe_du,
        frais_connexe_paye: e.frais_connexe_paye,
        note_arrangement: e.note_arrangement,
        moratoire_actif: e.moratoire_actif,
        moratoire_date_fin: e.moratoire_date_fin,
      }));

      // 5. Formatage des frais
      const feeSchedulesByNiveau = {};
      (feesData || []).forEach((f) => { feeSchedulesByNiveau[f.niveau] = f; });

      return {
        students: formattedStudents,
        classes: sortClasses(classesData || []),
        feeSchedulesByNiveau
      };
    },
    enabled: !!schoolYearId, // Ne lance la requête que si l'année est sélectionnée
  });
}
