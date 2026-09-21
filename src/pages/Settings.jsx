import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useCurrentSchoolYear } from '../lib/schoolYear.jsx';
import { NIVEAUX } from '../lib/utils.js';
import PhotoPicker from '../components/PhotoPicker.jsx';
import FeeScheduleGrid from '../components/FeeScheduleGrid.jsx';

const CAN_MANAGE_YEAR_ROLES = ['fondateur', 'directeur'];

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { schoolYear, refresh: refreshSchoolYear } = useCurrentSchoolYear(profile.school_id);
  const school = profile.schools;
  const isFondateur = profile.role === 'fondateur';
  const canManageYear = CAN_MANAGE_YEAR_ROLES.includes(profile.role);

  const [name, setName] = useState(school?.name || '');
  const [color, setColor] = useState(school?.color || '#0F4C3A');
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom de l'école ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: updateError } = await supabase
      .from('schools')
      .update({ name: name.trim(), color, logo_url: logoUrl.trim() || null })
      .eq('id', profile.school_id);
    setSaving(false);
    if (updateError) {
      setError(isFondateur ? updateError.message : "Seul le fondateur peut modifier les paramètres de l'école.");
      return;
    }
    await refreshProfile();
    setSaved(true);
  }

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Paramètres</p>

      {!isFondateur && (
        <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 22, background: 'var(--gold-light)', borderColor: 'var(--gold)', maxWidth: 520 }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
            Seul le fondateur peut modifier ces réglages. Tu peux les consulter mais pas les enregistrer.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: 22, maxWidth: 520 }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Identité de l'établissement</p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nom de l'école</label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isFondateur} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Couleur principale de l'application</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!isFondateur} style={{ width: 48, height: 40, borderRadius: 9, border: '1px solid var(--line-strong)', padding: 2, cursor: isFondateur ? 'pointer' : 'default' }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} disabled={!isFondateur} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Logo (facultatif)</label>
          {isFondateur ? (
            <PhotoPicker schoolId={profile.school_id} value={logoUrl} onChange={setLogoUrl} />
          ) : (
            logoUrl
              ? <img src={logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--line-strong)' }} />
              : <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Aucun logo</p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>Sans logo, les initiales de l'école restent affichées.</p>
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
        {saved && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--success)', fontWeight: 600 }}>Enregistré.</p>}

        {isFondateur && (
          <button type="submit" disabled={saving} style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: saving ? 0.7 : 1 }}>
            <i className="ti ti-check" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
            {saving ? 'Enregistrement…' : 'Enregistrer et appliquer'}
          </button>
        )}
      </form>

      {/* Calendrier de paiement et grille tarifaire : réglages à mettre en
          place avant de commencer à utiliser l'appli au quotidien — pas
          quelque chose qu'on va chercher dans Argent, directement visible
          en entrant dans Paramètres. Deux paramètres distincts, deux cartes. */}
      {schoolYear && (
        <div className="card-bold" style={{ padding: 22, marginTop: 16, maxWidth: 520 }}>
          <PaymentCalendar schoolYear={schoolYear} canManage={canManageYear} onSaved={refreshSchoolYear} />
        </div>
      )}

      {schoolYear && (
        <div className="card-bold" style={{ padding: 22, marginTop: 16, maxWidth: 520 }}>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Grille tarifaire</p>
          <p style={{ margin: '0 0 16px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Montants attendus par niveau pour {schoolYear.label}.
          </p>
          <FeeScheduleGrid schoolId={profile.school_id} schoolYear={schoolYear} canManage={canManageYear} />
        </div>
      )}

      {canManageYear && <PassageThresholds schoolId={profile.school_id} />}

      {isFondateur && (
        <Link
          to="/comptes"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', marginTop: 16, maxWidth: 520 }}
          className="card-bold"
        >
          <div style={{ padding: '16px 20px' }}>
            <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Comptes utilisateurs</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Créer ou retirer des accès pour l'équipe</p>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 20 }} aria-hidden="true"></i>
        </Link>
      )}

      {['fondateur', 'directeur'].includes(profile.role) && (
        <Link
          to="/parametres/annee-scolaire"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit', marginTop: 12, maxWidth: 520 }}
          className="card-bold"
        >
          <div style={{ padding: '16px 20px' }}>
            <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Année scolaire</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Consulter l'historique ou préparer la prochaine année</p>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 20 }} aria-hidden="true"></i>
        </Link>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

// Un seul calendrier par année scolaire, identique pour toute l'école (pas
// par niveau) : une fois un délai dépassé, les élèves qui n'ont pas payé
// ce qu'il fallait à ce stade apparaissent "à relancer" dans Élèves et
// Argent (voir src/lib/retard.js). La 3ème tranche reste facultative pour
// une école qui ne fonctionne qu'en 2 tranches.
function PaymentCalendar({ schoolYear, canManage, onSaved }) {
  const [d1, setD1] = useState(schoolYear.date_tranche1 || '');
  const [d2, setD2] = useState(schoolYear.date_tranche2 || '');
  const [d3, setD3] = useState(schoolYear.date_tranche3 || '');
  const [dc, setDc] = useState(schoolYear.date_connexe || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setD1(schoolYear.date_tranche1 || '');
    setD2(schoolYear.date_tranche2 || '');
    setD3(schoolYear.date_tranche3 || '');
    setDc(schoolYear.date_connexe || '');
  }, [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3, schoolYear.date_connexe]);

  const dirty = d1 !== (schoolYear.date_tranche1 || '') || d2 !== (schoolYear.date_tranche2 || '')
    || d3 !== (schoolYear.date_tranche3 || '') || dc !== (schoolYear.date_connexe || '');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('school_years').update({
      date_tranche1: d1 || null,
      date_tranche2: d2 || null,
      date_tranche3: d3 || null,
      date_connexe: dc || null,
    }).eq('id', schoolYear.id);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved();
  }

  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Calendrier de paiement</p>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Une fois un délai dépassé, les élèves qui n'ont pas payé ce qu'il fallait à ce stade
        apparaissent automatiquement « à relancer » dans Élèves et Argent.
      </p>
      {canManage ? (
        <>
          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div>
              <label style={calLabelStyle}>1ère tranche</label>
              <input type="date" value={d1} onChange={(e) => setD1(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>2ème tranche</label>
              <input type="date" value={d2} onChange={(e) => setD2(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>3ème tranche</label>
              <input type="date" value={d3} onChange={(e) => setD3(e.target.value)} style={calInputStyle} />
            </div>
            <div>
              <label style={calLabelStyle}>Frais connexes</label>
              <input type="date" value={dc} onChange={(e) => setDc(e.target.value)} style={calInputStyle} />
            </div>
          </div>
          {error && <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            style={{ marginTop: 14, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le calendrier'}
          </button>
        </>
      ) : (
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <CalDateDisplay label="1ère tranche" value={schoolYear.date_tranche1} />
          <CalDateDisplay label="2ème tranche" value={schoolYear.date_tranche2} />
          <CalDateDisplay label="3ème tranche" value={schoolYear.date_tranche3} />
          <CalDateDisplay label="Frais connexes" value={schoolYear.date_connexe} />
        </div>
      )}
    </div>
  );
}

function CalDateDisplay({ label, value }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{value ? new Date(value).toLocaleDateString('fr-FR') : '—'}</p>
    </div>
  );
}

const calLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const calInputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };

// Seuil de moyenne annuelle (sur 20) à partir duquel un élève est classé
// automatiquement "Passe" plutôt que "Redouble" lors de la préparation
// d'une nouvelle année (voir start_school_year_preparation). Réglage
// permanent de l'école (pas par année) : niveau=null est le seuil par
// défaut, une ligne par niveau le surcharge si besoin — les deux modes
// ("même seuil partout" / "seuil différent par niveau") ne sont pas deux
// écrans séparés, juste la même mécanique : ne rien remplir par niveau = le
// défaut s'applique partout.
function PassageThresholds({ schoolId }) {
  const [rows, setRows] = useState(null);
  const [niveauxPresents, setNiveauxPresents] = useState(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  async function reload() {
    const [{ data: th, error: e }, { data: cl }] = await Promise.all([
      supabase.from('passage_thresholds').select('*'),
      supabase.from('classes').select('niveau'),
    ]);
    if (e) { setError(e.message); return; }
    const byNiveau = {};
    let def = null;
    (th || []).forEach((t) => { if (t.niveau === null) def = t; else byNiveau[t.niveau] = t; });
    setRows({ default: def, byNiveau });
    const present = new Set((cl || []).map((c) => c.niveau));
    const list = NIVEAUX.filter((n) => present.has(n));
    setNiveauxPresents(list);
    setSelected((prev) => (prev && list.includes(prev) ? prev : (list[0] || '')));
  }

  useEffect(() => { reload(); }, []);

  async function saveDefault(value) {
    setSaving('__default__');
    setError('');
    const payload = { school_id: schoolId, niveau: null, seuil: Number(value) || 0 };
    const { error: saveError } = rows.default
      ? await supabase.from('passage_thresholds').update(payload).eq('id', rows.default.id)
      : await supabase.from('passage_thresholds').insert(payload);
    setSaving('');
    if (saveError) { setError(saveError.message); return; }
    reload();
  }

  async function saveNiveau(niveau, value) {
    setSaving(niveau);
    setError('');
    const existing = rows.byNiveau[niveau];
    let saveError = null;
    if (value === '') {
      // Champ vidé : retombe sur le seuil par défaut, pas de ligne à zéro.
      if (existing) ({ error: saveError } = await supabase.from('passage_thresholds').delete().eq('id', existing.id));
    } else {
      const payload = { school_id: schoolId, niveau, seuil: Number(value) || 0 };
      ({ error: saveError } = existing
        ? await supabase.from('passage_thresholds').update(payload).eq('id', existing.id)
        : await supabase.from('passage_thresholds').insert(payload));
    }
    setSaving('');
    if (saveError) { setError(saveError.message); return; }
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!rows || !niveauxPresents) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  return (
    <div className="card-bold" style={{ padding: '18px 20px', marginTop: 16, maxWidth: 520 }}>
      <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600 }}>Seuil de passage automatique</p>
      <p style={{ margin: '0 0 14px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Moyenne annuelle minimale (sur 20) pour qu'un élève soit classé automatiquement « Passe »
        plutôt que « Redouble » lors de la préparation d'une nouvelle année. Laisse un niveau sur le
        seuil par défaut (grisé) ou personnalise-le pour ce niveau uniquement.
      </p>

      <ThresholdRow
        label="Seuil par défaut (toute l'école)"
        value={rows.default?.seuil}
        placeholder="10"
        saving={saving === '__default__'}
        onSave={saveDefault}
      />

      {niveauxPresents.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Personnaliser pour un niveau</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: '100%', maxWidth: 280, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', background: 'var(--paper)', marginBottom: 12 }}>
            {niveauxPresents.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          <NiveauThresholdEditor
            key={`${selected}-${rows.default?.seuil ?? ''}-${rows.byNiveau[selected]?.seuil ?? ''}`}
            niveau={selected}
            override={rows.byNiveau[selected]?.seuil}
            defaultValue={rows.default?.seuil}
            saving={saving === selected}
            onSave={(v) => saveNiveau(selected, v)}
          />
        </div>
      )}
    </div>
  );
}

function ThresholdRow({ label, value, placeholder, saving, onSave }) {
  const [v, setV] = useState(value ?? '');
  const dirty = String(v) !== String(value ?? '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <input
          type="number" min="0" max="20" step="0.5" value={v} placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          style={{ width: 76, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 13, textAlign: 'center', boxSizing: 'border-box', color: 'var(--ink)' }}
        />
        <button
          type="button" disabled={!dirty || saving} onClick={() => onSave(v)}
          style={{ fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default' }}
        >
          {saving ? '…' : 'OK'}
        </button>
      </div>
    </div>
  );
}

// Sans surcharge pour ce niveau, le champ affiche la valeur du seuil par
// défaut en grisé (fond + texte atténués) — dès que le seuil par défaut
// change et est confirmé, la key (recalculée par le parent) fait remonter
// ce composant avec la nouvelle valeur : le grisage se met à jour tout
// seul, sans action de l'utilisateur sur ce niveau. Le champ reste
// modifiable directement : taper dedans crée une surcharge propre à ce
// niveau (fond blanc, texte normal) ; "Revenir au défaut" la supprime.
function NiveauThresholdEditor({ niveau, override, defaultValue, saving, onSave }) {
  const hasOverride = override != null;
  const fallback = defaultValue != null ? String(defaultValue) : '10';
  const [v, setV] = useState(hasOverride ? String(override) : fallback);
  const inherited = !hasOverride && v === fallback;
  const dirty = hasOverride ? String(v) !== String(override) : v !== fallback;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number" min="0" max="20" step="0.5" value={v}
          onChange={(e) => setV(e.target.value)}
          style={{
            width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-strong)',
            fontSize: 14, textAlign: 'center', boxSizing: 'border-box',
            color: inherited ? 'var(--muted)' : 'var(--ink)',
            background: inherited ? 'var(--line)' : 'var(--paper)',
          }}
        />
        <button
          type="button" disabled={!dirty || saving} onClick={() => onSave(v)}
          style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', background: dirty ? 'var(--forest)' : 'var(--line)', color: dirty ? '#fff' : 'var(--muted)', cursor: dirty ? 'pointer' : 'default' }}
        >
          {saving ? '…' : 'OK'}
        </button>
        {hasOverride && (
          <button
            type="button" disabled={saving} onClick={() => onSave('')}
            style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Revenir au défaut
          </button>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>
        {niveau} — {inherited ? 'suit le seuil par défaut' : 'seuil personnalisé pour ce niveau'}
      </p>
    </div>
  );
}
