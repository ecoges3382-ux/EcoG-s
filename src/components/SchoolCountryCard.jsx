import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import Dropdown from './Dropdown.jsx';
import { COUNTRIES } from './PhoneInput.jsx';
import { useToast } from './Toast.jsx';
import { useSchoolDial, setSchoolDial } from '../lib/schoolCountry.js';

// Pays de l'école : sert à compléter automatiquement l'indicatif des numéros de téléphone saisis sans « + » (parents,
// personnel, messages WhatsApp). Enregistré à part du reste des paramètres : si la mise à jour de la base n'est pas
// encore faite, les autres réglages continuent de s'enregistrer normalement.
export default function SchoolCountryCard({ schoolId }) {
  const showToast = useToast();
  const currentDial = useSchoolDial();
  const [dial, setDial] = useState(currentDial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Suit la valeur réelle quand elle arrive de la base (ou après un enregistrement).
  useEffect(() => { setDial(currentDial); }, [currentDial]);

  const dirty = dial !== currentDial;
  const country = COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];

  async function save() {
    setSaving(true);
    setError('');
    const { data: updated, error: updateError } = await supabase.from('schools').update({ indicatif_pays: dial }).eq('id', schoolId).select('indicatif_pays');
    setSaving(false);
    if (!updateError && (!updated || updated.length === 0)) {
      // La base ne signale pas toujours un refus : aucune ligne modifiée = droit insuffisant (seul le fondateur modifie l'école).
      setError("Seul le fondateur de l'école peut modifier ce réglage.");
      return;
    }
    if (updateError) {
      setError(/indicatif_pays|column/i.test(updateError.message)
        ? "La base de données n'est pas encore à jour pour ce réglage. Contacte le support : il reste sans effet tant que ce n'est pas fait."
        : updateError.message);
      return;
    }
    setSchoolDial(schoolId, dial);
    showToast('Pays enregistré');
  }

  return (
    <div className="card-bold" style={{ padding: 22 }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Pays de l'école</p>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        L'indicatif de ce pays est ajouté automatiquement aux numéros de téléphone saisis sans « + » (parents, personnel,
        messages WhatsApp). Pour une personne qui a un numéro d'un autre pays, il suffit de choisir son pays dans le champ
        du numéro, ou de saisir le numéro complet avec « + ».
      </p>
      <Dropdown
        value={dial}
        onChange={setDial}
        options={COUNTRIES.map((c) => ({ value: c.dial, label: `${c.flag} ${c.name} (+${c.dial})` }))}
        style={{ marginBottom: 10 }}
      />
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)' }}>
        Exemple : un parent saisi « {country.example} » sera enregistré avec +{country.dial}.
      </p>
      {error && <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        style={{ background: dirty ? 'var(--forest)' : 'var(--chip-bg)', color: dirty ? '#fff' : 'var(--muted)', border: 'none', fontWeight: 600, fontSize: 13.5, padding: '10px 16px', borderRadius: 'var(--radius)', cursor: dirty && !saving ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Enregistrement…' : 'Enregistrer le pays'}
      </button>
    </div>
  );
}
