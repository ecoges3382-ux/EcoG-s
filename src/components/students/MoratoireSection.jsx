import { useState } from 'react';
import { fmtF } from '../../lib/utils.js';
import MoneyInput from '../MoneyInput.jsx';
import DatePicker from '../DatePicker.jsx';
import AmountAwareTextarea from '../AmountAwareTextarea.jsx';

function InfoRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function actionLabel(action) {
  const map = {
    creation: 'Création',
    modification: 'Modification',
    retrait_auto: 'Retrait automatique',
    retrait_manuel: 'Retrait manuel',
  };
  return map[action] || action;
}

function actionColor(action) {
  if (action === 'creation') return 'var(--success)';
  if (action === 'modification') return 'var(--amber)';
  if (action === 'retrait_auto') return 'var(--muted)';
  if (action === 'retrait_manuel') return 'var(--danger)';
  return 'var(--muted)';
}

export default function MoratoireSection({ enrollment, history, canEdit, onSave }) {
  const estActif = !!(enrollment.moratoire_actif || (enrollment.note_arrangement && enrollment.note_arrangement.trim()));
  const [editing, setEditing] = useState(false);
  const [actif, setActif] = useState(estActif);
  const [motif, setMotif] = useState(enrollment.moratoire_motif || '');
  const [montantConvenu, setMontantConvenu] = useState(enrollment.moratoire_montant_convenu ?? '');
  const [nbMensualites, setNbMensualites] = useState(enrollment.moratoire_nb_mensualites ?? '');
  const [dateDebut, setDateDebut] = useState(enrollment.moratoire_date_debut || '');
  const [dateFin, setDateFin] = useState(enrollment.moratoire_date_fin || '');
  const [prochaineEcheance, setProchaineEcheance] = useState(enrollment.moratoire_prochaine_echeance || '');
  const [note, setNote] = useState(enrollment.note_arrangement || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      actif,
      motif,
      montantConvenu,
      nbMensualites,
      dateDebut,
      dateFin,
      prochaineEcheance,
      note,
    });
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setActif(estActif);
    setMotif(enrollment.moratoire_motif || '');
    setMontantConvenu(enrollment.moratoire_montant_convenu ?? '');
    setNbMensualites(enrollment.moratoire_nb_mensualites ?? '');
    setDateDebut(enrollment.moratoire_date_debut || '');
    setDateFin(enrollment.moratoire_date_fin || '');
    setProchaineEcheance(enrollment.moratoire_prochaine_echeance || '');
    setNote(enrollment.note_arrangement || '');
    setEditing(false);
  }

  function handleOpenEdit() {
    setActif(estActif);
    setMotif(enrollment.moratoire_motif || '');
    setMontantConvenu(enrollment.moratoire_montant_convenu ?? '');
    setNbMensualites(enrollment.moratoire_nb_mensualites ?? '');
    setDateDebut(enrollment.moratoire_date_debut || '');
    setDateFin(enrollment.moratoire_date_fin || '');
    setProchaineEcheance(enrollment.moratoire_prochaine_echeance || '');
    setNote(enrollment.note_arrangement || '');
    setEditing(true);
  }

  if (!canEdit && !estActif) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
          Moratoire / Arrangement de paiement
        </p>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={handleOpenEdit}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            {estActif ? 'Modifier le moratoire' : 'Créer un moratoire'}
          </button>
        )}
      </div>

      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 640 }}>
        {!editing ? (
          estActif ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>Moratoire actif</span>
                {enrollment.moratoire_date_fin && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>fin le {new Date(enrollment.moratoire_date_fin).toLocaleDateString('fr-FR')}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
                {enrollment.moratoire_motif && <InfoRow label="Motif" value={enrollment.moratoire_motif} />}
                {enrollment.moratoire_montant_convenu != null && <InfoRow label="Montant convenu" value={fmtF(enrollment.moratoire_montant_convenu)} />}
                {enrollment.moratoire_nb_mensualites != null && <InfoRow label="Mensualités" value={String(enrollment.moratoire_nb_mensualites)} />}
                {enrollment.moratoire_date_debut && <InfoRow label="Début" value={new Date(enrollment.moratoire_date_debut).toLocaleDateString('fr-FR')} />}
                {enrollment.moratoire_date_fin && <InfoRow label="Fin" value={new Date(enrollment.moratoire_date_fin).toLocaleDateString('fr-FR')} />}
                {enrollment.moratoire_prochaine_echeance && <InfoRow label="Prochaine échéance" value={new Date(enrollment.moratoire_prochaine_echeance).toLocaleDateString('fr-FR')} />}
              </div>
              {enrollment.note_arrangement && (
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>« {enrollment.note_arrangement} »</p>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Aucun moratoire. Les relances automatiques s'appliquent normalement.
            </p>
          )
        ) : (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
              Activer le moratoire pour cet élève
            </label>

            {actif && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Motif</label>
                  <input
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="ex. Difficultés financières passagères, maladie, décès dans la famille…"
                    style={inputStyle}
                  />
                </div>

                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Montant convenu</label>
                    <MoneyInput value={montantConvenu} onChange={setMontantConvenu} suffix="F CFA" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre de mensualités</label>
                    <input
                      type="number"
                      min="1"
                      value={nbMensualites}
                      onChange={(e) => setNbMensualites(e.target.value)}
                      placeholder="ex. 5"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Date de début</label>
                    <DatePicker value={dateDebut} onChange={setDateDebut} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date de fin</label>
                    <DatePicker value={dateFin} onChange={setDateFin} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Prochaine échéance prévue</label>
                  <DatePicker value={prochaineEcheance} onChange={setProchaineEcheance} style={inputStyle} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Note interne (facultatif)</label>
                  <AmountAwareTextarea
                    value={note}
                    onChange={setNote}
                    placeholder="Note visible uniquement par l'équipe administrative."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)', resize: 'vertical' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {history && history.length > 0 && (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Historique du moratoire</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{ padding: '11px 16px', borderBottom: i < history.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: actionColor(h.action), textTransform: 'uppercase' }}>{actionLabel(h.action)}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(h.created_at).toLocaleDateString('fr-FR')} · {h.auteur || '—'}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink)' }}>{h.nouveau_resume || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
