import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// classes/enseignants/slots sont désormais des vraies références
// (classe_id/enseignant_id/slot_id) au lieu de texte libre — nécessaire
// pour que la détection de conflit ci-dessous soit fiable (deux
// orthographes différentes du même enseignant ne "matchaient" jamais avec
// du texte). editing (optionnel) bascule le formulaire en modification,
// même patron que ClassModal/SubjectModal.
export default function NewScheduleEntryModal({ schoolId, schoolYearId, classes, teachers, slots, editing, onClose, onSaved }) {
  const [jour, setJour] = useState(editing?.jour || JOURS[0]);
  const [slotId, setSlotId] = useState(editing?.slot_id || slots[0]?.id || '');
  const [classeId, setClasseId] = useState(editing?.classe_id || classes[0]?.id || '');
  const [matiere, setMatiere] = useState(editing?.matiere || '');
  const [enseignantId, setEnseignantId] = useState(editing?.enseignant_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (classes.length === 0) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucune classe créée</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Il faut d'abord créer au moins une classe avant de pouvoir lui assigner un créneau.
          </p>
          <Link
            to="/classes"
            onClick={onClose}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}
          >
            Aller créer une classe
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
  if (slots.length === 0) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucun créneau configuré</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Configure d'abord les créneaux horaires de l'école (bouton « Gérer les créneaux »).
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // Vérifie AVANT d'écrire qu'aucun conflit n'existe — la contrainte
  // d'unicité posée en base (schema.sql) reste le vrai garde-fou (contre
  // un appel concurrent), mais un message clair ici évite de faire
  // découvrir un conflit par une erreur SQL brute.
  async function checkConflict() {
    let query = supabase
      .from('schedule_entries')
      .select('id, classe_id, enseignant_id, matiere, classes ( nom ), staff ( full_name )')
      .eq('school_year_id', schoolYearId)
      .eq('jour', jour)
      .eq('slot_id', slotId);
    if (editing) query = query.neq('id', editing.id);
    const { data, error: queryError } = await query;
    if (queryError) return queryError.message;
    const classeConflict = (data || []).find((e) => e.classe_id === classeId);
    if (classeConflict) return `Cette classe a déjà « ${classeConflict.matiere} » à ce créneau ce jour-là.`;
    if (enseignantId) {
      const teacherConflict = (data || []).find((e) => e.enseignant_id === enseignantId);
      if (teacherConflict) return `Cet enseignant est déjà sur ${teacherConflict.classes?.nom || 'une autre classe'} à ce créneau ce jour-là.`;
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matiere.trim()) {
      setError('La matière est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');

    const conflict = await checkConflict();
    if (conflict) {
      setSubmitting(false);
      setError(conflict);
      return;
    }

    const payload = {
      jour, slot_id: slotId, classe_id: classeId, matiere: matiere.trim(),
      enseignant_id: enseignantId || null,
    };
    const { error: saveError } = editing
      ? await supabase.from('schedule_entries').update(payload).eq('id', editing.id)
      : await supabase.from('schedule_entries').insert({ school_id: schoolId, school_year_id: schoolYearId, ...payload });
    setSubmitting(false);
    if (saveError) {
      // 23505 = la contrainte d'unicité en base a intercepté une course
      // (deux onglets, même créneau) que la vérification ci-dessus n'a pas
      // vue — message générique mais toujours clair, jamais l'erreur SQL brute.
      setError(saveError.code === '23505' ? 'Ce créneau est déjà pris (classe ou enseignant).' : saveError.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier le créneau' : 'Ajouter un créneau'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Jour</label>
            <select value={jour} onChange={(e) => setJour(e.target.value)} style={inputStyle}>
              {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Créneau</label>
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} style={inputStyle}>
              {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)} style={inputStyle}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Enseignant</label>
            <select value={enseignantId} onChange={(e) => setEnseignantId(e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>Matière</label>
        <input value={matiere} onChange={(e) => setMatiere(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
