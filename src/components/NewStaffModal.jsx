import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { displayName } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import NameInput from './NameInput.jsx';
import MoneyInput from './MoneyInput.jsx';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';

const ROLES = ['Enseignant', 'Censeur', 'Secrétaire', 'Directeur', 'Fondateur'];
const PREFIXES = { Enseignant: 'ENS', Censeur: 'CEN', Secrétaire: 'SEC', Directeur: 'DIR', Fondateur: 'FON' };

function nextMatricule(existingStaff, role) {
  const count = existingStaff.filter((p) => p.role === role).length + 1;
  return `${PREFIXES[role] || 'PER'}-${String(count).padStart(4, '0')}`;
}

function MultiSelect({ label, options, selectedIds, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const idealHeight = 250;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < idealHeight && spaceAbove > spaceBelow;
      const maxHeight = openUpward ? Math.min(idealHeight, spaceAbove - 10) : Math.min(idealHeight, spaceBelow - 10);

      setMenuStyle({
        position: 'fixed', left: rect.left, width: rect.width,
        ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        maxHeight, zIndex: 9999, background: 'var(--paper)', border: '1px solid var(--line-strong)',
        borderRadius: 9, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column'
      });
    }
    setOpen(!open);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleValue(val) {
    if (selectedIds.includes(val)) onChange(selectedIds.filter((v) => v !== val));
    else onChange([...selectedIds, val]);
  }

  const selectedLabels = options.filter(o => selectedIds.includes(o.value)).map(o => o.label);
  const displayText = selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder;

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>{label}</label>
      <button type="button" ref={btnRef} onClick={toggle} style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: selectedLabels.length > 0 ? 'var(--ink)' : 'var(--muted)', fontSize: 14, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{displayText}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true"></i>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={menuStyle}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 50 }}>
            {options.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13.5 }}>
                <input type="checkbox" checked={selectedIds.includes(opt.value)} onChange={() => toggleValue(opt.value)} />
                {opt.label}
              </label>
            ))}
            {options.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Aucun élément disponible.</p>}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 8, textAlign: 'right', flexShrink: 0 }}>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>OK</button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

export default function NewStaffModal({ schoolId, existingStaff, availableClasses, availableSubjects, editing, onClose, onSaved }) {
  const showToast = useToast();
  const [nom, setNom] = useState(editing?.nom || '');
  const [prenom, setPrenom] = useState(editing?.prenom || '');
  const [role, setRole] = useState(editing?.role || ROLES[0]);
  const [niveauEtudes, setNiveauEtudes] = useState(editing?.niveau_etudes || '');
  
  const [classNames, setClassNames] = useState(editing?.classes || []);
  const [subjectIds, setSubjectIds] = useState(
    editing ? availableSubjects.filter((s) => s.enseignant_id === editing.id).map((s) => s.id) : [],
  );
  
  const [dispenseCours, setDispenseCours] = useState(() => {
    if (editing?.role === 'Enseignant') return true;
    return (editing?.classes?.length > 0) || availableSubjects.some((s) => s.enseignant_id === editing?.id);
  });

  const [phone, setPhone] = useState(editing?.phone || '');
  const [email, setEmail] = useState(editing?.email || '');
  const [dateEntree, setDateEntree] = useState(editing?.date_entree || '');
  const [salaireMensuel, setSalaireMensuel] = useState(editing?.salaire_mensuel ?? '');
  const [photoUrl, setPhotoUrl] = useState(editing?.photo_url || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');

    const finalClasses = (role === 'Enseignant' || dispenseCours) ? classNames : [];
    const finalSubjectIds = (role === 'Enseignant' || dispenseCours) ? subjectIds : [];

    // Les droits d'accès (permissions) sont volontairement absents de ce
    // payload : ils se gèrent exclusivement depuis Comptes → Modifier un
    // compte (StaffAccountModal dans Accounts.jsx), qui écrit dans
    // profiles.permissions — la seule colonne réellement lue par l'app
    // pour filtrer les accès. La colonne staff.permissions existait bien
    // en base et était remplie ici, mais n'était consultée nulle part :
    // un fondateur qui cochait des cases dans ce formulaire croyait à
    // tort donner des droits. Une information = un écran.
    const payload = {
      full_name: displayName(nom.trim(), prenom.trim()),
      nom: nom.trim(),
      prenom: prenom.trim(),
      role,
      niveau_etudes: niveauEtudes.trim(),
      classes: finalClasses,
      phone: phone.trim(),
      email: email.trim(),
      date_entree: dateEntree || null,
      salaire_mensuel: salaireMensuel ? Number(salaireMensuel) : null,
      photo_url: photoUrl || null,
    };

    const { data: savedRow, error: saveError } = editing
      ? await supabase.from('staff').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('staff').insert({ school_id: schoolId, matricule: nextMatricule(existingStaff, role), ...payload }).select('id').single();
    
    if (saveError) {
      setSubmitting(false);
      setError(saveError.message);
      return;
    }

    const staffId = savedRow.id;
    const toAssign = finalSubjectIds;
    const toRelease = availableSubjects.filter((s) => s.enseignant_id === staffId && !finalSubjectIds.includes(s.id)).map((s) => s.id);
    
    const [{ error: assignError }, { error: releaseError }] = await Promise.all([
      toAssign.length ? supabase.from('subjects').update({ enseignant_id: staffId }).in('id', toAssign) : Promise.resolve({}),
      toRelease.length ? supabase.from('subjects').update({ enseignant_id: null }).in('id', toRelease) : Promise.resolve({}),
    ]);
    
    setSubmitting(false);
    if (assignError || releaseError) {
      setError((assignError || releaseError).message);
      return;
    }
    showToast('Enregistré');
    onSaved();
  }

  const showAttribution = role === 'Enseignant' || dispenseCours;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier le membre du personnel' : 'Nouveau membre du personnel'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nom">
            <NameInput mode="upper" value={nom} onChange={setNom} style={inputStyle} />
          </Field>
          <Field label="Prénom">
            <NameInput mode="title" value={prenom} onChange={setPrenom} style={inputStyle} />
          </Field>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Rôle">
            <Dropdown value={role} onChange={setRole} options={ROLES} style={inputStyle} />
          </Field>
          <Field label="Niveau d'études">
            <input value={niveauEtudes} onChange={(e) => setNiveauEtudes(e.target.value)} placeholder="ex. Licence en Lettres" style={inputStyle} />
          </Field>
        </div>

        {/* Case à cocher pour les non-enseignants */}
        {role !== 'Enseignant' && (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--forest-light)', borderRadius: 9 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--forest-dark)' }}>
              <input 
                type="checkbox" 
                checked={dispenseCours} 
                onChange={(e) => setDispenseCours(e.target.checked)} 
              />
              Ce membre dispense des cours
            </label>
          </div>
        )}

        {/* Section d'attribution (visible si Enseignant ou si la case est cochée) */}
        {showAttribution && (
          <>
            <MultiSelect 
              label="Classe(s) attribuée(s)" 
              options={availableClasses.map(c => ({ value: c.nom, label: c.nom }))} 
              selectedIds={classNames} 
              onChange={setClassNames} 
              placeholder="Sélectionner des classes…" 
            />

            <MultiSelect 
              label="Matière(s) enseignée(s)" 
              options={availableSubjects.map(s => ({ value: s.id, label: s.nom }))} 
              selectedIds={subjectIds} 
              onChange={setSubjectIds} 
              placeholder="Sélectionner des matières…" 
            />
          </>
        )}

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 XX XX XX XX" style={inputStyle} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date d'entrée">
            <DatePicker value={dateEntree} onChange={setDateEntree} style={inputStyle} />
          </Field>
          <Field label="Salaire mensuel">
            <MoneyInput value={salaireMensuel} onChange={setSalaireMensuel} suffix="F CFA" style={inputStyle} />
          </Field>
        </div>

        <Field label="Photo (facultatif)">
          <div style={{ marginBottom: 18 }}>
            <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
          </div>
        </Field>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)',
  fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12,
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
