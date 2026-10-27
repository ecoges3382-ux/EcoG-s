import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, MODES, TRANCHES, TYPES_FRAIS } from '../lib/utils.js';
import MoneyInput from './MoneyInput.jsx';
import AmountAwareTextarea from './AmountAwareTextarea.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { useToast } from './Toast.jsx';
import { translateError } from '../lib/errors.js';

export default function QuickPaymentModal({ student, onClose, onSaved }) {
  const showToast = useToast();
  const { profile } = useAuth();
  const [typeFrais, setTypeFrais] = useState('scolarite');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [tranche, setTranche] = useState('complet');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!montant) { setError('Le montant est obligatoire.'); return; }
    
    setSubmitting(true);
    setError('');
    
    const { error: insertError } = await supabase.from('payments').insert({
      school_id: profile.school_id, 
      school_year_id: student.school_year_id,
      student_id: student.id, 
      type_frais: typeFrais, 
      montant: Number(montant), 
      mode, 
      tranche, 
      date, 
      note: note.trim() || null,
      idempotency_key: idempotencyKey,
    });

    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    showToast('Paiement enregistré');
    onSaved();
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Encaisser un paiement</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: 'var(--forest-light)', padding: '12px 16px', borderRadius: 10, marginBottom: 18 }}>
          <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>Élève sélectionné</p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--forest-dark)' }}>{student.full_name} · {student.niveau}</p>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Type de frais</label>
            <Dropdown value={typeFrais} onChange={setTypeFrais} options={TYPES_FRAIS.filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Montant</label>
            <MoneyInput value={montant} onChange={setMontant} style={inputStyle} suffix="F CFA" />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tranche</label>
            <Dropdown value={tranche} onChange={setTranche} options={TRANCHES.map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <DatePicker value={date} onChange={setDate} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Note (facultatif)</label>
            <AmountAwareTextarea value={note} onChange={setNote} multiline={false} style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
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

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
