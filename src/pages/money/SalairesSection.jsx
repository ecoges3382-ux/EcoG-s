import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF, MODES, stickyColStyle, stickyHeaderStyle } from '../../lib/utils.js'; // 👈 Import de stickyColStyle
import Dropdown from '../../components/Dropdown.jsx';
import MoneyInput from '../../components/MoneyInput.jsx';
import DatePicker from '../../components/DatePicker.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import SelectionBar from '../../components/SelectionBar.jsx';
import { TrashIcon } from './icons.jsx';

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    months.push({ value: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

export default function SalairesSection() {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [mois, setMois] = useState(generateMonthOptions()[0].value);
  const [salaries, setSalaries] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [error, setError] = useState('');

  // 👇 NOUVEL ÉTAT POUR LA RECHERCHE 👇
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // 👇 EFFET POUR LE DEBOUNCE DE LA RECHERCHE 👇
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = salaries.map((s) => s.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} paiement${selectedIds.length > 1 ? 's' : ''} de salaire ?`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('staff_salaries').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée — probablement bloquée par une policy RLS.");
      return;
    }
    showToast(`${selectedIds.length} supprimé(s)`);
    exitSelectMode();
    reloadSalaries();
  }

  const monthOptions = generateMonthOptions();
  const COLONNES_SALAIRES = '1.5fr 1.2fr 1.2fr 1.2fr 1.2fr 110px';

  async function reloadSalaries() {
    setSalaries(null);
    
    const { data: sal, error: salErr } = await supabase
      .from('staff_salaries')
      .select('*, staff (full_name, role)')
      .eq('school_id', profile.school_id)
      .eq('mois', mois)
      .order('created_at', { ascending: false });
      
    if (salErr) setError(salErr.message);
    else setSalaries(sal || []);

    const { data: adv, error: advErr } = await supabase
      .from('salary_advances')
      .select('staff_id, solde')
      .eq('school_id', profile.school_id)
      .eq('statut', 'approuvee')
      .gt('solde', 0);
      
    if (advErr) setError(advErr.message);
    else setAdvances(adv || []);

    const { data: st } = await supabase.from('staff').select('*').eq('statut', 'actif').order('full_name');
    setStaff(st || []);
  }

  async function handleDeleteSalaire(id, nomMembre, montant) {
    if (!(await confirm(`Supprimer le paiement de ${fmtF(montant)} pour ${nomMembre} ? Cette action est irréversible.`, { confirmLabel: 'Supprimer' }))) return;
    const { data: deleted, error: deleteError } = await supabase.from('staff_salaries').delete().eq('id', id).select('id');
    if (deleteError) { setError(deleteError.message); return; }
    if (!deleted || deleted.length === 0) { setError("La suppression n'a pas été effectuée (RLS)."); return; }
    showToast('Supprimé');
    reloadSalaries();
  }

  useEffect(() => {
    reloadSalaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  if (!staff) return <div className="card-bold"><SkeletonRow count={5} /></div>;

  // 👇 FILTRAGE DU PERSONNEL POUR LA RECHERCHE 👇
  const filteredStaff = staff.filter((p) => {
    if (!debouncedSearchQuery.trim()) return true;
    const q = debouncedSearchQuery.trim().toLowerCase();
    return (p.full_name || '').toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gestion des salaires</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Les avances approuvées sont automatiquement déduites du reste à payer.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 👇 LA BARRE DE RECHERCHE EST ICI 👇 */}
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un membre..."
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 200, boxSizing: 'border-box', color: 'var(--ink)' }}
          />
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Mois :</label>
            <Dropdown value={mois} onChange={setMois} options={monthOptions} style={{ width: 180 }} />
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card-bold" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <div style={{ minWidth: 900 }}>
          {/* 👇 EN-TÊTE DU TABLEAU AVEC COLONNE FIGÉE 👇 */}
          <div style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20, zIndex: 3 }}>Membre</span>
            <span>Salaire prévu</span>
            <span>Avance à déduire</span>
            <span>Déjà payé</span>
            <span>Reste net à payer</span>
            <span></span>
          </div>
          
          {salaries === null ? (
            <SkeletonRow count={3} />
          ) : filteredStaff.length === 0 ? (
            <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre ne correspond à cette recherche.</p>
          ) : (
            filteredStaff.map((p, i) => {
              const paye = (salaries || []).filter(s => s.staff_id === p.id).reduce((acc, s) => acc + Number(s.montant), 0);
              const avanceDeduire = (advances || []).filter(a => a.staff_id === p.id).reduce((acc, a) => acc + Number(a.solde), 0);
              const prevu = Number(p.salaire_mensuel) || 0;
              const reste = prevu - paye - avanceDeduire;
              const estPaye = prevu > 0 && reste <= 0;

              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '14px 20px 14px 0', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
                  {/* 👇 CELLULE DU NOM FIGÉE ET OPAQUE 👇 */}
                  <div style={{ ...stickyColStyle('var(--paper)'), paddingLeft: 20, zIndex: 2 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.full_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{p.role}</p>
                  </div>
                  <span>{prevu > 0 ? fmtF(prevu) : '—'}</span>
                  <span style={{ color: avanceDeduire > 0 ? 'var(--amber)' : 'var(--muted)' }}>{avanceDeduire > 0 ? fmtF(avanceDeduire) : '—'}</span>
                  <span style={{ color: paye > 0 ? 'var(--success)' : 'var(--muted)', fontWeight: paye > 0 ? 600 : 400 }}>{fmtF(paye)}</span>
                  <span style={{ color: reste > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{prevu > 0 ? fmtF(reste) : '—'}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 20 }}>
                    <button onClick={() => { setSelectedStaff(p); setModalOpen(true); }} disabled={prevu <= 0 || estPaye} style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: estPaye ? 'var(--line)' : 'var(--forest)', color: estPaye ? 'var(--muted)' : '#fff', cursor: (prevu <= 0 || estPaye) ? 'default' : 'pointer', opacity: (prevu <= 0 || estPaye) ? 0.7 : 1 }}>
                      {estPaye ? 'Payé' : 'Payer'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Paiements enregistrés pour {monthOptions.find(m => m.value === mois)?.label}</p>
        {salaries && salaries.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            Sélectionner
          </button>
        )}
      </div>

      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {salaries === null && <SkeletonRow count={2} />}
        {salaries && salaries.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement de salaire ce mois-ci.</p>}
        {salaries && salaries.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {selectMode && (
                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleOne(s.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              )}
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{s.staff?.full_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                  {new Date(s.date).toLocaleDateString('fr-FR')} · {s.mode}{s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtF(s.montant)}</span>
              {!selectMode && (
                <button type="button" onClick={() => handleDeleteSalaire(s.id, s.staff?.full_name || 'ce membre', s.montant)} title="Supprimer ce paiement" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}><TrashIcon /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectMode && salaries && salaries.length > 0 && (
        <SelectionBar count={selectedIds.length} allSelected={salaries.every((s) => selectedIds.includes(s.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />
      )}

      {modalOpen && selectedStaff && (
        <PayerSalaireModal
          staffMember={selectedStaff}
          mois={mois}
          avance={advances.filter(a => a.staff_id === selectedStaff.id).reduce((acc, a) => acc + Number(a.solde), 0)}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reloadSalaries(); showToast('Salaire enregistré'); }}
        />
      )}
    </div>
  );
}

function PayerSalaireModal({ staffMember, mois, avance, onClose, onSaved }) {
  const { profile } = useAuth();
  const prevu = Number(staffMember.salaire_mensuel || 0);
  const [montant, setMontant] = useState(String(Math.max(0, prevu - avance)));
  const [mode, setMode] = useState('especes');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) { setError('Le montant doit être supérieur à 0.'); return; }
    setSubmitting(true);
    setError('');

    const { error: rpcError } = await supabase.rpc('pay_salary_with_advance_deduction', {
      p_school_id: profile.school_id,
      p_staff_id: staffMember.id,
      p_montant: Number(montant),
      p_mois: mois,
      p_date: date,
      p_mode: mode,
      p_note: note.trim() || null,
      p_created_by: profile.id,
      p_avance_a_rembourser: Number(avance) || 0,
    });

    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 400, width: '100%', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Payer le salaire</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>×</button>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>Membre : <strong>{staffMember.full_name}</strong> ({staffMember.role})</p>
        
        {avance > 0 && (
          <div style={{ background: 'var(--amber-light)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--clay-dark)', fontWeight: 600 }}>Avance approuvée à déduire : {fmtF(avance)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--clay-dark)' }}>Le montant par défaut a été ajusté. L'avance sera soldée automatiquement.</p>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Montant à payer</label>
        <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ marginBottom: 12 }} />

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Date</label>
            <DatePicker value={date} onChange={setDate} style={{ width: '100%' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Note (facultatif)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Acompte, prime..." style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 13, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
