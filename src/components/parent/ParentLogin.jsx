import { Monogram } from '../Logo.jsx';

export default function ParentLogin({ codeInput, setCodeInput, handleSubmitCode, error, loading }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 380, paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Monogram size={56} style={{ margin: '0 auto 16px' }} />
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
