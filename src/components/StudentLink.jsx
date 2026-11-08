import { Link } from 'react-router-dom';

export default function StudentLink({ studentId, name, style }) {
  if (!studentId) return <span style={style}>{name}</span>;

  return (
    <Link
      to={`/eleves/${studentId}`}
      style={{
        color: 'inherit',
        textDecoration: 'none',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
    >
      {name}
    </Link>
  );
}
