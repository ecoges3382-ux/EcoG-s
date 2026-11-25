// Formulaire de modification d'un parent : lien de parenté, nom, prénom, téléphone. Mêmes champs et mêmes règles que le parent
// de la fiche élève (nom en majuscules, prénom en capitales, numéro avec indicatif du pays).
// `parent` : { id, nom, prenom, full_name, phone, lien_parente }. `onSaved(parentMisAJour)` est appelé après l'enregistrement.
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { displayName, splitFullName } from '../lib/utils.js';
import { translateError } from '../lib/errors.js';
import { useSchoolDial } from '../lib/schoolCountry.js';
import ModalContainer from './ModalContainer.jsx';
import NameInput from './NameInput.jsx';
import PhoneInput, { composePhone, decomposePhone } from './PhoneInput.jsx';
import Dropdown from './Dropdown.jsx';
import { LIENS_PARENTE } from './students/ParentFields.jsx';
import { useToast } from './Toast.jsx';

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

export default function ParentEditModal({ parent, onClose, onSaved }) {
  const showToast = useToast();
  const schoolDial = useSchoolDial();
  // Anciennes fiches : nom et prénom peuvent être vides, on les retrouve alors dans le nom complet
  const decoupe = !parent.nom && !parent.prenom ? splitFullName(parent.full_name || '') : null;
  const [nom, setNom] = useState(parent.nom || decoupe?.nom || '');
  const [prenom, setPrenom] = useState(parent.prenom || decoupe?.prenom || '');
  const depart = decomposePhone(parent.phone, schoolDial);
  const [dial, setDial] = useState(depart.dial);
  const [local, setLocal] = useState(depart.local || '');
  const [lien, setLien] = useState(parent.lien_parente || 'pere');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!nom.trim()) { setError('Le nom du parent est obligatoire.'); return; }
    setSubmitting(true); setError('');
    const champs = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      full_name: displayName(nom.trim(), prenom.trim()),
      phone: composePhone(dial, local) || null,
      lien_parente: lien,
    };
    const { data, error: updateError } = await supabase.from('parent_access').update(champs).eq('id', parent.id).select('id');
    setSubmitting(false);
    if (updateError) { setError(translateError(updateError)); return; }
    // Une mise à jour refusée par la sécurité (droits insuffisants) ne renvoie ni erreur ni ligne : on ne dit pas « enregistré » à tort.
    if (!data || data.length === 0) { setError("La modification n'a pas été enregistrée : tu n'as peut-être pas le droit de modifier ce parent."); return; }
    showToast('Parent modifié.');
    onSaved({ ...parent, ...champs });
  }

  return (
    <ModalContainer onClose={submitting ? undefined : onClose} maxWidth={520}>
      <form onSubmit={submit} style={{ padding: '22px 24px' }}>
        <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Modifier le parent</p>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Le code d'accès et les enfants rattachés ne changent pas.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label style={{ ...labelStyle, marginBottom: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Lien de parenté</label>
          <Dropdown value={lien} onChange={setLien} options={LIENS_PARENTE.map((l) => ({ value: l.id, label: l.label }))} style={{ ...inputStyle, marginBottom: 0 }} wrapperStyle={{ flex: 1, minWidth: 0, width: 'auto' }} />
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Nom du parent</label>
            <NameInput mode="upper" value={nom} onChange={setNom} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Prénom du parent</label>
            <NameInput mode="title" value={prenom} onChange={setPrenom} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Téléphone du parent</label>
          <PhoneInput dial={dial} local={local} onDialChange={setDial} onLocalChange={setLocal} style={{ marginBottom: 0 }} />
        </div>

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
            Annuler
          </button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
}
