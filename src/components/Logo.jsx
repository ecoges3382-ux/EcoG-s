// Logo EcoGès — version ultra-simple, texte SVG natif.
// Aucune variable CSS dynamique, aucun path complexe.

export function Wordmark({ tone = 'onLight', height = 32, className, title = 'EcoGès', style = {} }) {
  const width = Math.round(height * 4.22);
  const ecoColor = tone === 'onDark' ? '#FFFFFF' : '#02352C';
  const gesColor = '#E4A729';

  return (
    <svg
      viewBox="0 0 140 33"
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <text x="0" y="26" fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="28" fill={ecoColor}>
        Eco
      </text>
      <text x="54" y="26" fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="28" fill={gesColor}>
        Gès
      </text>
    </svg>
  );
}

export function Monogram({ size = 56, rounded = true, className, title = 'EcoGès', style = {} }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <rect width="100" height="100" rx={rounded ? 25 : 0} fill="#02352C" />
      <text x="50" y="66" textAnchor="middle" fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="40" fill="#E4A729">
        EG
      </text>
    </svg>
  );
}
