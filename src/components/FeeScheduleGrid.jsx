import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { NIVEAUX, fmtF } from '../lib/utils.js';
import MoneyInput from './MoneyInput.jsx';

// Grille tarifaire (montant attendu par niveau) pour UNE année scolaire
// donnée. Utilisée à la fois dans Argent → Grille tarifaire (toujours
// l'année en cours) et dans l'assistant de préparation d'une nouvelle année
// (voir src/pages/PrepareSchoolYear.jsx), d'où l'extraction dans un
// composant partagé plutôt qu'une duplication.
//
// copyFromSchoolYearId : si fourni et que la grille de "schoolYear" est
// encore entièrement vide, copie automatiquement celle de l'année indiquée
// comme point de départ modifiable — jamais si la grille cible a déjà au
// moins une ligne, pour ne jamais écraser une saisie existante.
export default function FeeScheduleGrid({ schoolId, schoolYear, canManage, copyFromSchoolYearId }) {
  const [rows, setRows] = useState(null);
  // Seuls les niveaux qui ont au moins une classe créée (page Classes) sont
  // proposés ici — pas la liste générique Maternelle→Terminale.
  const [niveauxPresents, setNiveauxPresents] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  async function reload() {
    if (!schoolYear) return;
    const [{ data, error: e }, { data: cl }] = await Promise.all([
      supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id),
      supabase.from('classes').select('niveau'),
    ]);
    if (e) { setError(e.message); return; }
    const map = {};
    (data || []).forEach((f) => { map[f.niveau] = f; });
    setRows(map);
    const present = new Set((cl || []).map((c) => c.niveau));
    setNiveauxPresents(NIVEAUX.filter((n) => present.has(n)));
  }

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    (async () => {
      if (copyFromSchoolYearId) {
        const { count } = await supabase
          .from('fee_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('school_year_id', schoolYear.id);
        if (!cancelled && (count || 0) === 0) {
          const { data: previous } = await supabase
            .from('fee_schedules')
            .select('niveau, montant_scolarite, montant_connexe')
            .eq('school_year_id', copyFromSchoolYearId);
          if (!cancelled && previous && previous.length > 0) {
            await supabase.from('fee_schedules').insert(
              previous.map((p) => ({
                school_id: schoolId, school_year_id: schoolYear.id,
                niveau: p.niveau, montant_scolarite: p.montant_scolarite, montant_connexe: p.montant_connexe,
              })),
            );
          }
        }
      }
      if (!cancelled) reload();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  async function saveRow(niveau, montantScolarite, montantConnexe) {
    if (!schoolYear) return;
    setSaving(niveau);
    const existing = rows?.[niveau];
    const payload = {
      school_id: schoolId,
      school_year_id: schoolYear.id,
      niveau,
      montant_scolarite: Number(montantScolarite) || 0,
      montant_connexe: Number(montantConnexe) || 0,
    };
    const { error: saveError } = existing
      ? await supabase.from('fee_schedules').update(payload).eq('id', existing.id)
      : await supabase.from('fee_schedules').insert(payload);
    setSaving('');
    if (saveError) { setError(saveError.message); return; }
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!rows || !niveauxPresents || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  if (niveauxPresents.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Aucune classe créée pour l'instant. Crée d'abord tes classes dans l'onglet{' '}
        <Link to="/classes" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Classes</Link>{' '}
        pour pouvoir configurer leur tarif ici.
      </p>
    );
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Montant attendu par niveau pour {schoolYear.label} — se pré-remplit automatiquement à
        l'inscription d'un élève.{!canManage && ' Seuls le fondateur et le directeur peuvent modifier ces montants.'}
      </p>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Niveau</span><span>Scolarité (F CFA)</span><span>Frais connexes (F CFA)</span>
          </div>
          {niveauxPresents.map((niveau, i) => (
            <FeeRow
              key={niveau}
              niveau={niveau}
              row={rows[niveau]}
              canManage={canManage}
              saving={saving === niveau}
              onSave={saveRow}
              isLast={i === niveauxPresents.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeeRow({ niveau, row, canManage, saving, onSave, isLast }) {
  const [scolarite, setScolarite] = useState(row?.montant_scolarite ?? 0);
  const [connexe, setConnexe] = useState(row?.montant_connexe ?? 0);
  const dirty = Number(scolarite) !== Number(row?.montant_scolarite ?? 0) || Number(connexe) !== Number(row?.montant_connexe ?? 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', padding: '10px 20px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid var(--line)', gap: 8 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{niveau}</span>
      {canManage ? (
        <>
          <MoneyInput value={scolarite} onChange={setScolarite} style={feeInputStyle} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MoneyInput value={connexe} onChange={setConnexe} style={feeInputStyle} />
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => onSave(niveau, scolarite, connexe)}
              style={{ fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default', flexShrink: 0 }}
            >
              {saving ? '…' : 'OK'}
            </button>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: 13 }}>{fmtF(row?.montant_scolarite || 0)}</span>
          <span style={{ fontSize: 13 }}>{fmtF(row?.montant_connexe || 0)}</span>
        </>
      )}
    </div>
  );
}

const feeInputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
