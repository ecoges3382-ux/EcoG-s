import { useState, useEffect } from 'react';
import { copyText } from '../../lib/utils.js';
import { useToast } from '../Toast.jsx';
import Dropdown from '../Dropdown.jsx';
import { SkeletonRow } from '../Skeleton.jsx';
import ModalContainer from '../ModalContainer.jsx';
import { 
  callPlatformAdmin, 
  STATUT_LABELS, 
  PLAN_LABELS, 
  ROLE_LABELS, 
  healthIssues 
} from './PlatformAdminUI.jsx';
// 👇 On importe les prix depuis le fichier officiel plan.js 👇
import { PLAN_PRICES, LAUNCH_PRICES } from '../../lib/plan.js';

// 👇 On remplace PLAN_OPTIONS par une liste dynamique basée sur les prix actuels 👇
const CURRENT_PLAN_OPTIONS = [
  { value: 'decouverte', label: 'Découverte — Gratuit' },
  { value: 'essentiel', label: `Essentiel — ${PLAN_PRICES.essentiel.annuel.toLocaleString('fr-FR')} F/an` },
  { value: 'standard', label: `Standard — ${PLAN_PRICES.standard.annuel.toLocaleString('fr-FR')} F/an` },
  { value: 'premium', label: `Premium — ${PLAN_PRICES.premium.annuel.toLocaleString('fr-FR')} F/an` },
];

export default function SchoolDetailModal({ school, onClose, onChanged }) {
  const showToast = useToast();
  const [tab, setTab] = useState('infos');
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [link, setLink] = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(school.note_administrative || '');
  const [planDraft, setPlanDraft] = useState(school.plan || 'decouverte');

  async function loadStaff() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'school_detail', schoolId: school.id });
    if (err) { setError(err); return; }
    setStaff(data.staff);
  }

  useEffect(() => { loadStaff(); }, [school.id]);

  const st = STATUT_LABELS[school.statut] || STATUT_LABELS.actif;
  const pl = PLAN_LABELS[school.plan] || PLAN_LABELS.decouverte;
  const canDelete = school.statut === 'suspendu' || school.statut === 'resilie';
  const issues = healthIssues(school);
  const planDirty = planDraft !== (school.plan || 'decouverte');

  async function handleSetStatut(statut) {
    setBusyId('statut');
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'set_statut', schoolId: school.id, statut });
    setBusyId(null);
    if (err) { setError(err); return; }
    onChanged();
    onClose();
  }

  async function handleSetPlan() {
    setBusyId('plan');
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'set_plan', schoolId: school.id, plan: planDraft });
    setBusyId(null);
    if (err) { setError(err); return; }
    showToast('Plan mis à jour');
    onChanged();
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'delete', schoolId: school.id });
    setDeleting(false);
    if (err) { setError(err); return; }
    onChanged();
    onClose();
  }

  async function saveNote() {
    setBusyId('note');
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'set_note', schoolId: school.id, note: noteDraft });
    setBusyId(null);
    if (err) { setError(err); return; }
    setEditingNote(false);
    showToast('Enregistré');
    onChanged();
  }

  async function handleSupportAction(action, profileId) {
    setBusyId(`${action}-${profileId}`);
    setError('');
    setLink(null);
    const { data, error: err } = await callPlatformAdmin({ action, schoolId: school.id, profileId });
    setBusyId(null);
    if (err) { setError(err); return; }
    setLink({ action, url: data.link });
  }

  async function copyWithToast(text) {
    if (await copyText(text)) showToast('Copié');
    else showToast('Copie impossible, sélectionne le texte à la main', 'error');
  }

  return (
    <ModalContainer onClose={onClose} maxWidth={620} align="top">
      <div style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 14, color: 'var(--forest-dark)', overflow: 'hidden', flexShrink: 0 }}>
              {school.logo_url ? <img src={school.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((school.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG')}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: pl.bg, color: pl.fg }}>{pl.label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {issues.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: '#FEF3E2', border: '1px solid #FCA5A5' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 700, color: '#8F4620', textTransform: 'uppercase', letterSpacing: '0.03em' }}>À surveiller</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {issues.map((iss) => (
                <span key={iss.key} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff', color: '#8F4620' }}>{iss.label}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 18, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
          {[{ id: 'infos', label: 'Infos & actions' }, { id: 'personnel', label: 'Personnel' }].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{ padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: active ? 'var(--forest)' : 'var(--muted)', borderBottom: `2px solid ${active ? 'var(--forest)' : 'transparent'}`, marginBottom: -1 }}
              >
                {t.label}
                {t.id === 'personnel' && staff && (
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'var(--forest-light)', color: 'var(--forest)' }}>{staff.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        {tab === 'infos' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--forest-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Élèves</p>
                <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--forest-dark)' }}>{school.studentCount}</p>
              </div>
              <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--forest-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Comptes personnel</p>
                <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--forest-dark)' }}>{school.staffCount}</p>
              </div>
            </div>

            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Créée le</p>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, fontWeight: 600 }}>{new Date(school.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: 'var(--forest-light)', border: '1px solid var(--forest)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Plan souscrit</p>
              {/* 👇 ON UTILISE LA NOUVELLE LISTE DYNAMIQUE ICI 👇 */}
              <Dropdown value={planDraft} onChange={setPlanDraft} options={CURRENT_PLAN_OPTIONS} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleSetPlan} disabled={!planDirty || busyId === 'plan'} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: planDirty ? 'var(--forest)' : 'var(--line)', color: planDirty ? '#fff' : 'var(--muted)', fontWeight: 600, fontSize: 12.5, cursor: planDirty ? 'pointer' : 'default' }}>
                  {busyId === 'plan' ? 'Enregistrement…' : 'Mettre à jour le plan'}
                </button>
                {planDirty && <span style={{ fontSize: 11.5, color: 'var(--clay-dark)', fontWeight: 600 }}>Non enregistré</span>}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Note administrative</p>
              {editingNote ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Plan convenu, contact, motif de suspension…" style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 12.5, color: 'var(--ink)' }} />
                  <button type="button" onClick={saveNote} disabled={busyId === 'note'} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Enregistrer</button>
                  <button type="button" onClick={() => setEditingNote(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Annuler</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setNoteDraft(school.note_administrative || ''); setEditingNote(true); }} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', fontStyle: school.note_administrative ? 'normal' : 'italic' }}>
                  {school.note_administrative || 'Ajouter une note administrative…'}
                </button>
              )}
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Statut</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {school.statut !== 'suspendu' ? (
                <button type="button" onClick={() => handleSetStatut('suspendu')} disabled={busyId === 'statut'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--amber)', background: 'none', color: 'var(--amber)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Suspendre</button>
              ) : (
                <button type="button" onClick={() => handleSetStatut('actif')} disabled={busyId === 'statut'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--success)', background: 'none', color: 'var(--success)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Réactiver</button>
              )}
              {!confirmingDelete ? (
                <button type="button" onClick={() => (canDelete ? setConfirmingDelete(true) : null)} disabled={!canDelete} title={canDelete ? undefined : "Suspends d'abord cette école pour pouvoir la supprimer définitivement."} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${canDelete ? 'var(--danger)' : 'var(--line-strong)'}`, background: 'none', color: canDelete ? 'var(--danger)' : 'var(--muted)', fontWeight: 600, fontSize: 12.5, cursor: canDelete ? 'pointer' : 'not-allowed' }}>
                  Supprimer définitivement
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirmingDelete(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Annuler</button>
                  <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                    {deleting ? 'Suppression…' : 'Confirmer'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {tab === 'personnel' && (
          <>
            {!staff && <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}><SkeletonRow count={2} avatar={false} /></div>}
            {staff && staff.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun compte personnel dans cette école.</p>}
            {staff && staff.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {staff.map((p, i) => (
                  <div key={p.id} style={{ padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{p.full_name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {ROLE_LABELS[p.role] || p.role}</span></p>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{p.email || p.phone || '—'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => handleSupportAction('impersonate', p.id)} disabled={!p.email || busyId === `impersonate-${p.id}`} title={p.email ? "Générer un lien de connexion à la place de ce compte" : "Ce compte n'a pas d'e-mail"} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--forest)', background: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: 11.5, cursor: p.email ? 'pointer' : 'not-allowed', opacity: p.email ? 1 : 0.4 }}>
                          Se connecter en tant que
                        </button>
                        <button type="button" onClick={() => handleSupportAction('reset_password', p.id)} disabled={!p.email || busyId === `reset_password-${p.id}`} title={p.email ? 'Générer un lien de réinitialisation de mot de passe' : "Ce compte n'a pas d'e-mail"} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'none', color: 'var(--ink)', fontWeight: 600, fontSize: 11.5, cursor: p.email ? 'pointer' : 'not-allowed', opacity: p.email ? 1 : 0.4 }}>
                          Mot de passe
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {link && (
              <div className="card-bold" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
                  {link.action === 'impersonate' ? 'Lien de connexion à usage unique' : 'Lien de réinitialisation de mot de passe'} — ne le partage qu'avec la personne concernée.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ flex: '1 1 220px', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--line-strong)', fontSize: 11.5, color: 'var(--ink)' }} />
                  <button type="button" onClick={() => copyWithToast(link.url)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Copier</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalContainer>
  );
}
