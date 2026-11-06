import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { translateError } from '../lib/errors.js';

// Formulaire de saisie d'un retard. Contrairement à l'absence, l'heure de
// début est OBLIGATOIRE (un retard est rattaché à un moment précis), et
// la durée est saisie en minutes (plus naturel : "20 minutes de retard"
// plutôt que "0h20"). La matière reste en texte libre : un retard peut
// concerner une matière non planifiée ce jour-là.
export default function LateModal({ schoolId, schoolYearId, studentId, motifs, editing, onClose, onSaved }) {
  const showToast = useToast();
  const [date, setDate] = useState(editing?.date || new Date().toISOString().slice(0, 10));
  const [heureDebut, setHeureDebut] = useState(editing?.heure_debut?.slice(0, 5) || '08:00');
  const [dureeMinutes, setDureeMinutes] = useState(editing?.duree_minutes ?? 5);
  const [matiere, setMatiere] = useState(editing?.matiere || '');
  const [motifId, setMotifId] = useState(editing?.motif_id || '');
  const [motifLibre, setMotifLibre] = useState(editing?.motif_libre || '');
  const [justifie, setJustifie] = useState(!!editing?.justifie);
  const [note, setNote] = useState(editing?.note || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedMotif = motifs.find((m) => m.id === motifId);
  useEffect(() => {
    if (!selectedMotif) return;
    if (selectedMotif.categorie === 'justifiee') setJustifie(true);
    if (selectedMotif.categorie === 'non_justifiee') setJustifie(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motifId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date) { setError('La date est obligatoire.'); return; }
    if (!heureDebut) { setError("L'heure de début est obligatoire."); return; }
    if (Number(dureeMinutes) <= 0) { setError('La durée doit être supérieure à 0.'); return; }

    setSubmitting(true);
    setError('');

    const payload = {
      school_id: schoolId,
      school_year_id: schoolYearId,
      student_id: studentId,
      date,
      heure_debut: heureDebut,
      duree_minutes: Number(dureeMinutes),
      matiere: matiere.trim() || null,
      motif_id: motifId || null,
      motif_libre: motifLibre.trim() || null,
      justifie,
      note: note.trim() || null,
    };

    const { error: saveError } = editing
      ? await supabase.from('late_events').update(payload).eq('id', editing.id)
      : await supabase.from('late_events').insert(payload);

    setSubmitting(false);
    if (saveError) { setError(translateError(saveError)); return; }
    showToast('Enregistré');
    onSaved();
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>
            {editing ? 'Modifier le retard' : 'Nouveau retard'}
          </p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <DatePicker value={date} onChange={setDate} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Heure de début</label>
            <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Durée (minutes)</label>
            <input
              type="number" min="1" max="180" step="5"
              value={dureeMinutes}
              onChange={(e) => setDureeMinutes(Math.max(1, Number(e.target.value) || 0))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Matière concernée</label>
            <input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="ex. Mathématiques" style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Motif</label>
        <Dropdown
          value={motifId}
          onChange={setMotifId}
          options={[
            { value: '', label: '— Aucun motif prédéfini —' },
            ...motifs.map((m) => ({ value: m.id, label: `${m.code}. ${m.libelle}` })),
          ]}
          style={inputStyle}
        />

        {!motifId && (
          <>
            <label style={labelStyle}>Motif libre (si aucun ne convient)</label>
            <input value={motifLibre} onChange={(e) => setMotifLibre(e.target.value)} placeholder="Précise le motif…" style={inputStyle} />
          </>
        )}

        <div style={{ display: 'flex', gap: 20, marginBottom: 12, padding: '10px 14px', background: 'var(--cream)', borderRadius: 9 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <input type="checkbox" checked={justifie} onChange={(e) => setJustifie(e.target.checked)} style={{ accentColor: 'var(--forest)', width: 16, height: 16 }} />
            Justifié
          </label>
        </div>

        <label style={labelStyle}>Note interne (optionnel)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Observation, contexte…"
          style={{ ...inputStyle, resize: 'vertical', minHeight: 50, fontFamily: 'inherit' }}
        />

        {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const btnPrimary = { padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' };
const btnSecondary = { padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' };
