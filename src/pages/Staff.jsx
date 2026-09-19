import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, downloadCsv } from '../lib/utils.js';
import NewStaffModal from '../components/NewStaffModal.jsx';
import SchoolTabs from '../layout/SchoolTabs.jsx';

export default function Staff() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    const { data, error: fetchError } = await supabase.from('staff').select('*').order('full_name');
    if (fetchError) setError(fetchError.message);
    else setStaff(data);
  }

  useEffect(() => { reload(); }, []);

  function exportCsv() {
    const rows = [['Matricule', 'Nom', 'Rôle', "Niveau d'études", 'Classe(s)', 'Téléphone', 'E-mail']];
    staff.forEach((p) => {
      rows.push([p.matricule || '', p.full_name, p.role, p.niveau_etudes || '', (p.classes || []).join(' / '), p.phone || '', p.email || '']);
    });
    downloadCsv('personnel.csv', rows);
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Personnel</p>
        {staff && (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
              <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
            </button>
            <button onClick={() => setModalOpen(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>}
      {!error && !staff && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {staff && (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>{staff.length} membre{staff.length > 1 ? 's' : ''}</p>
          <div className="card-bold" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 680 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1.8fr 1fr', padding: '13px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span>Matricule</span><span>Nom</span><span>Rôle</span><span>Niveau d'études</span><span>Classe(s)</span>
              </div>
              {staff.map((p, i) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1.8fr 1fr', padding: '14px 20px', alignItems: 'center', borderBottom: i < staff.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{p.matricule}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, color: 'var(--forest)', flexShrink: 0, overflow: 'hidden' }}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p.full_name)}
                    </div>
                    <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{p.full_name}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.role}</span>
                  <span style={{ fontSize: 13 }}>{p.niveau_etudes || '—'}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{(p.classes || []).length ? p.classes.join(', ') : '—'}</span>
                </div>
              ))}
              {staff.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre du personnel.</p>}
            </div>
          </div>
        </>
      )}

      {modalOpen && (
        <NewStaffModal
          schoolId={profile.school_id}
          existingStaff={staff || []}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
