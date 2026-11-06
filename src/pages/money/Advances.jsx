import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import Dropdown from '../../components/Dropdown.jsx';
import MoneyInput from '../../components/MoneyInput.jsx';
import AmountAwareTextarea from '../../components/AmountAwareTextarea.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import OfflineBanner from '../../components/OfflineBanner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SelectionBar from '../../components/SelectionBar.jsx';
import { guardedFetch } from '../../lib/offlineCache.js';
import { translateError } from '../../lib/errors.js';
import { PencilIcon, TrashIcon, UsersIcon, MoneyIcon } from './icons.jsx';

export default function Advances() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [advances, setAdvances] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = advances.map((a) => a.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} avance${selectedIds.length > 1 ? 's' : ''} ?`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('salary_advances').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) { setError("La suppression n'a pas été effectuée (RLS)."); return; }
    showToast(`${selectedIds.length} supprimée(s)`);
    exitSelectMode();
    reload();
  }

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `advances_${schoolYear.id}`,
      hasData: advances !== null,
      load: async () => {
        const { data, error: e } = await supabase.from('salary_advances').select('*, staff ( full_name, role )').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false });
        return e ? { error: e } : { data };
      },
      setData: setAdvances,
      setOffline,
      onError: (e) => setError(translateError(e)),
      onSuccess: () => setError(''),
    });
    const { data: st } = await supabase.from('staff').select('id, full_name, role').eq('statut', 'actif').order('full_name');
    setStaff(st || []);
    if (st?.length && !staffId) setStaffId(st[0].id);
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !montant) return;
    setSubmitting(true);
    const amount = Number(montant);
    const { error: insertError } = await supabase.from('salary_advances').insert({
      school_id: profile.school_id, school_year_id: schoolYear.id, staff_id: staffId, montant: amount, solde: amount, statut: 'attente_fondateur', motif: motif.trim() || null,
    });
    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    setMontant(''); setMotif('');
    showToast('Enregistré');
    reload();
  }

  async function decide(id, statut) {
    const { error: updateError } = await supabase.from('salary_advances').update({ statut }).eq('id', id);
    if (updateError) setError(translateError(updateError));
    else { showToast('Enregistré'); reload(); }
  }

  async function markPaid(a) {
    if (!(await confirm(`Marquer cette avance de ${fmtF(a.montant)} pour ${a.staff?.full_name || 'ce membre'} comme payée ?`, { confirmLabel: 'Marquer comme payé' }))) return;
    const { error: updateError } = await supabase.from('salary_advances').update({ montant_rembourse: a.montant }).eq('id', a.id);
    if (updateError) setError(translateError(updateError));
    else { showToast('Avance marquée comme payée'); reload(); }
  }

  async function handleDelete(a) {
    const rembourse = Number(a.montant_rembourse) || 0;
    const message = rembourse > 0
      ? `Cette avance a déjà été remboursée à hauteur de ${fmtF(rembourse)}. La supprimer effacera aussi cet historique. Continuer ?`
      : `Supprimer cette demande d'avance de ${fmtF(a.montant)} ?`;
    if (!(await confirm(message, { confirmLabel: 'Supprimer' }))) return;
    const { data: deleted, error: deleteError } = await supabase.from('salary_advances').delete().eq('id', a.id).select('id');
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) { setError("La suppression n'a pas été effectuée (RLS)."); return; }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!advances || !schoolYear) return <div className="card-bold"><SkeletonRow count={4} avatar={false} /></div>;

  const canDecide = profile.role === 'fondateur' || profile.role === 'directeur';

  return (
    <div>
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 600 }}>
          Le fondateur et le directeur peuvent approuver, refuser, modifier ou supprimer une demande. Demandes de l'année {schoolYear.label}.
        </p>
        {canDecide && advances.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>Sélectionner</button>
        )}
      </div>

      {advances.length === 0 ? (
        <div className="card-bold" style={{ marginBottom: 20 }}>
          {staff.length === 0 ? (
            <EmptyState icon={<UsersIcon />} title="Aucun membre du personnel" subtitle="Les avances se font pour les membres du personnel." actionLabel="Aller vers Personnel" actionTo="/personnel" />
          ) : (
            <EmptyState icon={<MoneyIcon />} title="Aucune demande d'avance" subtitle="Les demandes d'avance de ton équipe apparaîtront ici." />
          )}
        </div>
      ) : (
        <div className="card-bold" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)', marginBottom: 20 }}>
          {advances.map((a, i) => (
            <div key={a.id} style={{ padding: '13px 20px', borderBottom: i < advances.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {canDecide && selectMode && (
                    <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleOne(a.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  )}
                  <div>
                    <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{a.staff?.full_name || '—'}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}> · {a.staff?.role}</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtF(a.montant)}{a.statut === 'approuvee' && Number(a.solde) > 0 ? ` (reste ${fmtF(a.solde)})` : ''}</span>
              </div>
              {a.motif && <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: 'var(--muted)', paddingLeft: selectMode ? 28 : 0 }}>{a.motif}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingLeft: selectMode ? 28 : 0 }}>
                <StatusBadge statut={a.statut} solde={a.solde} montant={a.montant} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!selectMode && canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
                    <>
                      <button onClick={() => decide(a.id, 'approuvee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>Approuver</button>
                      <button onClick={() => decide(a.id, 'refusee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>Refuser</button>
                    </>
                  )}
                  {!selectMode && canDecide && a.statut === 'approuvee' && Number(a.solde ?? a.montant) > 0 && (
                    <button onClick={() => markPaid(a)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>
                      <i className="ti ti-check" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Marquer comme payé
                    </button>
                  )}
                  {!selectMode && canDecide && (
                    <>
                      <button onClick={() => setEditingAdvance(a)} title="Modifier" style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}><PencilIcon /></button>
                      <button onClick={() => handleDelete(a)} title="Supprimer" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}><TrashIcon /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectMode && advances.length > 0 && (
        <SelectionBar count={selectedIds.length} allSelected={advances.every((a) => selectedIds.includes(a.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />
      )}

      {staff.length > 0 ? (
        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
          <Dropdown value={staffId} onChange={setStaffId} options={staff.map((p) => ({ value: p.id, label: `${p.full_name} (${p.role})` }))} style={smallInput} wrapperStyle={{ flex: '2 1 180px', width: 'auto' }} />
          <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ ...smallInput, flex: '1 1 120px' }} />
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (facultatif)" style={{ ...smallInput, flex: '2 1 160px' }} />
          <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Envoi…' : 'Nouvelle demande'}
          </button>
        </form>
      ) : (
        <p className="card-bold" style={{ padding: '18px 20px', margin: 0, fontSize: 13, color: 'var(--muted)', marginTop: 24 }}>
          Aucun membre du personnel enregistré. <Link to="/personnel" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Personnel</Link>.
        </p>
      )}

      {editingAdvance && (
        <EditAdvanceModal advance={editingAdvance} staff={staff} onClose={() => setEditingAdvance(null)} onSaved={() => { setEditingAdvance(null); showToast('Modifié'); reload(); }} />
      )}
    </div>
  );
}

function EditAdvanceModal({ advance, staff, onClose, onSaved }) {
  const [staffId, setStaffId] = useState(advance.staff_id);
  const [montant, setMontant] = useState(String(advance.montant));
  const [motif, setMotif] = useState(advance.motif || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const rembourse = Number(advance.montant_rembourse) || 0;

  const staffOptions = (() => {
    const opts = staff.map((p) => ({ value: p.id, label: `${p.full_name} (${p.role})` }));
    if (advance.staff_id && !opts.find((o) => o.value === advance.staff_id)) {
      opts.unshift({ value: advance.staff_id, label: `${advance.staff?.full_name || '—'}${advance.staff?.role ? ` (${advance.staff.role})` : ''} — inactif` });
    }
    return opts;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(montant);
    if (!staffId) { setError('Sélectionne un membre.'); return; }
    if (!amount || amount <= 0) { setError('Le montant doit être supérieur à 0.'); return; }
    if (rembourse > 0 && amount < rembourse) { setError(`Le montant ne peut pas être inférieur au montant déjà remboursé (${fmtF(rembourse)}).`); return; }
    setSubmitting(true);
    setError('');
    const newSolde = Math.max(amount - rembourse, 0);
    const { error: updateError } = await supabase.from('salary_advances').update({ staff_id: staffId, montant: amount, solde: newSolde, motif: motif.trim() || null }).eq('id', advance.id);
    setSubmitting(false);
    if (updateError) { setError(translateError(updateError)); return; }
    onSaved();
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Modifier l'avance</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <label style={modalLabelStyle}>Membre du personnel</label>
        <Dropdown value={staffId} onChange={setStaffId} options={staffOptions} style={modalInputStyle} />

        <label style={modalLabelStyle}>Montant</label>
        <MoneyInput value={montant} onChange={setMontant} style={modalInputStyle} suffix="F CFA" />

        <label style={modalLabelStyle}>Motif</label>
        <AmountAwareTextarea value={motif} onChange={setMotif} multiline={false} style={modalInputStyle} />

        {rembourse > 0 && <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: 'var(--muted)' }}>Déjà remboursé : {fmtF(rembourse)} — le solde restant sera recalculé.</p>}
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

function StatusBadge({ statut, solde, montant }) {
  if (statut === 'approuvee' && Number(solde ?? montant) <= 0) {
    return <span style={{ background: 'var(--forest-light)', color: 'var(--forest)', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>Payée</span>;
  }
  const map = {
    approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
    refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
    attente_directeur: { label: 'Attente directeur', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
    attente_fondateur: { label: 'Attente fondateur', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  };
  const s = map[statut] || map.attente_fondateur;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>{s.label}</span>;
}

const smallInput = { padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
const modalInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const modalLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
