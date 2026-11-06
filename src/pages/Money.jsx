import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import { usePageTour } from '../components/PageTour.jsx';

// Importation de tous les sous-composants découpés
import Overview from './money/Overview.jsx';
import FraisConnexes from './money/FraisConnexes.jsx';
import Payments from './money/Payments.jsx';
import Expenses from './money/Expenses.jsx';
import SalairesSection from './money/SalairesSection.jsx';
import Advances from './money/Advances.jsx';
import BilanFinancier from './money/BilanFinancier.jsx';

const TABS = [
  { id: 'vue', label: "Droit d'écolage" },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'salaires', label: 'Salaires' },
  { id: 'avances', label: 'Avances sur salaire' },
  { id: 'bilan', label: 'Bilan financier' },
];

export default function Money() {
  const [tab, setTab] = useState('vue');
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const tour = usePageTour('money');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Argent</p>
        <tour.Button />
      </div>
      {tour.Runner}
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      
      <div 
        data-tour="money-tabs" 
        className="hide-scrollbar"
        style={{ 
          display: 'flex', 
          gap: 8, 
          overflowX: 'auto', 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none', 
          margin: '0 -14px 22px', 
          padding: '0 14px 4px' 
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flexShrink: 0, padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vue' && <Overview />}
      {tab === 'connexe' && <FraisConnexes />}
      {tab === 'paiements' && <Payments />}
      {tab === 'depenses' && <Expenses />}
      {tab === 'salaires' && <SalairesSection />}
      {tab === 'avances' && <Advances />}
      {tab === 'bilan' && <BilanFinancier />}
    </div>
  );
}
