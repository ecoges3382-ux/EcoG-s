import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmt, initials } from '../lib/utils.js';

const STORAGE_KEY = 'ecoges_parent_access_code';

// Page publique, sans compte ni session : un parent saisit (ou reçoit dans
// le lien) son code d'accès et voit directement ses enfants. Toute la
// vérification et la lecture passent par l'Edge Function parent-portal
// (clé service_role côté serveur) — cette page ne parle jamais aux tables
// Supabase directement.
export default function ParentAccess() {
  const [searchParams] = useSearchParams();
  const [codeInput, setCodeInput] = useState(searchParams.get('code') || '');
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadSummary(theCode) {
    setLoading(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', { body: { code: theCode } });
    setLoading(false);
    if (fnError || data?.error) {
      setError(data?.error || 'Code invalide.');
      setSummary(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setCode(theCode);
    setSummary(data);
    sessionStorage.setItem(STORAGE_KEY, theCode);
  }

  useEffect(() => {
    const initial = searchParams.get('code') || sessionStorage.getItem(STORAGE_KEY);
    if (initial) loadSummary(initial.trim().toUpperCase());
  }, []);

  function handleSubmitCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    loadSummary(codeInput.trim().toUpperCase());
  }

  function changeCode() {
    sessionStorage.removeItem(STORAGE_KEY);
    setSummary(null);
    setSelected(null);
    setDetail(null);
    setCode('');
    setCodeInput('');
  }

  async function openStudent(student) {
    setSelected(student);
    setDetail(null);
    const { data, error: fnError } = await supabase.functions.invoke('parent-portal', {
      body: { code, action: 'detail', student_id: student.id },
    });
    if (fnError || data?.error) {
      setError(data?.error || 'Erreur de chargement.');
      return;
    }
    setDetail(data);
  }

  // --- Écran 1 : saisie du code ---
  if (!summary) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Espace parent</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Saisis le code fourni par l'école</p>
          </div>

          <form onSubmit={handleSubmitCode} className="card-bold" style={{ padding: '26px 24px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Code d'accès</p>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="ex. K7XR4PQD"
              autoCapitalize="characters"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 18, letterSpacing: '0.08em', textAlign: 'center', marginBottom: 16, boxSizing: 'border-box', color: 'var(--ink)', textTransform: 'uppercase' }}
            />
            {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Vérification…' : 'Continuer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Écran 3 : détail d'un enfant ---
  if (selected) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px 16px 60px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <button
            onClick={() => { setSelected(null); setDetail(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}
          >
            ← Retour aux enfants
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
              {selected.photo_url ? <img src={selected.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(selected.full_name)}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>{selected.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{selected.niveau}{selected.matricule ? ` · ${selected.matricule}` : ''}</p>
            </div>
          </div>

          {!detail && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

          {detail && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 22 }}>
                <Stat label="Reste à payer" value={`${fmt(Number(selected.montant_du) - Number(selected.montant_paye))} F`} color={Number(selected.montant_du) - Number(selected.montant_paye) > 0 ? 'var(--danger)' : 'var(--success)'} />
                <Stat label="Frais connexes restants" value={`${fmt(Number(selected.frais_connexe_du) - Number(selected.frais_connexe_paye))} F`} color={Number(selected.frais_connexe_du) - Number(selected.frais_connexe_paye) > 0 ? 'var(--amber)' : 'var(--success)'} />
              </div>

              <Section title="Bulletin">
                <div className="card-bold" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5 }}>{selected.moyenne != null ? `Moyenne : ${selected.moyenne}/20` : 'Moyenne non encore renseignée'}</span>
                  <span style={{ background: selected.bulletin_pret ? 'var(--success-light)' : '#F0EDE5', color: selected.bulletin_pret ? 'var(--success)' : 'var(--muted)', fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20 }}>
                    {selected.bulletin_pret ? 'Prêt' : 'En cours'}
                  </span>
                </div>
              </Section>

              {detail.grades.length > 0 && (
                <Section title="Notes récentes">
                  <div className="card-bold" style={{ overflow: 'hidden' }}>
                    {detail.grades.slice(0, 10).map((g, i) => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                        <span style={{ fontSize: 13 }}>{g.subject?.nom || '—'} <span style={{ color: 'var(--muted)' }}>· {g.periode}</span></span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>{g.note}/{g.sur}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Paiements">
                <div className="card-bold" style={{ overflow: 'hidden' }}>
                  {detail.payments.slice(0, 10).map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize: 13 }}>{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(p.montant)} F</span>
                    </div>
                  ))}
                  {detail.payments.length === 0 && <p style={{ padding: '14px 18px', color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré.</p>}
                </div>
              </Section>

              <Section title="Présences récentes">
                <div className="card-bold" style={{ overflow: 'hidden' }}>
                  {detail.attendance.slice(0, 10).map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: a.statut === 'present' ? 'var(--success-light)' : a.statut === 'absent' ? 'var(--danger-light)' : 'var(--amber-light)', color: a.statut === 'present' ? 'var(--success)' : a.statut === 'absent' ? 'var(--danger)' : 'var(--amber)' }}>
                        {a.statut === 'present' ? 'Présent' : a.statut === 'absent' ? 'Absent' : 'Retard'}
                      </span>
                    </div>
                  ))}
                  {detail.attendance.length === 0 && <p style={{ padding: '14px 18px', color: 'var(--muted)', fontSize: 13 }}>Aucune présence enregistrée.</p>}
                </div>
              </Section>

              {detail.announcements.length > 0 && (
                <Section title="Annonces">
                  <div className="card-bold" style={{ overflow: 'hidden' }}>
                    {detail.announcements.map((a, i) => (
                      <div key={a.id} style={{ padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                        <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 600 }}>{a.titre}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{a.auteur} · {a.role}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Écran 2 : liste des enfants ---
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>Bonjour, {summary.full_name}</p>
          <button onClick={changeCode} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Changer de code</button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>
          {summary.students.length} enfant{summary.students.length > 1 ? 's' : ''} rattaché{summary.students.length > 1 ? 's' : ''}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {summary.students.map((s) => {
            const reste = Number(s.montant_du) - Number(s.montant_paye);
            return (
              <button
                key={s.id}
                onClick={() => openStudent(s)}
                className="card-bold"
                style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
                    {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 14.5, fontWeight: 600 }}>{s.full_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{s.niveau}</p>
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {reste > 0 ? `${fmt(reste)} F dû` : 'À jour'}
                </span>
              </button>
            );
          })}
          {summary.students.length === 0 && (
            <div className="card-bold" style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              Aucun enfant n'est encore rattaché à ce code. Contacte le secrétariat de l'école.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}
