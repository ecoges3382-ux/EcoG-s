import { Link } from 'react-router-dom';

export const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function buildMonthsForChart(schoolYear) {
  const today = new Date();
  let startDate;

  if (schoolYear?.date_debut) {
    startDate = new Date(schoolYear.date_debut);
  } else {
    const match = schoolYear?.label?.match(/^(\d{4})-(\d{4})$/);
    const startYear = match ? Number(match[1]) : today.getFullYear();
    startDate = new Date(startYear, 7, 1);
  }

  const endDate = new Date(startDate.getFullYear() + 1, 6, 31);

  const months = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= endCursor) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS_FR[cursor.getMonth()],
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return months;
}

export function Stat({ label, value, color, sub, subColor, to }) {
  const content = (
    <>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: subColor || 'var(--muted)', fontWeight: subColor ? 600 : 400 }}>{sub}</p>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="card-bold stat-in"
        style={{ padding: '16px 18px', textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}
        title="Voir le détail"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="card-bold stat-in" style={{ padding: '16px 18px' }}>
      {content}
    </div>
  );
}
