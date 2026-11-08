import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { translateError } from '../lib/errors.js';

export default function AbsenceModal({ schoolId, schoolYearId, studentId, motifs, editing, onClose, onSaved }) {
  const showToast = useToast();
  const [date, setDate] = useState(editing?.date || new Date().toISOString().slice(0, 10));
  const [demiJournee, setDemiJournee] = useState(editing?.demi_journee || 'journee');
  const [heureDebut, setHeureDebut] = useState(editing?.heure_debut?.slice(0, 5) || '');
  const [heureFin, setHeureFin] = useState(editing?.heure_fin?.slice(0, 5) || '');
  const [dureeH, setDureeH] = useState(() => Math.floor(Number(editing?.duree_heures) || 0));
  const [dureeM, setDureeM] = useState(() => {
    const total = Number(editing?.duree_heures) || 0;
    return Math.round((total - Math.floor(total)) * 60 / 15) * 15;
  });
  const [motifId, setMotifId] = useState(editing?.motif_id || '');
  const [motifLibre, setMotifLibre] = useState(editing?.motif_libre || '');
  const [justifie, setJustifie] = useState(!!editing?.justifie);
  const [sante, setSante] = useState(!!editing?.sante);
  const [note, setNote] = useState(editing?.note || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedMotif = motifs.find((m) => m.id === motifId);
  useEffect(() => {
    if (!selectedMotif) return;
    if (selectedMotif.categorie === 'justifiee') setJustifie(true);
    if (selectedMotif.categorie === 'non_justifiee') setJustifie(false);
    if (selectedMotif.categorie === 'non_imputable') setJustifie(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motifId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date) { setError('La date est obligatoire.'); return; }

    setSubmitting(true);
    setError('');

    const dureeTotale = Number(dureeH) + Number(dureeM) / 60;

    const payload = {
      school_id: schoolId,
      school_year_id: schoolYearId,
      student_id: studentId,
      date,
      demi_journee: demiJournee,
      heure_debut: heureDebut || null,
      heure_fin: heureFin || null,
      duree_heures: dureeTotale,
      motif_id: motifId || null,
      motif_libre: motifLibre.trim() || null,
      justifie,
      sante,
      note: note.trim() || null,
    };

    const { error: saveError } = editing
      ? await supabase.from('absence_events').update(payload).eq('id', editing.id)
      : await supabase.from('absence_events').insert(payload);

    setSubmitting(false);
    if (saveError) { setError(translateError(saveError)); return; }
    showToast('Enregistré');

    // 🚀 NOUVEAU : Envoi de la notification push
    if (!editing) { // On ne notifie que si c'est une NOUVELLE absence
      try {
        await supabase.functions.invoke('send-absence-push', {
          body: {
            student_id: studentId,
            date: date,
            demi_journee: demiJournee,
            school_id: schoolId
          }
        });
      } catch (err) {
        console.warn("Erreur d'envoi de la notification d'absence :", err);
      }
    }

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
            {editing ? "Modifier l'absence" : 'Nouvelle absence'}
          </p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <DatePicker value={date} onChange={setDate} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Demi-journée</label>
            <Dropdown
              value={demiJournee}
              onChange={setDemiJournee}
              options={[
                { value: 'matin', label: 'Matin' },
                { value: 'apres_midi', label: 'Après-midi' },
                { value: 'journee', label: 'Journée entière' },
              ]}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Heure de début (optionnel)</label>
            <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Heure de fin (optionnel)</label>
            <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Durée manquée</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="number" min="0" max="12" step="1"
            value={dureeH}
            onChange={(e) => setDureeH(Math.max(0, Number(e.target.value) || 0))}
            style={{ ...inputStyle, flex: 1, marginBottom: 0, textAlign: 'center' }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>h</span>
          <input
            type="number" min="0" max="45" step="15"
            value={dureeM}
            onChange={(e) => setDureeM(Math.max(0, Math.min(45, Number(e.target.value) || 0)))}
            style={{ ...inputStyle, flex: 1, marginBottom: 0, textAlign: 'center' }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>min</span>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <input type="checkbox" checked={sante} onChange={(e) => setSante(e.target.checked)} style={{ accentColor: 'var(--forest)', width: 16, height: 16 }} />
            Lié à la santé
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
