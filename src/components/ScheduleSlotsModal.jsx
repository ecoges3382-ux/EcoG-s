import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';

// Gestion des créneaux horaires de l'école (schedule_slots) — la grille de
// l'emploi du temps était figée à 5 créneaux fixes 8h-16h, jamais
// adaptable à une école qui commence plus tôt, finit plus tard, ou
// fonctionne avec un nombre de périodes différent. Une ligne par créneau,
// ordre explicite modifiable par flèches haut/bas — même principe que les
// listes réordonnables du reste de l'app (aucune n'utilise le glisser-
// déposer, toujours des boutons simples).
export default function ScheduleSlotsModal({ schoolId, slots, onClose, onChanged }) {
  const showToast = useToast();
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    setError('');
    const maxOrdre = slots.reduce((m, s) => Math.max(m, s.ordre), -1);
    const { error: insertError } = await supabase.from('schedule_slots').insert({
      school_id: schoolId, label: newLabel.trim(), ordre: maxOrdre + 1,
    });
    setAdding(false);
    if (insertError) { setError(insertError.message); return; }
    setNewLabel('');
    showToast('Enregistré');
    onChanged();
  }

  async function handleDelete(slot) {
    if (!window.confirm(`Supprimer le créneau "${slot.label}" ? Les cours qui y sont associés seront aussi supprimés.`)) return;
    const { error: deleteError } = await supabase.from('schedule_slots').delete().eq('id', slot.id);
    if (deleteError) { setError(deleteError.message); return; }
    onChanged();
  }

  async function handleRename(slot, label) {
    if (!label.trim() || label.trim() === slot.label) return;
    const { error: updateError } = await supabase.from('schedule_slots').update({ label: label.trim() }).eq('id', slot.id);
    if (updateError) { setError(updateError.message); return; }
    showToast('Enregistré');
    onChanged();
  }

  async function handleMove(slot, direction) {
    const sorted = [...slots].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((s) => s.id === slot.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    setError('');
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('schedule_slots').update({ ordre: other.ordre }).eq('id', slot.id),
      supabase.from('schedule_slots').update({ ordre: slot.ordre }).eq('id', other.id),
    ]);
    if (e1 || e2) { setError((e1 || e2).message); return; }
    onChanged();
  }

  const sorted = [...slots].sort((a, b) => a.ordre - b.ordre);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Créneaux horaires</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Les créneaux s'appliquent à toute l'école, quelle que soit l'année scolaire.
        </p>

        {sorted.map((slot, i) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            canMoveUp={i > 0}
            canMoveDown={i < sorted.length - 1}
            onRename={(label) => handleRename(slot, label)}
            onMove={(dir) => handleMove(slot, dir)}
            onDelete={() => handleDelete(slot)}
          />
        ))}
        {sorted.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>Aucun créneau pour l'instant.</p>}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="ex. 8h-9h"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)' }}
          />
          <button type="submit" disabled={adding || !newLabel.trim()} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', opacity: adding || !newLabel.trim() ? 0.6 : 1 }}>
            Ajouter
          </button>
        </form>

        {error && <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <button
          type="button"
          onClick={onClose}
          style={{ width: '100%', marginTop: 18, padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function SlotRow({ slot, canMoveUp, canMoveDown, onRename, onMove, onDelete }) {
  const [label, setLabel] = useState(slot.label);
  const dirty = label.trim() !== slot.label;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button type="button" disabled={!canMoveUp} onClick={() => onMove(-1)} style={arrowStyle(canMoveUp)} title="Monter">
          <i className="ti ti-chevron-up" style={{ fontSize: 13 }} aria-hidden="true"></i>
        </button>
        <button type="button" disabled={!canMoveDown} onClick={() => onMove(1)} style={arrowStyle(canMoveDown)} title="Descendre">
          <i className="ti ti-chevron-down" style={{ fontSize: 13 }} aria-hidden="true"></i>
        </button>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => dirty && onRename(label)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onRename(label); } }}
        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)' }}
      />
      <button type="button" onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }} title="Supprimer">
        <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
      </button>
    </div>
  );
}

function arrowStyle(enabled) {
  return { background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default', color: enabled ? 'var(--ink)' : 'var(--line-strong)', padding: 0, lineHeight: 1 };
}
