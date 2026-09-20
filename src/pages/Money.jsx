import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, NIVEAUX } from '../lib/utils.js';
import { useCurrentSchoolYear } from '../lib/schoolYear.js';
import { computeRelance } from '../lib/retard.js';
import MoneyInput from '../components/MoneyInput.jsx';

const TABS = [
  { id: 'vue', label: "Droit d'écolage" },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'avances', label: 'Avances sur salaire' },
  { id: 'grille', label: 'Grille tarifaire' },
];

const TYPES_FRAIS = [
  { id: 'scolarite', label: 'Scolarité' },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'inscription', label: 'Inscription' },
  { id: 'autre', label: 'Autre' },
];
const MODES = [
  { id: 'especes', label: 'Espèces' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'virement', label: 'Virement' },
  { id: 'cheque', label: 'Chèque' },
];
// Certaines écoles fonctionnent en 2 tranches, d'autres en 3 — la liste
// reste la même pour toutes, une école à 2 tranches n'utilise juste pas la
// 3ème. "partiel" reste géré en affichage pour d'anciens paiements
// enregistrés avant ce champ (voir tranceLabel), mais n'est plus proposé
// à la saisie.
const TRANCHES = [
  { id: 'tranche1', label: '1ère tranche' },
  { id: 'tranche2', label: '2ème tranche' },
  { id: 'tranche3', label: '3ème tranche' },
  { id: 'moitie', label: 'Moitié' },
  { id: 'complet', label: 'Complet' },
];
function trancheLabel(id) {
  return TRANCHES.find((t) => t.id === id)?.label || (id === 'partiel' ? 'Partiel' : id);
}

export default function Money() {
  const [tab, setTab] = useState('vue');

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Argent</p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -14px 22px', padding: '0 14px 4px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flexShrink: 0, padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vue' && <Overview />}
      {tab === 'connexe' && <FraisConnexes />}
      {tab === 'paiements' && <Payments />}
      {tab === 'depenses' && <Expenses />}
      {tab === 'avances' && <Advances />}
      {tab === 'grille' && <FeeSchedules />}
    </div>
  );
}

// Le dû/payé et la classe d'un élève sont propres à l'année scolaire en
// cours (table enrollments) — students ne garde que son identité.
function useEnrollments() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!schoolYear) return;
    supabase
      .from('enrollments')
      .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, classes ( nom ), students ( id, full_name )')
      .eq('school_year_id', schoolYear.id)
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setStudents((data || []).map((en) => ({
          id: en.students.id,
          full_name: en.students.full_name,
          niveau: en.classes?.nom || '—',
          montant_du: en.montant_du,
          montant_paye: en.montant_paye,
          frais_connexe_du: en.frais_connexe_du,
          frais_connexe_paye: en.frais_connexe_paye,
          note_arrangement: en.note_arrangement,
        })));
      });
  }, [schoolYear?.id]);
  return { students, error, schoolYear };
}

function Overview() {
  const { students, error, schoolYear } = useEnrollments();
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  // Une fois un calendrier de paiement configuré, "en retard" veut dire
  // un délai dépassé (voir computeRelance) plutôt que juste "reste à
  // payer" — et exclut les élèves avec un moratoire actif.
  const calendrierConfigure = !!(schoolYear && (schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3));
  const enRetard = students
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .filter((s) => !calendrierConfigure || computeRelance(s, schoolYear).relance)
    .sort((a, b) => b.reste - a.reste);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Familles en retard" value={enRetard.length} color="var(--danger)" />
        <Stat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
      </div>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Priorité de relance</p>
      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {enRetard.slice(0, 10).map((s, i) => (
          <Link key={s.id} to={`/eleves/${s.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < Math.min(enRetard.length, 10) - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.full_name}</p>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--danger)', fontWeight: 700 }}>{fmtF(s.reste)}</p>
          </Link>
        ))}
        {enRetard.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune famille en retard.</p>}
      </div>
    </div>
  );
}

function FraisConnexes() {
  const { students, error, schoolYear } = useEnrollments();
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const taux = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Taux" value={`${taux}%`} />
      </div>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
          </div>
          {students.map((s, i) => {
            const reste = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
            const relance = computeRelance(s, schoolYear);
            const label = reste <= 0 ? 'À jour' : relance.moratoire ? 'Moratoire' : relance.relanceConnexe ? 'À relancer' : 'Retard';
            const color = reste <= 0 ? 'success' : relance.moratoire ? null : relance.relanceConnexe ? 'danger' : 'amber';
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', alignItems: 'center', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_du)}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_paye)}</span>
                <span style={{ background: color ? `var(--${color}-light)` : '#F0EDE5', color: color ? `var(--${color})` : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Payments() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    if (!schoolYear) return;
    const [{ data: pay, error: payError }, { data: enr }] = await Promise.all([
      supabase.from('payments').select('*, students ( full_name )').eq('school_year_id', schoolYear.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('enrollments').select('classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id),
    ]);
    if (payError) setError(payError.message); else setPayments(pay);
    setStudents((enr || [])
      .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—' }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!payments) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalEncaisse = payments.reduce((a, p) => a + Number(p.montant), 0);
  const partiels = payments.filter((p) => p.tranche !== 'complet').length;

  return (
    <div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        <Stat label="Total encaissé" value={fmtF(totalEncaisse)} color="var(--success)" />
        <Stat label="Nb paiements" value={payments.length} />
        <Stat label="Paiements partiels" value={partiels} color="var(--amber)" />
      </div>

      {canManage && (
        <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Enregistrer un paiement
        </button>
      )}

      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {payments.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{p.students?.full_name || '—'}</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>
                {TYPES_FRAIS.find((t) => t.id === p.type_frais)?.label} · {MODES.find((m) => m.id === p.mode)?.label} · {new Date(p.date).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700 }}>{fmtF(p.montant)}</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: p.tranche === 'complet' ? 'var(--success-light)' : 'var(--amber-light)', color: p.tranche === 'complet' ? 'var(--success)' : 'var(--amber)' }}>
                {trancheLabel(p.tranche)}
              </span>
            </div>
          </div>
        ))}
        {payments.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré.</p>}
      </div>

      {modalOpen && schoolYear && (
        <NewPaymentModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function NewPaymentModal({ schoolId, schoolYearId, students, onClose, onCreated }) {
  // Filtre en deux temps (classe puis élève) plutôt qu'un seul menu avec
  // tous les élèves de l'école mélangés — plus rapide à trouver quand il y
  // en a beaucoup.
  const classes = [...new Set(students.map((s) => s.niveau))].sort();
  const [classeFilter, setClasseFilter] = useState(classes[0] || '');
  const studentsInClasse = students.filter((s) => s.niveau === classeFilter);
  const [studentId, setStudentId] = useState(studentsInClasse[0]?.id || '');

  function handleClasseChange(niveau) {
    setClasseFilter(niveau);
    const first = students.find((s) => s.niveau === niveau);
    setStudentId(first?.id || '');
  }
  const [typeFrais, setTypeFrais] = useState('scolarite');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [tranche, setTranche] = useState('complet');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId || !montant) {
      setError("L'élève et le montant sont obligatoires.");
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supabase.from('payments').insert({
      school_id: schoolId, school_year_id: schoolYearId, student_id: studentId, type_frais: typeFrais, montant: Number(montant), mode, tranche, date, note: note.trim() || null,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  if (students.length === 0) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucun élève inscrit</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Il faut d'abord inscrire au moins un élève avant de pouvoir enregistrer un paiement.
          </p>
          <Link
            to="/eleves"
            onClick={onClose}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}
          >
            Aller inscrire un élève
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Nouveau paiement</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Classe</label>
            <select value={classeFilter} onChange={(e) => handleClasseChange(e.target.value)} style={modalInputStyle}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Élève</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={modalInputStyle}>
              {studentsInClasse.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Type de frais</label>
            <select value={typeFrais} onChange={(e) => setTypeFrais(e.target.value)} style={modalInputStyle}>
              {TYPES_FRAIS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Montant (F CFA)</label>
            <MoneyInput value={montant} onChange={setMontant} style={modalInputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={modalInputStyle}>
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Tranche</label>
            <select value={tranche} onChange={(e) => setTranche(e.target.value)} style={modalInputStyle}>
              {TRANCHES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={modalInputStyle} />
          </div>
        </div>

        {students.length === 0 && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)' }}>Aucun élève inscrit.</p>}
        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting || students.length === 0} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const modalInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const modalLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

function Expenses() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState('');
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    const { data, error: e } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (e) setError(e.message); else setExpenses(data);
  }
  useEffect(() => { reload(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!libelle.trim() || !montant) return;
    setSubmitting(true);
    const { error: insertError } = await supabase.from('expenses').insert({
      school_id: profile.school_id, libelle: libelle.trim(), categorie: categorie.trim() || 'Autre', montant: Number(montant),
    });
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setLibelle(''); setCategorie(''); setMontant('');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!expenses) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const total = expenses.reduce((a, d) => a + Number(d.montant), 0);

  return (
    <div>
      <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 24, maxWidth: 320 }}>
        <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>Total des dépenses</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(total)}</p>
      </div>

      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 24, maxWidth: 640 }}>
        {expenses.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < expenses.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmtF(d.montant)}</p>
          </div>
        ))}
        {expenses.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune dépense enregistrée.</p>}
      </div>

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé" style={{ ...smallInput, flex: '2 1 160px' }} />
        <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" style={{ ...smallInput, flex: '1 1 120px' }} />
        <MoneyInput value={montant} onChange={setMontant} placeholder="Montant (F CFA)" style={{ ...smallInput, flex: '1 1 120px' }} />
        <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

// Le montant de scolarité par niveau, pour l'année en cours — se
// pré-remplit automatiquement à l'inscription (voir NewStudentModal), au
// lieu d'être retapé à la main élève par élève.
function FeeSchedules() {
  const { profile } = useAuth();
  const { schoolYear, refresh: refreshSchoolYear } = useCurrentSchoolYear(profile.school_id);
  const canManage = ['fondateur', 'directeur'].includes(profile.role);
  const [rows, setRows] = useState(null);
  // Seuls les niveaux qui ont au moins une classe créée (page Classes) sont
  // proposés ici — pas la liste générique Maternelle→Terminale, comme pour
  // le sélecteur de classe à l'inscription.
  const [niveauxPresents, setNiveauxPresents] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  async function reload() {
    if (!schoolYear) return;
    const [{ data, error: e }, { data: cl }] = await Promise.all([
      supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id),
      supabase.from('classes').select('niveau'),
    ]);
    if (e) { setError(e.message); return; }
    const map = {};
    (data || []).forEach((f) => { map[f.niveau] = f; });
    setRows(map);
    const present = new Set((cl || []).map((c) => c.niveau));
    setNiveauxPresents(NIVEAUX.filter((n) => present.has(n)));
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function saveRow(niveau, montantScolarite, montantConnexe) {
    if (!schoolYear) return;
    setSaving(niveau);
    const existing = rows?.[niveau];
    const payload = {
      school_id: profile.school_id,
      school_year_id: schoolYear.id,
      niveau,
      montant_scolarite: Number(montantScolarite) || 0,
      montant_connexe: Number(montantConnexe) || 0,
    };
    const { error: saveError } = existing
      ? await supabase.from('fee_schedules').update(payload).eq('id', existing.id)
      : await supabase.from('fee_schedules').insert(payload);
    setSaving('');
    if (saveError) { setError(saveError.message); return; }
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!rows || !niveauxPresents || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  if (niveauxPresents.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Aucune classe créée pour l'instant. Crée d'abord tes classes dans l'onglet{' '}
        <Link to="/classes" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Classes</Link>{' '}
        pour pouvoir configurer leur tarif ici.
      </p>
    );
  }

  return (
    <div>
      <PaymentCalendar schoolYear={schoolYear} canManage={canManage} onSaved={refreshSchoolYear} />

      <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Montant attendu par niveau pour {schoolYear.label} — se pré-remplit automatiquement à
        l'inscription d'un élève.{!canManage && ' Seuls le fondateur et le directeur peuvent modifier ces montants.'}
      </p>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Niveau</span><span>Scolarité (F CFA)</span><span>Frais connexes (F CFA)</span>
          </div>
          {niveauxPresents.map((niveau, i) => (
            <FeeRow
              key={niveau}
              niveau={niveau}
              row={rows[niveau]}
              canManage={canManage}
              saving={saving === niveau}
              onSave={saveRow}
              isLast={i === niveauxPresents.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Un seul calendrier par année scolaire, identique pour toute l'école (pas
// par niveau) : une fois un délai dépassé, les élèves qui n'ont pas payé
// ce qu'il fallait à ce stade apparaissent "à relancer" dans Élèves et
// Argent (voir src/lib/retard.js). La 3ème tranche reste facultative pour
// une école qui ne fonctionne qu'en 2 tranches.
function PaymentCalendar({ schoolYear, canManage, onSaved }) {
  const [d1, setD1] = useState(schoolYear.date_tranche1 || '');
  const [d2, setD2] = useState(schoolYear.date_tranche2 || '');
  const [d3, setD3] = useState(schoolYear.date_tranche3 || '');
  const [dc, setDc] = useState(schoolYear.date_connexe || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setD1(schoolYear.date_tranche1 || '');
    setD2(schoolYear.date_tranche2 || '');
    setD3(schoolYear.date_tranche3 || '');
    setDc(schoolYear.date_connexe || '');
  }, [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3, schoolYear.date_connexe]);

  const dirty = d1 !== (schoolYear.date_tranche1 || '') || d2 !== (schoolYear.date_tranche2 || '')
    || d3 !== (schoolYear.date_tranche3 || '') || dc !== (schoolYear.date_connexe || '');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('school_years').update({
      date_tranche1: d1 || null,
      date_tranche2: d2 || null,
      date_tranche3: d3 || null,
      date_connexe: dc || null,
    }).eq('id', schoolYear.id);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved();
  }

  return (
    <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 22 }}>
      <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Calendrier de paiement</p>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Une fois un délai dépassé, les élèves qui n'ont pas payé ce qu'il fallait à ce stade
        apparaissent automatiquement « à relancer » dans Élèves et Argent.
      </p>
      {canManage ? (
        <>
          <div className="desktop-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div>
              <label style={calLabelStyle}>1ère tranche</label>
              <input type="date" value={d1} onChange={(e) => setD1(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>2ème tranche</label>
              <input type="date" value={d2} onChange={(e) => setD2(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>3ème tranche (optionnel)</label>
              <input type="date" value={d3} onChange={(e) => setD3(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>Frais connexes</label>
              <input type="date" value={dc} onChange={(e) => setDc(e.target.value)} style={calInputStyle} />
            </div>
          </div>
          {error && <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            style={{ marginTop: 14, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le calendrier'}
          </button>
        </>
      ) : (
        <div className="desktop-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <CalDateDisplay label="1ère tranche" value={schoolYear.date_tranche1} />
          <CalDateDisplay label="2ème tranche" value={schoolYear.date_tranche2} />
          <CalDateDisplay label="3ème tranche" value={schoolYear.date_tranche3} />
          <CalDateDisplay label="Frais connexes" value={schoolYear.date_connexe} />
        </div>
      )}
    </div>
  );
}

function CalDateDisplay({ label, value }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{value ? new Date(value).toLocaleDateString('fr-FR') : '—'}</p>
    </div>
  );
}

const calLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const calInputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };

function FeeRow({ niveau, row, canManage, saving, onSave, isLast }) {
  const [scolarite, setScolarite] = useState(row?.montant_scolarite ?? 0);
  const [connexe, setConnexe] = useState(row?.montant_connexe ?? 0);
  const dirty = Number(scolarite) !== Number(row?.montant_scolarite ?? 0) || Number(connexe) !== Number(row?.montant_connexe ?? 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', padding: '10px 20px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid var(--line)', gap: 8 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{niveau}</span>
      {canManage ? (
        <>
          <MoneyInput value={scolarite} onChange={setScolarite} style={feeInputStyle} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MoneyInput value={connexe} onChange={setConnexe} style={feeInputStyle} />
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => onSave(niveau, scolarite, connexe)}
              style={{ fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default', flexShrink: 0 }}
            >
              {saving ? '…' : 'OK'}
            </button>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: 13 }}>{fmtF(row?.montant_scolarite || 0)}</span>
          <span style={{ fontSize: 13 }}>{fmtF(row?.montant_connexe || 0)}</span>
        </>
      )}
    </div>
  );
}

const feeInputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };

function Advances() {
  const { profile } = useAuth();
  const [advances, setAdvances] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [staffId, setStaffId] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    const [{ data: adv, error: e }, { data: st }] = await Promise.all([
      supabase.from('salary_advances').select('*, staff ( full_name, role )').order('created_at', { ascending: false }),
      supabase.from('staff').select('id, full_name, role').order('full_name'),
    ]);
    if (e) setError(e.message); else setAdvances(adv);
    setStaff(st || []);
    if (st?.length && !staffId) setStaffId(st[0].id);
  }
  useEffect(() => { reload(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !montant) return;
    setSubmitting(true);
    const amount = Number(montant);
    const { error: insertError } = await supabase.from('salary_advances').insert({
      school_id: profile.school_id, staff_id: staffId, montant: amount, solde: amount, statut: 'attente_fondateur',
    });
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setMontant('');
    reload();
  }

  async function decide(id, statut) {
    const { error: updateError } = await supabase.from('salary_advances').update({ statut }).eq('id', id);
    if (updateError) setError(updateError.message);
    else reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!advances) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const canDecide = profile.role === 'fondateur' || profile.role === 'directeur';

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Le fondateur et le directeur peuvent approuver ou refuser une demande. Les autres rôles peuvent
        seulement en soumettre une nouvelle.
      </p>

      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 20 }}>
        {advances.map((a, i) => (
          <div key={a.id} style={{ padding: '13px 20px', borderBottom: i < advances.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{a.staff?.full_name || '—'}</span>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}> · {a.staff?.role}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtF(a.montant)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <StatusBadge statut={a.statut} />
              {canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
                <div>
                  <button onClick={() => decide(a.id, 'approuvee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', marginRight: 6 }}>Approuver</button>
                  <button onClick={() => decide(a.id, 'refusee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>Refuser</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {advances.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune demande.</p>}
      </div>

      {staff.length > 0 ? (
        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ ...smallInput, flex: '2 1 180px' }}>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
          </select>
          <MoneyInput value={montant} onChange={setMontant} placeholder="Montant (F CFA)" style={{ ...smallInput, flex: '1 1 120px' }} />
          <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Envoi…' : 'Nouvelle demande'}
          </button>
        </form>
      ) : (
        <p className="card-bold" style={{ padding: '18px 20px', margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Aucun membre du personnel enregistré pour l'instant. Ajoute d'abord des membres dans l'onglet{' '}
          <Link to="/personnel" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Personnel</Link>{' '}
          pour pouvoir soumettre une demande d'avance sur salaire.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ statut }) {
  const map = {
    approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
    refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
    attente_directeur: { label: 'Attente directeur', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
    attente_fondateur: { label: 'Attente fondateur', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  };
  const s = map[statut] || map.attente_fondateur;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>{s.label}</span>;
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const smallInput = { padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
