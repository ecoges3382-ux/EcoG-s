// Recouvrement : liste du jour des rappels WhatsApp automatiques en attente de validation (réservé au fondateur).
// La fonction serveur cron-reminders prépare cette liste chaque matin quand le réglage « Me demander de valider avant l'envoi »
// est activé. Le fondateur valide (part au prochain passage), refuse (ne part jamais), ou ne fait rien : à l'heure limite, tout
// ce qui n'est pas refusé part tout seul. Voir src/lib/validationRappels.js.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';
import { decrireRappel, heureLimiteBenin, jourUtc } from '../lib/validationRappels.js';

const STATUTS = {
  a_valider: { label: 'En attente', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  valide: { label: 'Validé', bg: 'var(--success-light)', fg: 'var(--success)' },
  refuse: { label: 'Refusé', bg: 'var(--danger-light)', fg: 'var(--danger)' },
};

export default function RappelsAValider({ schoolId, visible }) {
  const showToast = useToast();
  const [lignes, setLignes] = useState(null); // null = lecture en cours ; [] = rien à valider
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('rappels_a_valider')
      .select('id, statut, contenu, template_name, students ( full_name ), parent_access ( full_name, nom )')
      .eq('school_id', schoolId)
      .eq('jour', jourUtc())
      .in('statut', ['a_valider', 'valide', 'refuse'])
      .order('created_at');
    setLignes(error ? [] : (data || [])); // table absente (base pas à jour) : rien à afficher
  }, [schoolId]);

  useEffect(() => { if (visible) charger(); }, [visible, charger]);

  async function decider(ids, statut) {
    if (ids.length === 0) return;
    setOccupe(true);
    const { data, error } = await supabase.from('rappels_a_valider').update({ statut, decide_le: new Date().toISOString() }).in('id', ids).select('id');
    setOccupe(false);
    if (error) { showToast(error.message); return; }
    if ((data || []).length < ids.length) showToast('Certains rappels sont déjà partis ou annulés : la liste est mise à jour.');
    await charger();
  }

  if (!visible || !lignes || lignes.length === 0) return null;
  const enAttente = lignes.filter((l) => l.statut === 'a_valider');
  const valides = lignes.filter((l) => l.statut === 'valide').length;
  const refuses = lignes.filter((l) => l.statut === 'refuse').length;
  const bouton = (couleur) => ({ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: couleur === 'plein' ? 'none' : '1px solid var(--line-strong)', background: couleur === 'plein' ? 'var(--forest)' : 'var(--paper)', color: couleur === 'plein' ? '#fff' : 'var(--ink)', cursor: occupe ? 'default' : 'pointer', opacity: occupe ? 0.6 : 1 });

  return (
    <div className="card-bold" style={{ padding: 20, marginBottom: 20, borderLeft: '4px solid var(--amber)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
        <i className="ti ti-bell-ringing" style={{ marginRight: 8, color: 'var(--amber)' }} aria-hidden="true"></i>
        {lignes.length} rappel{lignes.length > 1 ? 's' : ''} WhatsApp à valider aujourd'hui
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        {enAttente.length} en attente, {valides} validé{valides > 1 ? 's' : ''}, {refuses} refusé{refuses > 1 ? 's' : ''}. Sans réponse de votre part,
        tout ce qui n'est pas refusé part automatiquement à {heureLimiteBenin()} h (heure du Bénin).
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" disabled={occupe || enAttente.length === 0} onClick={() => decider(enAttente.map((l) => l.id), 'valide')} style={bouton('plein')}>Tout valider</button>
        <button type="button" disabled={occupe || enAttente.length === 0} onClick={() => decider(enAttente.map((l) => l.id), 'refuse')} style={bouton('contour')}>Tout refuser</button>
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} style={{ ...bouton('contour'), marginLeft: 'auto' }}>{ouvert ? 'Masquer la liste' : 'Voir la liste'}</button>
      </div>
      {ouvert && lignes.map((l) => {
        const st = STATUTS[l.statut];
        const parent = l.parent_access?.nom || l.parent_access?.full_name || 'Parent';
        return (
          <div key={l.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>
                <strong>{l.students?.full_name || 'Élève'}</strong>
                <span style={{ color: 'var(--muted)' }}> · {parent} · {decrireRappel(l.template_name)}</span>
              </span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.label}</span>
                {l.statut !== 'valide' && <button type="button" disabled={occupe} onClick={() => decider([l.id], 'valide')} style={{ ...bouton('contour'), padding: '5px 10px', fontSize: 12 }}>Valider</button>}
                {l.statut !== 'refuse' && <button type="button" disabled={occupe} onClick={() => decider([l.id], 'refuse')} style={{ ...bouton('contour'), padding: '5px 10px', fontSize: 12 }}>Refuser</button>}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{l.contenu}</p>
          </div>
        );
      })}
    </div>
  );
}
