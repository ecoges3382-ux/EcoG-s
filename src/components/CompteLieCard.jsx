// Fiche du personnel : compte de connexion relié à cette fiche (réservé au fondateur, qui gère les comptes).
// Le lien (staff.profile_id) rend sûrs les noms cliquables du Chat et des Comptes utilisateurs. Voir src/lib/fichePersonnel.js.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { ROLES } from '../lib/utils.js';
import { oublierPersonnel } from '../lib/fichePersonnel.js';
import { useConfirm } from './ConfirmDialog.jsx';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';

export default function CompteLieCard({ person, onChanged }) {
  const confirm = useConfirm();
  const showToast = useToast();
  const [compte, setCompte] = useState(undefined);      // undefined = lecture en cours ; null = aucun compte relié
  const [candidats, setCandidats] = useState([]);
  const [choix, setChoix] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const dispo = person.profile_id !== undefined;        // la colonne existe (base à jour)

  useEffect(() => {
    if (!dispo) return undefined;
    let annule = false;
    (async () => {
      if (person.profile_id) {
        const { data } = await supabase.from('profiles').select('id, full_name, email, role').eq('id', person.profile_id).maybeSingle();
        if (!annule) setCompte(data || null);
        return;
      }
      const [{ data: comptes }, { data: reliees }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').neq('role', 'parent').order('full_name'),
        supabase.from('staff').select('profile_id').not('profile_id', 'is', null),
      ]);
      if (annule) return;
      const pris = new Set((reliees || []).map((r) => r.profile_id));
      setCandidats((comptes || []).filter((c) => !pris.has(c.id)));
      setCompte(null);
    })();
    return () => { annule = true; };
  }, [person.id, person.profile_id, dispo]);

  if (!dispo) return null;

  async function enregistrer(profileId) {
    setOccupe(true); setErreur('');
    const { data, error } = await supabase.from('staff').update({ profile_id: profileId }).eq('id', person.id).select('id');
    setOccupe(false);
    if (error) { setErreur(error.message); return; }
    if (!data || data.length === 0) { setErreur("Impossible de modifier cette fiche."); return; }
    oublierPersonnel();
    showToast(profileId ? 'Compte relié à la fiche' : 'Compte délié');
    setChoix('');
    onChanged();
  }

  async function delier() {
    if (!(await confirm(`Délier le compte de ${compte?.full_name || 'cette personne'} de cette fiche ? Le compte et la fiche restent, ils ne sont simplement plus reliés.`, { confirmLabel: 'Délier' }))) return;
    enregistrer(null);
  }

  return (
    <div className="card-bold" style={{ padding: '18px 20px', maxWidth: 640, marginBottom: 20 }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Compte de connexion</p>
      {compte === undefined && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Lecture…</p>}
      {compte && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5 }}>
            <strong>{compte.full_name}</strong>
            <span style={{ color: 'var(--muted)' }}> · {ROLES[compte.role]?.label || compte.role}{compte.email ? ` · ${compte.email}` : ''}</span>
          </span>
          <button type="button" onClick={delier} disabled={occupe} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>Délier</button>
        </div>
      )}
      {compte === null && person.profile_id && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Le compte relié est introuvable.</p>}
      {compte === null && !person.profile_id && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Cette fiche n'est reliée à aucun compte. En la reliant, le nom de cette personne devient cliquable dans le Chat et dans Comptes utilisateurs.
          </p>
          {candidats.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Tous les comptes sont déjà reliés à une fiche.</p>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <Dropdown value={choix} onChange={setChoix} placeholder="Choisir un compte" options={candidats.map((c) => ({ value: c.id, label: `${c.full_name} (${ROLES[c.role]?.label || c.role})` }))} />
              </div>
              <button type="button" onClick={() => enregistrer(choix)} disabled={!choix || occupe} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: choix ? 'var(--forest)' : 'var(--line-strong)', color: '#fff', cursor: choix && !occupe ? 'pointer' : 'default' }}>Relier</button>
            </div>
          )}
        </>
      )}
      {erreur && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{erreur}</p>}
    </div>
  );
}
