import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { NIVEAUX, fmtF } from '../lib/utils.js';
import MoneyInput from './MoneyInput.jsx';

// Grille tarifaire (montant attendu par niveau) pour UNE année scolaire
// donnée. Utilisée à la fois dans Paramètres → Grille tarifaire (toujours
// l'année en cours) et dans l'assistant de préparation d'une nouvelle année
// (voir src/pages/PrepareSchoolYear.jsx), d'où l'extraction dans un
// composant partagé plutôt qu'une duplication.
//
// Un menu déroulant sélectionne le niveau à paramétrer (toujours synchronisé
// avec les classes réellement créées, pas la liste générique Maternelle→
// Terminale) plutôt qu'un tableau affichant tous les niveaux à la fois. Les
// frais de scolarité se saisissent par tranche (1ère/2ème/3ème) ;
// montant_scolarite reste la somme des 3, recalculée à chaque enregistrement
// — c'est toujours ce total que lisent NewStudentModal/PrepareSchoolYear
// pour pré-remplir le montant dû d'un élève.
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
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    const list = NIVEAUX.filter((n) => present.has(n));
    setNiveauxPresents(list);
    setSelected((prev) => (prev && list.includes(prev) ? prev : (list[0] || '')));
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
            .select('niveau, montant_scolarite, montant_connexe, montant_tranche1, montant_tranche2, montant_tranche3')
            .eq('school_year_id', copyFromSchoolYearId);
          if (!cancelled && previous && previous.length > 0) {
            await supabase.from('fee_schedules').insert(
              previous.map((p) => ({
                school_id: schoolId, school_year_id: schoolYear.id,
                niveau: p.niveau, montant_scolarite: p.montant_scolarite, montant_connexe: p.montant_connexe,
                montant_tranche1: p.montant_tranche1, montant_tranche2: p.montant_tranche2, montant_tranche3: p.montant_tranche3,
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

  async function saveRow(niveau, t1, t2, t3, connexe) {
    if (!schoolYear) return;
    setSaving(true);
    const existing = rows?.[niveau];
    const payload = {
      school_id: schoolId,
      school_year_id: schoolYear.id,
      niveau,
      montant_scolarite: (Number(t1) || 0) + (Number(t2) || 0) + (Number(t3) || 0),
      montant_connexe: Number(connexe) || 0,
      montant_tranche1: Number(t1) || 0,
      montant_tranche2: Number(t2) || 0,
      montant_tranche3: Number(t3) || 0,
    };
    const { error: saveError } = existing
      ? await supabase.from('fee_schedules').update(payload).eq('id', existing.id)
      : await supabase.from('fee_schedules').insert(payload);
    setSaving(false);
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

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Niveau</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          {niveauxPresents.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {selected && (
        <FeeEditor
          key={selected}
          niveau={selected}
          row={rows[selected]}
          canManage={canManage}
          saving={saving}
          onSave={saveRow}
        />
      )}
    </div>
  );
}

function FeeEditor({ niveau, row, canManage, saving, onSave }) {
  const [t1, setT1] = useState(row?.montant_tranche1 ?? 0);
  const [t2, setT2] = useState(row?.montant_tranche2 ?? 0);
  const [t3, setT3] = useState(row?.montant_tranche3 ?? 0);
  const [connexe, setConnexe] = useState(row?.montant_connexe ?? 0);

  const total = (Number(t1) || 0) + (Number(t2) || 0) + (Number(t3) || 0);
  const dirty = Number(t1) !== Number(row?.montant_tranche1 ?? 0)
    || Number(t2) !== Number(row?.montant_tranche2 ?? 0)
    || Number(t3) !== Number(row?.montant_tranche3 ?? 0)
    || Number(connexe) !== Number(row?.montant_connexe ?? 0);

  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{niveau}</p>

      <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais de scolarité</p>
      {canManage ? (
        <>
          <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <div>
              <label style={feeLabelStyle}>1ère tranche</label>
              <MoneyInput value={t1} onChange={setT1} style={feeInputStyle} />
            </div>
            <div>
              <label style={feeLabelStyle}>2ème tranche</label>
              <MoneyInput value={t2} onChange={setT2} style={feeInputStyle} />
            </div>
            <div>
              <label style={feeLabelStyle}>3ème tranche</label>
              <MoneyInput value={t3} onChange={setT3} style={feeInputStyle} />
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Total scolarité : <strong style={{ color: 'var(--ink)' }}>{fmtF(total)}</strong>
          </p>
        </>
      ) : (
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <FeeDisplay label="1ère tranche" value={row?.montant_tranche1} />
          <FeeDisplay label="2ème tranche" value={row?.montant_tranche2} />
          <FeeDisplay label="3ème tranche" value={row?.montant_tranche3} />
        </div>
      )}

      <p style={{ margin: '18px 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais connexes</p>
      {canManage ? (
        <MoneyInput value={connexe} onChange={setConnexe} style={{ ...feeInputStyle, maxWidth: 200 }} />
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{fmtF(row?.montant_connexe || 0)}</p>
      )}

      {canManage && (
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => onSave(niveau, t1, t2, t3, connexe)}
          style={{ marginTop: 16, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default' }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
    </div>
  );
}

function FeeDisplay({ label, value }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{fmtF(value || 0)}</p>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const selectStyle = { width: '100%', maxWidth: 280, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', background: 'var(--paper)' };
const feeLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const feeInputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };
