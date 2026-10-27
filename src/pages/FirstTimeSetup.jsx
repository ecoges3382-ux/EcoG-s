import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { sortClasses } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import FeeScheduleGrid from '../components/FeeScheduleGrid.jsx';
import ClassModal from '../components/ClassModal.jsx';
import SubjectModal from '../components/SubjectModal.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';

const CAN_MANAGE_ROLES = ['fondateur', 'directeur'];

// NOUVEL ORDRE : Classes -> Tarifs -> Matières -> Résumé (vers Élèves)
const STEPS = [
  { id: 'classes', label: '1. Classes' },
  { id: 'tarifs', label: '2. Tarifs' },
  { id: 'matieres', label: '3. Matières' },
  { id: 'resume', label: '4. Résumé' },
];

export default function FirstTimeSetup() {
  const { profile } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [step, setStep] = useState('classes');
  const [classes, setClasses] = useState(null);
  const [subjects, setSubjects] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [feeCount, setFeeCount] = useState(null);
  const [error, setError] = useState('');
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  async function reload() {
    const [{ data: cl, error: clError }, { data: su }, { data: te }] = await Promise.all([
      supabase.from('classes').select('*, staff ( full_name )'),
      supabase.from('subjects').select('*, staff ( full_name )').order('nom'),
      supabase.from('staff').select('id, full_name').eq('role', 'Enseignant').order('full_name'),
    ]);
    if (clError) { setError(clError.message); return; }
    setClasses(sortClasses(cl || []));
    setSubjects(su || []);
    setTeachers(te || []);
    if (schoolYear) {
      const { count } = await supabase
        .from('fee_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('school_year_id', schoolYear.id);
      setFeeCount(count || 0);
    }
  }

  useEffect(() => { reload(); }, [schoolYear?.id]);

  if (!canManage) {
    return <p style={{ color: 'var(--muted)' }}>Réservé au fondateur et au directeur.</p>;
  }
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
        Configuration initiale
      </p>
      <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--muted)', maxWidth: 560 }}>
        Trois choses à mettre en place pour démarrer : les classes, les tarifs pour chaque classe, et les matières.
        Une fois ces étapes terminées, vous pourrez inscrire vos premiers élèves.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {STEPS.map((s) => (
          <button key={s.id} onClick={() => setStep(s.id)} style={tabStyle(step === s.id)}>
            {s.label}
            {s.id === 'classes' && classes?.length > 0 && <DoneDot />}
            {s.id === 'tarifs' && feeCount > 0 && <DoneDot />}
            {s.id === 'matieres' && subjects?.length > 0 && <DoneDot />}
          </button>
        ))}
      </div>

      {step === 'classes' && (
        <SimpleListStep
          title="Classes"
          hint="Au moins une classe est nécessaire avant de pouvoir configurer les tarifs et inscrire des élèves."
          items={classes}
          addLabel="Ajouter une classe"
          onAdd={() => setClassModalOpen(true)}
          renderItem={(c) => (
            <>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{c.nom}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.salle || '—'}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.staff?.full_name || '—'}</span>
            </>
          )}
          emptyText="Aucune classe pour l'instant."
        />
      )}

      {step === 'tarifs' && (
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Grille tarifaire</p>
          <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Montant attendu par niveau{schoolYear ? ` pour ${schoolYear.label}` : ''}. Une fois ces tarifs configurés, le montant dû se remplira automatiquement lors de l'inscription d'un élève.
          </p>
          <FeeScheduleGrid schoolId={profile.school_id} schoolYear={schoolYear} canManage />
        </div>
      )}

      {step === 'matieres' && (
        <SimpleListStep
          title="Matières"
          hint="Les matières peuvent être communes à tous les niveaux ou spécifiques à un seul."
          items={subjects}
          addLabel="Ajouter une matière"
          onAdd={() => setSubjectModalOpen(true)}
          renderItem={(s) => (
            <>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.nom}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-light)', padding: '3px 9px', borderRadius: 20, width: 'fit-content' }}>×{s.coefficient}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.niveau || 'Tous niveaux'}</span>
            </>
          )}
          emptyText="Aucune matière pour l'instant."
        />
      )}

      {step === 'resume' && (
        <ResumeStep classesCount={classes?.length || 0} subjectsCount={subjects?.length || 0} feeCount={feeCount || 0} />
      )}

      {classModalOpen && (
        <ClassModal
          schoolId={profile.school_id}
          teachers={teachers}
          editing={null}
          onClose={() => setClassModalOpen(false)}
          onSaved={() => { setClassModalOpen(false); reload(); }}
        />
      )}
      {subjectModalOpen && (
        <SubjectModal
          schoolId={profile.school_id}
          teachers={teachers}
          classes={classes || []}
          editing={null}
          onClose={() => setSubjectModalOpen(false)}
          onSaved={() => { setSubjectModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function tabStyle(active) {
  return {
    padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
    background: active ? 'var(--forest)' : 'var(--paper)', color: active ? '#fff' : 'var(--ink)',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  };
}

function DoneDot() {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} aria-hidden="true" />;
}

function SimpleListStep({ title, hint, items, addLabel, onAdd, renderItem, emptyText }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</p>
          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 420 }}>{hint}</p>
        </div>
        <button onClick={onAdd} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', whiteSpace: 'nowrap' }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>{addLabel}
        </button>
      </div>

      {!items && <SkeletonRow count={3} avatar={false} />}
      {items && items.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{emptyText}</p>}
      {items && items.length > 0 && (
        <div>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 4px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              {renderItem(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeStep({ classesCount, subjectsCount, feeCount }) {
  return (
    <div className="card-bold" style={{ padding: '30px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--forest-light)', color: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <i className="ti ti-rocket" style={{ fontSize: 32 }} aria-hidden="true"></i>
      </div>
      <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
        Ton école est prête !
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Tu as configuré les bases. Il ne te reste plus qu'à inscrire tes premiers élèves pour commencer à utiliser EcoGès au quotidien.
      </p>

      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        <Stat label="Classes" value={classesCount} />
        <Stat label="Tarifs" value={feeCount} />
        <Stat label="Matières" value={subjectsCount} />
      </div>

      {(classesCount === 0 || feeCount === 0) && (
        <p style={{ margin: '0 0 24px', fontSize: 12.5, color: 'var(--clay-dark)', lineHeight: 1.6, background: 'var(--gold-light)', padding: '12px', borderRadius: 10 }}>
          {classesCount === 0
            ? "Il manque encore au moins une classe pour pouvoir inscrire des élèves."
            : "Pense à configurer le tarif d'au moins un niveau pour que l'écolage se remplisse automatiquement."}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <Link
          to="/eleves"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--forest)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14, padding: '12px 28px', borderRadius: 'var(--radius)', width: '100%', maxWidth: 320 }}
        >
          Inscrire mes premiers élèves
          <i className="ti ti-arrow-right" style={{ fontSize: 16 }} aria-hidden="true"></i>
        </Link>
        <Link
          to="/"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: 'var(--muted)', textDecoration: 'none', fontWeight: 600, fontSize: 13, padding: '10px' }}
        >
          Aller au tableau de bord
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: '14px 10px', borderRadius: 12, background: 'var(--forest-light)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--forest-dark)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</p>
    </div>
  );
}
