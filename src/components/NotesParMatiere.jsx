// Notes par matière, en tableau : une ligne par matière (moyenne, ou T1 T2 T3 + année), les notes repliées et rangées par type
// (interrogations, devoirs, examens) quand on déplie. Même présentation pour la fiche élève (équipe) et le portail parent.
// À remonter avec une `key` qui change avec la période : les lignes dépliées repartent alors repliées.
import { useState } from 'react';
import { PERIODES_BULLETIN } from '../lib/bulletin.js';
import { classifyNote } from '../lib/parentPortal.js';
import { libelleNote } from '../lib/studentGrades.js';

const fmt = (n) => Number(n).toFixed(2).replace('.', ',');
const COURT = { 'Trimestre 1': 'T1', 'Trimestre 2': 'T2', 'Trimestre 3': 'T3', 'Semestre 1': 'S1', 'Semestre 2': 'S2' };
const GROUPES = [
  { type: 'interro', titre: 'Interrogations', couleur: 'var(--forest-text)', fond: 'var(--forest-light)' },
  { type: 'devoir', titre: 'Devoirs', couleur: 'var(--clay-text)', fond: 'var(--gold-light)' },
  { type: 'examen', titre: 'Examens', couleur: 'var(--danger)', fond: 'var(--danger-light)' },
];

function couleurNote(note, sur) {
  const sur20 = (Number(note) / Number(sur)) * 20;
  if (sur20 >= 14) return 'var(--success)';
  if (sur20 < 10) return 'var(--danger)';
  return 'var(--ink)';
}
const moyenneStyle = (m) => ({ fontWeight: 700, color: m == null ? 'var(--muted)' : couleurNote(m, 20), fontVariantNumeric: 'tabular-nums' });
const cellule = { textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' };

// Un type de notes : sa pastille et son compteur, puis les notes juste en dessous, TROIS PAR LIGNE au plus (les suivantes passent
// à la ligne). Les colonnes de la grille ont la même largeur : les notes restent alignées d'une ligne à l'autre.
function GroupeNotes({ groupe, notes, annuel }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: groupe.couleur, background: groupe.fond, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{groupe.titre}</span>
        {notes.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>({notes.length})</span>}
      </div>
      {notes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Aucune note</p>
      ) : (
        <div data-notes-ligne style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 58px))', gap: 6 }}>
          {notes.map((n, i) => (
            <span key={n.id || i} title={`${groupe.titre.replace(/s$/, '')} · ${n.periode}${n.created_at ? ` · ${new Date(n.created_at).toLocaleDateString('fr-FR')}` : ''}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: '3px 2px', borderRadius: 14, background: 'var(--chip-bg)', color: couleurNote(n.note, n.sur), fontSize: 12, fontWeight: 600, opacity: groupe.type === 'examen' ? 0.75 : 1, whiteSpace: 'nowrap' }}>
              {annuel && <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.1 }}>{COURT[n.periode] || n.periode}</span>}
              {libelleNote(n)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * lignes : [{ id, nom, coefficient, notes: [{ id?, type, note, sur, periode, created_at? }], moyenne, parTrimestre: [{ periode, moyenne }] | null }]
 * total (facultatif) : { generale, appreciation, parTrimestre: [{ label, value }] } ; sans lui, pas de ligne « Moyenne générale ».
 */
export default function NotesParMatiere({ lignes, annuel, total, ariaLabel, avecExamens = true }) {
  const [ouvertes, setOuvertes] = useState(() => new Set());
  const toutesOuvertes = lignes.length > 0 && lignes.every((l) => ouvertes.has(l.id));
  const basculer = (id) => setOuvertes((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aDesExamens = avecExamens && lignes.some((l) => l.notes.some((n) => classifyNote(n) === 'examen'));
  const grille = { display: 'grid', gridTemplateColumns: annuel ? `minmax(0, 1fr) repeat(${PERIODES_BULLETIN.length}, 46px) 56px` : 'minmax(0, 1fr) 72px', columnGap: 8 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button type="button" onClick={() => setOuvertes(toutesOuvertes ? new Set() : new Set(lignes.map((l) => l.id)))}
          style={{ background: 'none', border: 'none', padding: '2px 0', fontSize: 12, fontWeight: 600, color: 'var(--forest-text)', cursor: 'pointer' }}>
          {toutesOuvertes ? 'Tout replier' : 'Tout déplier'}
        </button>
      </div>

      <div role="table" aria-label={ariaLabel}>
        <div role="row" style={{ ...grille, padding: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line-strong)' }}>
          <span role="columnheader">Matière</span>
          {annuel
            ? <>{PERIODES_BULLETIN.map((p) => <span key={p} role="columnheader" style={{ textAlign: 'right' }}>{COURT[p]}</span>)}<span role="columnheader" style={{ textAlign: 'right' }}>Année</span></>
            : <span role="columnheader" style={{ textAlign: 'right' }}>Moyenne</span>}
        </div>

        {lignes.map((l) => {
          const ouverte = ouvertes.has(l.id);
          return (
            <div key={l.id} role="row" style={{ borderBottom: '1px solid var(--line)' }}>
              <button type="button" aria-expanded={ouverte} onClick={() => basculer(l.id)}
                style={{ ...grille, width: '100%', padding: '11px 0', background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', alignItems: 'center' }}>
                <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: 14, color: 'var(--muted)', transition: 'transform .15s', transform: ouverte ? 'rotate(90deg)' : 'none' }}>›</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.nom}</span>
                    {l.coefficient != null && l.coefficient !== '' && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>coef. {l.coefficient}</span>}
                  </span>
                </span>
                {annuel && (l.parTrimestre || []).map((t) => (
                  <span key={t.periode} role="cell" style={{ ...cellule, color: t.moyenne == null ? 'var(--muted)' : couleurNote(t.moyenne, 20) }}>{t.moyenne == null ? '—' : fmt(t.moyenne)}</span>
                ))}
                <span role="cell" style={{ ...cellule, fontSize: 14, ...moyenneStyle(l.moyenne) }}>{l.moyenne == null ? '—' : fmt(l.moyenne)}</span>
              </button>

              {ouverte && (() => {
                const parType = (t) => l.notes.filter((n) => classifyNote(n) === t);
                const examens = parType('examen');
                return (
                  <div style={{ padding: '2px 0 14px' }}>
                    {/* Interrogations et devoirs sur la même ligne, leurs notes juste en dessous */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <GroupeNotes groupe={GROUPES[0]} notes={parType('interro')} annuel={annuel} />
                      <GroupeNotes groupe={GROUPES[1]} notes={parType('devoir')} annuel={annuel} />
                    </div>
                    {examens.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                        <GroupeNotes groupe={GROUPES[2]} notes={examens} annuel={annuel} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {total && (
          <div role="row" style={{ ...grille, alignItems: 'baseline', paddingTop: 12, borderTop: '2px solid var(--line-strong)', marginTop: -1 }}>
            <span role="cell" style={{ fontSize: 13.5, fontWeight: 700 }}>
              Moyenne générale{annuel ? ' (année)' : ''}<span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>sur 20</span>
              {total.appreciation && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{total.appreciation}</span>}
            </span>
            {annuel && (total.parTrimestre || []).map((p) => (
              <span key={p.label} role="cell" style={{ ...cellule, fontWeight: 600, color: p.value == null ? 'var(--muted)' : couleurNote(p.value, 20) }}>{p.value == null ? '—' : fmt(p.value)}</span>
            ))}
            <span role="cell" style={{ ...cellule, fontSize: 16, color: total.generale == null ? 'var(--muted)' : 'var(--forest-text)', fontWeight: 700 }}>
              {total.generale == null ? '—' : fmt(total.generale)}
            </span>
          </div>
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>Notes sur 20, sauf barème indiqué (ex. 8/10).</p>
      {aDesExamens && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>Les examens sont affichés mais ne comptent pas dans la moyenne du trimestre.</p>}
    </div>
  );
}
