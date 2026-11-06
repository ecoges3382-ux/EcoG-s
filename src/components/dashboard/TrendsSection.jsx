import { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';
import { supabase } from '../../lib/supabase.js';
import { fmtF } from '../../lib/utils.js';
import { guardedFetch } from '../../lib/offlineCache.js';
import { buildMonthsForChart } from './DashboardUI.jsx';

export default function TrendsSection({ schoolYear, attendance }) {
  const [payments, setPayments] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;

    guardedFetch({
      cacheKey: `dashboard_monthly_payments_${schoolYear.id}_v5`, 
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase
          .from('payments')
          .select('date, montant')
          .eq('school_year_id', schoolYear.id);
        
        if (e) return { error: e };
        return { data: data || [] };
      },
      setData: setPayments,
      onError: (err) => setLoadError(err),
      isCancelled: () => cancelled,
    });
    
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (!schoolYear) return null;

  const months = buildMonthsForChart(schoolYear);
  const dataToUse = payments || [];

  const paymentsData = months.map((m) => ({
    name: m.label,
    value: dataToUse
      .filter((p) => p.date && p.date.startsWith(m.key))
      .reduce((a, p) => a + Number(p.montant), 0),
  }));

  const totalPayments = paymentsData.reduce((a, d) => a + d.value, 0);

  const presenceData = months.map((m) => {
    const records = (attendance || []).filter((r) => r.date && r.date.startsWith(m.key));
    if (records.length === 0) return { name: m.label, value: 0, hasData: false };
    const presents = records.filter((r) => r.statut === 'present' || r.statut === 'retard').length;
    return { name: m.label, value: Math.round((presents / records.length) * 100), hasData: true };
  });
  const monthsWithData = presenceData.filter((d) => d.hasData);

  const CustomTooltip = ({ active, payload, label, isCurrency }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--ink)', padding: '8px 12px', borderRadius: 8, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{label}</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {isCurrency ? fmtF(payload[0].value) : `${payload[0].value}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-bold" style={{ padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Tendances mensuelles</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Encaissements et présences · {months.length} mois affichés
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
            Encaissements {totalPayments > 0 ? `· total ${fmtF(totalPayments)}` : ''}
          </p>
          
          {loadError ? (
             <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-light)', borderRadius: 8 }}>
               <p style={{ margin: 0, fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>Erreur de chargement : {loadError.message}</p>
             </div>
          ) : payments === null ? (
             <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Chargement des données…</p>
             </div>
          ) : totalPayments === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun paiement enregistré sur cette période.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={paymentsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(val) => val > 1000 ? `${val / 1000}k` : val} />
                  <Tooltip content={<CustomTooltip isCurrency={true} />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Line 
                    type="linear" 
                    dataKey="value" 
                    stroke="var(--forest)" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: 'var(--paper)', stroke: 'var(--forest)', strokeWidth: 2 }} 
                    activeDot={{ r: 6, fill: 'var(--forest)' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
            Taux de présence (%)
          </p>
          {attendance === null ? (
             <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Chargement…</p>
             </div>
          ) : monthsWithData.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun appel enregistré sur cette période.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer>
                <LineChart data={presenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip isCurrency={false} />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Line 
                    type="linear" 
                    dataKey="value" 
                    stroke="var(--gold)" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: 'var(--paper)', stroke: 'var(--gold)', strokeWidth: 2 }} 
                    activeDot={{ r: 6, fill: 'var(--gold)' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
