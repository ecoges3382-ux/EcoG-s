import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip 
} from 'recharts';

export default function DemographicsSection({ students }) {
  const boys = students.filter((s) => s.sexe === 'M').length;
  const girls = students.filter((s) => s.sexe === 'F').length;
  const other = students.length - boys - girls;

  const data = [
    { name: 'Garçons', value: boys },
    { name: 'Filles', value: girls },
  ];
  if (other > 0) data.push({ name: 'Non renseigné', value: other });

  const total = students.length;

  const COLORS = {
    'Garçons': '#4A90E2',
    'Filles': '#E26D8A',
    'Non renseigné': '#999999',
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="card-bold" style={{ padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Répartition Filles / Garçons</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Démographie de l'école</p>
      </div>
      
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        {total === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun élève inscrit.</p>
        ) : (
          <div style={{ width: '100%', height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={0}
                  stroke="var(--paper)"   
                  strokeWidth={4}         
                  paddingAngle={0}        
                  cornerRadius={0}        
                  labelLine={false}
                  label={renderCustomizedLabel}
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value} élèves`, '']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[d.name] }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
