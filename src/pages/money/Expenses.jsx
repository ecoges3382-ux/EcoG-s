import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import MoneyInput from '../../components/MoneyInput.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import OfflineBanner from '../../components/OfflineBanner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SelectionBar from '../../components/SelectionBar.jsx';
import { guardedFetch } from '../../lib/offlineCache.js';
import { translateError } from '../../lib/errors.js';
import { TrashIcon, WalletIcon } from './icons.jsx';

export default function Expenses() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = expenses.map((d) => d.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} dépense${selectedIds.length > 1 ? 's' : ''} ?`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('expenses').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) { setError("La suppression n'a pas été effectuée (RLS)."); return; }
    showToast(`${selectedIds.length} supprimée(s)`);
    exitSelectMode();
    reload();
  }

  function reload() {
    if (!schoolYear) return;
    guardedFetch({
      cacheKey: `expenses_${schoolYear.id}`,
      hasData: expenses !== null,
      load: async () => {
        const { data, error: e } = await supabase.from('expenses').select('*').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false });
        return e ? { error: e } : { data };
      },
      setData: setExpenses,
      setOffline,
      onError: (e) => setError(translateError(e)),
      onSuccess: () => setError(''),
    });
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!libelle.trim() || !montant) return;
    setSubmitting(true);
    const { error: insertError } = await supabase.from('expenses').insert({
      school_id: profile.school_id, school_year_id: schoolYear.id, libelle: libelle.trim(), categorie: categorie.trim() || 'Autre', montant: Number(montant),
    });
    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    setLibelle(''); setCategorie(''); setMontant('');
    showToast('Enregistré');
    reload();
  }

  async function handleDelete(d) {
    if (!(await confirm(`Supprimer la dépense « ${d.libelle} » (${fmtF(d.montant)}) ?`, { confirmLabel: 'Supprimer' }))) return;
    const { data: deleted, error: deleteError } = await supabase.from('expenses').delete().eq('id', d.id).select('id');
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) { setError("La suppression n'a pas été effectuée (RLS)."); return; }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!expenses || !schoolYear) return <div className="card-bold"><SkeletonRow count={4} avatar={false} /></div>;

  const total = expenses.reduce((a, d) => a + Number(d.montant), 0);

  return (
    <div>
      {offline && <OfflineBanner />}
      <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 24, maxWidth: 320 }}>
        <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>Total des dépenses — {schoolYear.label}</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(total)}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
        {canManage && expenses.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>Sélectionner</button>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="card-bold" style={{ marginBottom: 24, maxWidth: 640 }}>
          <EmptyState icon={<WalletIcon />} title="Aucune dépense enregistrée" subtitle="Utilise le formulaire ci-dessous pour enregistrer ta première dépense." />
        </div>
      ) : (
        <div className="card-bold" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)', marginBottom: 24, maxWidth: 640 }}>
          {expenses.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < expenses.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectMode && <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggleOne(d.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />}
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmtF(d.montant)}</p>
                {canManage && !selectMode && (
                  <button type="button" onClick={() => handleDelete(d)} title="Supprimer" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}><TrashIcon /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectMode && expenses.length > 0 && (
        <SelectionBar count={selectedIds.length} allSelected={expenses.every((d) => selectedIds.includes(d.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />
      )}

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé" style={{ ...smallInput, flex: '2 1 160px' }} />
        <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" style={{ ...smallInput, flex: '1 1 120px' }} />
        <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ ...smallInput, flex: '1 1 120px' }} />
        <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

const smallInput = { padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
