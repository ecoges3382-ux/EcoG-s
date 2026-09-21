import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, fmtF, MODES, modeLabel } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import MoneyInput from '../components/MoneyInput.jsx';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_MANAGE_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function StaffDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [salaries, setSalaries] = useState(null);
  const [advances, setAdvances] = useState(null);

  function reloadPerson() {
    return supabase.from('staff').select('*').eq('id', id).single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setPerson(data);
      });
  }

  useEffect(() => {
    let cancelled = false;
    reloadPerson().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [id]);

  function reloadSalaries() {
    if (!schoolYear) return;
    setSalaries(null);
    supabase
      .from('staff_salaries')
      .select('*')
      .eq('staff_id', id)
      .eq('school_year_id', schoolYear.id)
      .order('date', { ascending: false })
      .then(({ data, error: e }) => { if (e) setError(e.message); else setSalaries(data || []); });
  }

  useEffect(() => { reloadSalaries(); }, [id, schoolYear?.id]);

  useEffect(() => {
    let cancelled = false;
    supabase.from('salary_advances').select('*').eq('staff_id', id).order('created_at', { ascending: false })
      .then(({ data, error: e }) => { if (cancelled) return; if (e) setError(e.message); else setAdvances(data || []); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!person) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const canDelete = CAN_DELETE_ROLES.includes(profile.role);
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const isArchived = person.statut === 'inactif';

  // Archiver ne supprime jamais rien — voir le commentaire de la migration
  // "Personnel : statut, salaires, avances" (supabase/schema.sql) : un
  // hard-delete aurait pu, avant ce chantier, emporter tout l'historique
  // d'avances de la personne via la contrainte cascade (désormais restrict).
  async function handleArchiveToggle() {
    const next = isArchived ? 'actif' : 'inactif';
    if (next === 'inactif' && !window.confirm(`Archiver ${person.full_name} ? Son historique (avances, salaires versés) reste consultable.`)) return;
    setArchiving(true);
    const { error: updateError } = await supabase.from('staff').update({ statut: next }).eq('id', id);
    setArchiving(false);
    if (updateError) { setError(updateError.message); return; }
    reloadPerson();
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement ${person.full_name} de l'équipe ? Cette action est irréversible et impossible si un historique (avances, salaires, classe ou matière) est encore rattaché.`)) return;
    setArchiving(true);
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    setArchiving(false);
    if (deleteError) {
      setError(deleteError.message.includes('violates foreign key') ? "Impossible de supprimer : un historique (avances, salaires, classe ou matière) est encore lié à cette personne." : deleteError.message);
      return;
    }
    navigate('/personnel');
  }

  return (
    <div>
      <Link to="/personnel" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour au personnel
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--forest)', overflow: 'hidden' }}>
          {person.photo_url ? <img src={person.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(person.full_name)}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{person.full_name}</p>
            {isArchived && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--danger-light)', color: 'var(--danger)' }}>Archivé</span>
            )}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{person.role}{person.matricule ? ` · ${person.matricule}` : ''}</p>
        </div>
      </div>

      <div className="card-bold" style={{ padding: '18px 20px', maxWidth: 640, marginBottom: 20 }}>
        <Row label="Niveau d'études" value={person.niveau_etudes || '—'} />
        <Row label="Classe(s)" value={(person.classes || []).length ? person.classes.join(', ') : '—'} />
        <Row label="Téléphone" value={person.phone || '—'} />
        <Row label="E-mail" value={person.email || '—'} />
        <Row label="Date d'entrée" value={person.date_entree ? new Date(person.date_entree).toLocaleDateString('fr-FR') : '—'} />
        <Row label="Salaire mensuel" value={person.salaire_mensuel != null ? fmtF(person.salaire_mensuel) : '—'} topBorder />
      </div>

      {schoolYear && <SalariesCard staffId={id} schoolId={profile.school_id} schoolYear={schoolYear} salaries={salaries} canManage={canManage} onChanged={reloadSalaries} createdBy={profile.id} />}

      <AdvancesCard advances={advances} />

      {canDelete && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archiving}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: archiving ? 0.7 : 1 }}
          >
            {archiving ? 'Enregistrement…' : isArchived ? "Réactiver" : "Archiver"}
          </button>
          {isArchived && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={archiving}
              style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: archiving ? 0.7 : 1 }}
            >
              Supprimer définitivement
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Journal des salaires réellement versés — même principe que les paiements
// d'écolage (Argent) : chaque versement est une ligne, jamais un solde
// modifié à la main. Filtré sur l'année scolaire sélectionnée, comme le
// reste des indicateurs annuels de l'appli.
function SalariesCard({ staffId, schoolId, schoolYear, salaries, canManage, onChanged, createdBy }) {
  const [mois, setMois] = useState('');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const total = (salaries || []).reduce((a, s) => a + Number(s.montant), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!mois.trim() || !montant) { setFormError('Le mois et le montant sont obligatoires.'); return; }
    setSubmitting(true);
    setFormError('');
    const { error: insertError } = await supabase.from('staff_salaries').insert({
      school_id: schoolId, staff_id: staffId, school_year_id: schoolYear.id,
      montant: Number(montant), mois: mois.trim(), mode, date, note: note.trim() || null,
      created_by: createdBy,
    });
    setSubmitting(false);
    if (insertError) { setFormError(insertError.message); return; }
    setMois(''); setMontant(''); setNote('');
    onChanged();
  }

  return (
    <div className="card-bold" style={{ padding: '18px 20px', maxWidth: 640, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600 }}>Salaires versés — {schoolYear.label}</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{fmtF(total)}</p>
      </div>

      {!salaries ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>
      ) : salaries.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: canManage ? 14 : 0 }}>Aucun versement enregistré pour cette année.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: canManage ? 14 : 0 }}>
          {salaries.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{s.mois}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{new Date(s.date).toLocaleDateString('fr-FR')} · {modeLabel(s.mode)}{s.note ? ` · ${s.note}` : ''}</p>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{fmtF(s.montant)}</p>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={mois} onChange={(e) => setMois(e.target.value)} placeholder="Mois (ex. Janvier 2026)" style={{ ...smallInput, flex: '2 1 160px' }} />
          <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ ...smallInput, flex: '1 1 130px' }} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...smallInput, flex: '1 1 120px' }}>
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...smallInput, flex: '1 1 130px' }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" style={{ ...smallInput, flex: '2 1 160px' }} />
          <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer un versement'}
          </button>
          {formError && <p style={{ width: '100%', margin: 0, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{formError}</p>}
        </form>
      )}
    </div>
  );
}

const ADVANCE_STATUS = {
  approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
  refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
  attente_directeur: { label: 'Attente directeur', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
  attente_fondateur: { label: 'Attente fondateur', bg: 'var(--amber-light)', fg: 'var(--amber)' },
};

// Résumé en lecture seule : l'approbation/refus reste centralisée dans
// Argent → Avances sur salaire (même liste, même policy d'update), pour ne
// jamais dupliquer cette logique à deux endroits.
function AdvancesCard({ advances }) {
  if (!advances) return null;
  const enCours = advances.filter((a) => a.statut !== 'approuvee' && a.statut !== 'refusee');
  const soldeRestant = advances.filter((a) => a.statut === 'approuvee').reduce((a, s) => a + Number(s.solde), 0);

  return (
    <div className="card-bold" style={{ padding: '18px 20px', maxWidth: 640, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600 }}>Avances sur salaire</p>
        {soldeRestant > 0 && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>Solde dû : {fmtF(soldeRestant)}</p>}
      </div>
      {advances.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune demande d'avance.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {advances.map((a, i) => {
            const s = ADVANCE_STATUS[a.statut] || ADVANCE_STATUS.attente_fondateur;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{fmtF(a.montant)}{a.statut === 'approuvee' && Number(a.solde) > 0 ? ` · reste ${fmtF(a.solde)}` : ''}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{new Date(a.created_at).toLocaleDateString('fr-FR')}{a.motif ? ` · ${a.motif}` : ''}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.fg }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {enCours.length > 0 && (
        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
          Approuver ou refuser une demande se fait depuis <Link to="/argent" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Argent → Avances sur salaire</Link>.
        </p>
      )}
    </div>
  );
}

const smallInput = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
