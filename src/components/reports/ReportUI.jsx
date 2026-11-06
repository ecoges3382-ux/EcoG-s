import DocumentHeader from '../DocumentHeader.jsx';
import { printDocument, slug } from '../../lib/print.js';

export function groupByClasse(students) {
  const map = new Map();
  students.forEach((s) => {
    const key = s.classeId || s.niveau;
    if (!map.has(key)) map.set(key, { nom: s.niveau, classeId: s.classeId, items: [] });
    map.get(key).items.push(s);
  });
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

export function ReportShell({ school, title, periode, donnees, children, onPrint, onExportCsv }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={onPrint} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}>
          <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
        </button>
        {onExportCsv && (
          <button onClick={onExportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Export CSV
          </button>
        )}
      </div>
      <div className="card-bold print-sheet" style={{ padding: '24px 26px', maxWidth: 760 }}>
        <DocumentHeader school={school} title={title} subtitle={`Généré le ${new Date().toLocaleDateString('fr-FR')}`} />
        <p style={{ margin: '0 0 18px', fontSize: 11.5, color: 'var(--muted)' }}>
          Période couverte : {periode} — Données utilisées : {donnees}
        </p>
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children }) {
  return <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 14.5, fontWeight: 600 }}>{children}</p>;
}

export function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

export function SimpleTable({ columns, rows }) {
  const template = columns.map((_, i) => (i === 0 ? '1.6fr' : '1fr')).join(' ');
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, padding: '9px 14px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: template, padding: '9px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          {row.map((v, j) => <span key={j} style={j === 0 ? { fontWeight: 600 } : undefined}>{v}</span>)}
        </div>
      ))}
      {rows.length === 0 && <p style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5 }}>Aucune donnée.</p>}
    </div>
  );
}
