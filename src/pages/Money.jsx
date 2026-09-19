import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmt, initials } from '../lib/utils.js';

const TABS = [
  { id: 'vue', label: "Droit d'écolage" },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'avances', label: 'Avances sur salaire' },
];

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
      {tab === 'depenses' && <Expenses />}
      {tab === 'avances' && <Advances />}
    </div>
  );
}

function useStudents() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    supabase.from('students').select('*').then(({ data, error: e }) => {
      if (e) setError(e.message); else setStudents(data);
    });
  }, []);
  return { students, error };
}

function Overview() {
  const { students, error } = useStudents();
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
  const enRetard = students
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .sort((a, b) => b.reste - a.reste);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={`${fmt(totalDu)} F`} />
        <Stat label="Familles en retard" value={enRetard.length} color="var(--danger)" />
        <Stat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
      </div>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Priorité de relance</p>
      <div className="card-bold" style={{ overflow: 'hidden' }}>
        {enRetard.slice(0, 10).map((s, i) => (
          <Link key={s.id} to={`/eleves/${s.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < Math.min(enRetard.length, 10) - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.full_name}</p>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--danger)', fontWeight: 700 }}>{fmt(s.reste)} F</p>
          </Link>
        ))}
        {enRetard.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune famille en retard.</p>}
      </div>
    </div>
  );
}

function FraisConnexes() {
  const { students, error } = useStudents();
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const taux = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={`${fmt(totalDu)} F`} />
        <Stat label="Encaissé" value={`${fmt(totalPaye)} F`} color="var(--success)" />
        <Stat label="Taux" value={`${taux}%`} />
      </div>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
          </div>
          {students.map((s, i) => {
            const reste = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', alignItems: 'center', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau}</span>
                <span style={{ fontSize: 13 }}>{fmt(s.frais_connexe_du)} F</span>
                <span style={{ fontSize: 13 }}>{fmt(s.frais_connexe_paye)} F</span>
                <span style={{ background: reste <= 0 ? 'var(--success-light)' : 'var(--amber-light)', color: reste <= 0 ? 'var(--success)' : 'var(--amber)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {reste <= 0 ? 'À jour' : 'Retard'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmt(total)} F</p>
      </div>

      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 24, maxWidth: 640 }}>
        {expenses.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < expenses.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmt(d.montant)} F</p>
          </div>
        ))}
        {expenses.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune dépense enregistrée.</p>}
      </div>

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé" style={{ ...smallInput, flex: '2 1 160px' }} />
        <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" style={{ ...smallInput, flex: '1 1 120px' }} />
        <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (F)" style={{ ...smallInput, flex: '1 1 120px' }} />
        <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

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
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(a.montant)} F</span>
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

      {staff.length > 0 && (
        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ ...smallInput, flex: '2 1 180px' }}>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
          </select>
          <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (F)" style={{ ...smallInput, flex: '1 1 120px' }} />
          <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Envoi…' : 'Nouvelle demande'}
          </button>
        </form>
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
