// Paramètres > WhatsApp : rappels de paiement automatiques. Le fondateur peut les couper, choisir ses jalons (15, 7, 3 jours avant
// l'échéance, 3 jours après) et voit à l'avance qui va recevoir quoi. L'envoi est fait chaque matin par la fonction serveur
// cron-reminders, qui lit ces mêmes réglages. Voir src/lib/rappelsAuto.js.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { JALONS, LIBELLE_JALON, reglagesRappels, prochainsRappels } from '../lib/rappelsAuto.js';
import { SkeletonRow } from './Skeleton.jsx';

const quand = (jours) => (jours === 0 ? "aujourd'hui" : jours === 1 ? 'demain' : `dans ${jours} jours`);

export default function RappelsAutoCard({ schoolId, schoolYear, canEdit }) {
  const showToast = useToast();
  const { students } = useEnrollmentsForYear(schoolYear);
  const [charge, setCharge] = useState(null); // null = lecture en cours, 'ancienne-base' = colonnes absentes, objet = réglages enregistrés
  const [actif, setActif] = useState(true);
  const [jalons, setJalons] = useState(JALONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ouverts, setOuverts] = useState({});

  useEffect(() => {
    let annule = false;
    supabase.from('schools').select('rappels_auto, rappels_jalons').eq('id', schoolId).maybeSingle().then(({ data, error: e }) => {
      if (annule) return;
      if (e) { setCharge('ancienne-base'); return; }
      const r = reglagesRappels(data);
      setCharge(r); setActif(r.actif); setJalons(r.jalons);
    });
    return () => { annule = true; };
  }, [schoolId]);

  const modifie = charge && charge !== 'ancienne-base' && (actif !== charge.actif || jalons.join() !== charge.jalons.join());
  const envois = useMemo(
    () => (actif && students ? prochainsRappels({ schoolYear, eleves: students, jalons }) : []),
    [actif, students, schoolYear, jalons],
  );

  function basculer(j) {
    setJalons((prev) => JALONS.filter((x) => (x === j ? !prev.includes(x) : prev.includes(x))));
  }

  async function enregistrer() {
    setSaving(true); setError('');
    const { data, error: e } = await supabase.from('schools').update({ rappels_auto: actif, rappels_jalons: jalons }).eq('id', schoolId).select('rappels_auto');
    setSaving(false);
    if (e) { setError(e.message); return; }
    if (!data || data.length === 0) { setError("Seul le fondateur de l'école peut modifier ce réglage."); return; }
    setCharge({ actif, jalons });
    showToast('Réglages enregistrés');
  }

  const caseStyle = (coche) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: `1px solid ${coche ? 'var(--forest)' : 'var(--line-strong)'}`, background: coche ? 'var(--forest-light)' : 'var(--paper)',
    color: coche ? 'var(--forest-dark-text)' : 'var(--ink)', cursor: canEdit && actif ? 'pointer' : 'default', opacity: actif ? 1 : 0.55,
  });

  return (
    <div className="card-bold" style={{ padding: 22, marginBottom: 20 }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Rappels de paiement automatiques</p>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Chaque matin, les parents dont l'enfant n'a pas encore réglé une échéance reçoivent un rappel WhatsApp avant la date limite, puis un
        dernier rappel après. Les familles dont l'élève est sous moratoire n'en reçoivent pas, et personne n'est relancé deux fois pour la même échéance.
      </p>

      {charge === null && <SkeletonRow count={2} avatar={false} />}
      {charge === 'ancienne-base' && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
          Ces réglages ne sont pas encore disponibles : la base de données n'est pas à jour. Les rappels continuent de partir comme avant, sur tous les jalons.
        </p>
      )}

      {charge && charge !== 'ancienne-base' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, marginBottom: 14, cursor: canEdit ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={actif} disabled={!canEdit} onChange={(e) => setActif(e.target.checked)} style={{ width: 16, height: 16 }} />
            Envoyer les rappels automatiquement
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }} role="group" aria-label="Moments d'envoi">
            {JALONS.map((j) => {
              const coche = jalons.includes(j);
              return (
                <button key={j} type="button" aria-pressed={coche} disabled={!canEdit || !actif} onClick={() => basculer(j)} style={caseStyle(coche)}>
                  <i className={`ti ${coche ? 'ti-square-check' : 'ti-square'}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
                  {LIBELLE_JALON[j]}
                </button>
              );
            })}
          </div>
          {actif && jalons.length === 0 && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>Aucun moment coché : aucun rappel ne partira.</p>}
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
          {!canEdit && <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>Seul le fondateur peut modifier ces réglages.</p>}
          {canEdit && (
            <button type="button" onClick={enregistrer} disabled={!modifie || saving} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: modifie ? 'var(--forest)' : 'var(--line-strong)', color: '#fff', cursor: modifie && !saving ? 'pointer' : 'default' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Prochains rappels (30 jours)</p>
            {!actif && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Les rappels automatiques sont coupés : aucun message ne partira.</p>}
            {actif && !students && <SkeletonRow count={2} avatar={false} />}
            {actif && students && envois.length === 0 && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                Aucun rappel prévu dans les 30 jours : soit aucune échéance n'approche, soit tout est payé, soit les dates d'échéance ne sont pas renseignées (Paramètres, calendrier de paiement).
              </p>
            )}
            {actif && envois.map((e) => {
              const cle = `${e.type}:${e.jalon}`;
              const ouvert = !!ouverts[cle];
              return (
                <div key={cle} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 13 }}>
                      <strong>{e.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                      <span style={{ color: 'var(--muted)' }}> ({quand(e.jours)}) · {LIBELLE_JALON[e.jalon]} {e.libelle}</span>
                    </span>
                    <button type="button" onClick={() => setOuverts((o) => ({ ...o, [cle]: !ouvert }))} aria-expanded={ouvert} style={{ background: 'none', border: 'none', color: 'var(--forest-text)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                      {e.eleves.length} élève{e.eleves.length > 1 ? 's' : ''} {ouvert ? '▴' : '▾'}
                    </button>
                  </div>
                  {ouvert && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                      {e.eleves.slice(0, 60).map((x) => x.nom).join(', ')}{e.eleves.length > 60 ? ` et ${e.eleves.length - 60} autres` : ''}
                    </p>
                  )}
                </div>
              );
            })}
            {actif && students && envois.length > 0 && (
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                Estimation d'après les paiements d'aujourd'hui : un parent qui paie d'ici là sort de la liste. Une famille sans numéro WhatsApp valide ne reçoit rien.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
