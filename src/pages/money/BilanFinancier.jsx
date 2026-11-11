import { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip 
} from 'recharts';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import { SkeletonCard, SkeletonTableRows } from '../../components/Skeleton.jsx';
import { translateError } from '../../lib/errors.js';

export default function BilanFinancier() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;

    async function load() {
      try {
        const [
          { data: payments, error: pErr },
          { data: salaries, error: sErr },
          { data: advances, error: aErr },
          { data: expenses, error: eErr }
        ] = await Promise.all([
          supabase.from('payments').select('type_frais, montant').eq('school_year_id', schoolYear.id),
          supabase.from('staff_salaries').select('montant').eq('school_year_id', schoolYear.id),
          supabase.from('salary_advances').select('montant').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
          supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id)
        ]);

        if (pErr) throw pErr;
        if (sErr) throw sErr;
        if (aErr) throw aErr;
        if (eErr) throw eErr;

        const ecolage = (payments || []).filter(p => p.type_frais === 'scolarite').reduce((acc, p) => acc + Number(p.montant), 0);
        const connexe = (payments || []).filter(p => p.type_frais === 'connexe').reduce((acc, p) => acc + Number(p.montant), 0);
        const inscription = (payments || []).filter(p => p.type_frais === 'inscription').reduce((acc, p) => acc + Number(p.montant), 0);
        const totalRevenus = ecolage + connexe + inscription;

        const salairesPayes = (salaries || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const avancesPayees = (advances || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const autresDepenses = (expenses || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const totalCharges = salairesPayes + avancesPayees + autresDepenses;

        const resultatNet = totalRevenus - totalCharges;

        if (!cancelled) {
          setData({
            ecolage, connexe, inscription, totalRevenus,
            salairesPayes, avancesPayees, autresDepenses, totalCharges,
            resultatNet
          });
        }
      } catch (err) {
        if (!cancelled) setError(translateError(err));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!data || !schoolYear) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={5} columns={4} /></div>
      </div>
    );
  }

  const pieRevenusData = [
    { name: 'Écolage', value: data.ecolage, color: '#34D399' }, // Vert menthe
    { name: 'Connexes', value: data.connexe, color: '#FBBF24' }, // Jaune/Or
    { name: 'Inscriptions', value: data.inscription, color: '#60A5FA' }, // Bleu clair
  ].filter(d => d.value > 0);

  const pieChargesData = [
    { name: 'Salaires', value: data.salairesPayes, color: '#FF6B6B' }, // Corail/Rouge clair
    { name: 'Avances', value: data.avancesPayees, color: '#F59E0B' }, // Orange
    { name: 'Autres dépenses', value: data.autresDepenses, color: '#9CA3AF' }, // Gris
  ].filter(d => d.value > 0);

  const renderExternalLabel = ({ cx, cy, midAngle, outerRadius, percent, index, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25; 
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    if (percent < 0.03) return null;

    const color = (name === 'Écolage' || name === 'Salaires') ? '#34D399' 
                : (name === 'Connexes' || name === 'Avances') ? '#FBBF24' 
                : (name === 'Inscriptions') ? '#60A5FA' : '#9CA3AF';

    return (
      <text 
        x={x} 
        y={y} 
        fill={color} 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central" 
        fontSize={12} 
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div>
      <div className="card-bold" style={{ padding: '20px 24px', marginBottom: 24, background: 'var(--forest)', color: '#fff', borderColor: 'var(--forest)' }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Résultat net de l'école — {schoolYear.label}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, color: data.resultatNet >= 0 ? '#fff' : '#FFC0C0' }}>
            {fmtF(data.resultatNet)}
          </p>
          <span style={{ fontSize: 14, fontWeight: 600, color: data.resultatNet >= 0 ? 'var(--gold)' : '#FFC0C0' }}>
            {data.resultatNet >= 0 ? 'Bénéfice' : 'Déficit'}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
          Revenus totaux : {fmtF(data.totalRevenus)} — Charges totales : {fmtF(data.totalCharges)}
        </p>
      </div>

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        
        {/* CARTE DES REVENUS */}
        <div className="card-bold" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <i className="ti ti-trending-up" style={{ fontSize: 20, color: 'var(--success)' }} aria-hidden="true"></i>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Revenus encaissés</p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Droit d'écolage</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.ecolage)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Frais connexes</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.connexe)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Inscriptions / Réinscriptions</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.inscription)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>TOTAL REVENUS</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{fmtF(data.totalRevenus)}</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 10, position: 'relative' }}>
            {pieRevenusData.length > 0 && (
              <>
                <div style={{ height: 240, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={pieRevenusData} 
                        dataKey="value" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={65} 
                        outerRadius={90} 
                        paddingAngle={2} 
                        stroke="transparent" // 👈 COULEUR TRANSPARENTE
                        strokeWidth={0}      // 👈 EPAISSEUR À 0 POUR ENLEVER LA BORDURE
                        labelLine={true}
                        label={renderExternalLabel}
                      >
                        {pieRevenusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" strokeWidth={0} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => fmtF(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', background: 'var(--ink)', color: 'var(--paper)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                  {pieRevenusData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* CARTE DES CHARGES */}
        <div className="card-bold" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <i className="ti ti-trending-down" style={{ fontSize: 20, color: 'var(--danger)' }} aria-hidden="true"></i>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Charges décaissées</p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Salaires versés</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.salairesPayes)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Avances sur salaire</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.avancesPayees)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Autres dépenses</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.autresDepenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>TOTAL CHARGES</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(data.totalCharges)}</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 10, position: 'relative' }}>
            {pieChargesData.length > 0 && (
              <>
                <div style={{ height: 240, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={pieChargesData} 
                        dataKey="value" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={65} 
                        outerRadius={90} 
                        paddingAngle={2} 
                        stroke="transparent" // 👈 COULEUR TRANSPARENTE
                        strokeWidth={0}      // 👈 EPAISSEUR À 0 POUR ENLEVER LA BORDURE
                        labelLine={true}
                        label={renderExternalLabel}
                      >
                        {pieChargesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" strokeWidth={0} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => fmtF(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', background: 'var(--ink)', color: 'var(--paper)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                  {pieChargesData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
