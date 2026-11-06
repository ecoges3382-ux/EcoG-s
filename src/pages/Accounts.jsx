import { useState } from 'react';
import StaffAccountsTab from '../components/accounts/StaffAccountsTab.jsx';
import ParentAccessTab from '../components/accounts/ParentAccessTab.jsx';

const TABS = [
  { id: 'staff', label: 'Comptes utilisateurs' },
  { id: 'parents', label: 'Accès parents' },
];

export default function Accounts() {
  const [tab, setTab] = useState('staff');
  
  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Comptes</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'staff' ? <StaffAccountsTab /> : <ParentAccessTab />}
    </div>
  );
}
