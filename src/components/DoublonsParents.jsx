// Parents : signale les doublons (même nom ET même numéro) et permet de les fusionner en gardant le bon parent.
import { useMemo, useState } from 'react';
import { grouperDoublonsParents } from '../lib/parents.js';
import { fusionnerParents } from '../lib/fusionParents.js';
import { useConfirm } from './ConfirmDialog.jsx';
import { useToast } from './Toast.jsx';
import { translateError } from '../lib/errors.js';

const nb = (p) => (p.parent_access_students || []).length;
const enfants = (n) => `${n} enfant${n > 1 ? 's' : ''}`;

export default function DoublonsParents({ parents, onDone }) {
  const confirm = useConfirm();
  const showToast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const groupes = useMemo(() => grouperDoublonsParents(parents), [parents]);
  if (groupes.length === 0) return null;

  async function fusionner(groupe, gardeId) {
    const garder = groupe.membres.find((m) => m.id === gardeId);
    const autres = groupe.membres.filter((m) => m.id !== gardeId);
    const aPerdre = autres.reduce((n, m) => n + nb(m), 0);
    const message = `Garder « ${garder.full_name} » (${enfants(nb(garder))}) et fusionner ${autres.length > 1 ? `les ${autres.length} autres fiches` : "l'autre fiche"} dedans ?\n\n`
      + `• Les enfants ${aPerdre > 0 ? 'des autres fiches' : '(aucun)'} seront rattachés à la fiche gardée.\n`
      + `• Le lien d'accès des fiches supprimées cessera de fonctionner : seul le lien de la fiche gardée reste valable.\n`
      + `• Impossible de revenir en arrière.`;
    if (!(await confirm(message, { confirmLabel: 'Fusionner' }))) return;
    setOccupe(true); setErreur('');
    const r = await fusionnerParents(garder, autres);
    setOccupe(false);
    if (!r.ok) { setErreur(translateError(r.erreur)); return; }
    showToast(`Fiches fusionnées (${r.supprimes} supprimée${r.supprimes > 1 ? 's' : ''}).`);
    onDone();
  }

  return (
    <div className="card-bold" style={{ padding: '14px 18px', marginBottom: 16, borderLeft: '4px solid var(--amber)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
          <i className="ti ti-copy" style={{ marginRight: 8, color: 'var(--amber)' }} aria-hidden="true"></i>
          {groupes.length} doublon{groupes.length > 1 ? 's' : ''} possible{groupes.length > 1 ? 's' : ''} (même nom et même numéro)
        </p>
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
          {ouvert ? 'Masquer' : 'Voir et fusionner'}
        </button>
      </div>
      {erreur && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{erreur}</p>}
      {ouvert && groupes.map((g) => (
        <div key={g.cle} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          {g.membres.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
              <span style={{ fontSize: 13 }}>
                <strong>{m.full_name}</strong>
                <span style={{ color: 'var(--muted)' }}> · {m.phone} · {enfants(nb(m))}</span>
                {m.id === g.conseille && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--forest-text)' }}>Conseillé</span>}
              </span>
              <button type="button" disabled={occupe} onClick={() => fusionner(g, m.id)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: m.id === g.conseille ? 'var(--forest)' : 'var(--paper)', color: m.id === g.conseille ? '#fff' : 'var(--ink)', cursor: occupe ? 'default' : 'pointer', opacity: occupe ? 0.6 : 1 }}>
                Garder celle-ci
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
