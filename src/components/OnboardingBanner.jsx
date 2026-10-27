import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';

export default function OnboardingBanner() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;

    async function checkSetup() {
      const [
        { count: cClasses },
        { count: cSubjects },
        { count: cStudents }
      ] = await Promise.all([
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('school_year_id', schoolYear.id)
      ]);

      if (!cancelled) {
        setCounts({
          classes: cClasses || 0,
          subjects: cSubjects || 0,
          students: cStudents || 0,
        });
      }
    }
    checkSetup();
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (!counts) return null;

  // Définition des étapes
  const steps = [
    { id: 'classes', label: 'Créer une classe', path: '/classes', completed: counts.classes > 0 },
    { id: 'matieres', label: 'Ajouter une matière', path: '/matieres', completed: counts.subjects > 0 },
    { id: 'eleves', label: 'Inscrire un élève', path: '/eleves', completed: counts.students > 0 },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const nextStep = steps.find(s => !s.completed);

  // Si tout est fait, on cache la bannière (l'école est configurée)
  if (completedCount === totalSteps) return null;

  return (
    <div
      className="card-bold stat-in"
      style={{
        padding: '24px 28px',
        marginBottom: 24,
        background: 'linear-gradient(135deg, #FAF6EC, var(--paper))',
        borderLeft: '6px solid var(--forest)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        
        {/* Côté gauche : Texte et guide */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
              {completedCount + 1}
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
              Prochaine étape : {nextStep.label}
            </p>
          </div>
          
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {nextStep.id === 'classes' && "Pour commencer, crée les classes de ton école (ex: CI, CP, CM2, 6e...). Tu pourras ensuite y inscrire tes élèves."}
            {nextStep.id === 'matieres' && "Ajoute les matières que tu enseignes. Cela te permettra plus tard de saisir les notes et d'imprimer les bulletins."}
            {nextStep.id === 'eleves' && "C'est le moment d'inscrire ton premier élève ! Renseigne son nom, sa classe, et le montant de son écolage."}
          </p>

          <Link
            to={nextStep.path}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--forest)', color: '#fff', textDecoration: 'none',
              padding: '10px 20px', borderRadius: 'var(--radius)',
              fontWeight: 600, fontSize: 13.5, transition: 'opacity 0.2s'
            }}
          >
            Aller à l'étape suivante
            <i className="ti ti-arrow-right" style={{ fontSize: 16 }} aria-hidden="true"></i>
          </Link>
        </div>

        {/* Côté droit : Barre de progression et liste */}
        <div style={{ flex: '1 1 250px', background: 'var(--paper)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>Progression</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>{completedCount} / {totalSteps}</span>
          </div>
          
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${(completedCount / totalSteps) * 100}%`, background: 'var(--forest)', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: s.completed ? 'var(--muted)' : 'var(--ink)', fontWeight: s.completed ? 400 : 600 }}>
                <div style={{ 
                  width: 18, height: 18, borderRadius: '50%', 
                  background: s.completed ? 'var(--success)' : 'transparent',
                  border: s.completed ? 'none' : '2px solid var(--line-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {s.completed && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true"></i>}
                </div>
                <span style={{ textDecoration: s.completed ? 'line-through' : 'none' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
