import { useState } from 'react';

export default function HelpTooltip({ text }) {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help', verticalAlign: 'middle' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(!show)} // Pour le tactile (mobile)
    >
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--line-strong)', color: 'var(--paper)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ?
      </span>

      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
          background: 'var(--ink)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 11.5,
          width: 'max-content',
          maxWidth: 220,
          zIndex: 100,
          whiteSpace: 'normal',
          lineHeight: 1.4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          textAlign: 'left',
          fontWeight: 500,
          pointerEvents: 'none'
        }}>
          {text}
          {/* Petite flèche pointant vers le bas */}
          <span style={{ position: 'absolute', top: '100%', left: '50%', marginLeft: -5, borderWidth: 5, borderStyle: 'solid', borderColor: 'var(--ink) transparent transparent transparent' }} />
        </span>
      )}
    </span>
  );
}
