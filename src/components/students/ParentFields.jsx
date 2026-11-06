import { useMemo } from 'react';
import NameInput from '../NameInput.jsx';
import PhoneInput from '../PhoneInput.jsx';
import Dropdown from '../Dropdown.jsx';
import { SkeletonLine } from '../Skeleton.jsx';

export const LIENS_PARENTE = [
  { id: 'pere', label: 'Père' },
  { id: 'mere', label: 'Mère' },
  { id: 'tuteur', label: 'Tuteur' },
  { id: 'autre', label: 'Autre' },
];

export default function ParentFields({
  label, nom, setNom, prenom, setPrenom,
  dial, setDial, local, setLocal,
  lien, setLien,
  useExisting, setUseExisting,
  selectedExistingId, setSelectedExistingId,
  search, setSearch,
  existingParents, studentNom,
  excludeIds = [], isEditing = false, onRemove,
}) {
  const filteredParents = useMemo(() => {
    if (!existingParents) return [];
    let filtered = existingParents;
    if (excludeIds.length > 0) filtered = filtered.filter((p) => !excludeIds.includes(p.id));
    const s = search.trim().toLowerCase();
    if (s) {
      filtered = filtered.filter((p) =>
        (p.full_name || '').toLowerCase().includes(s) ||
        (p.nom || '').toLowerCase().includes(s) ||
        (p.prenom || '').toLowerCase().includes(s)
      );
    } else {
      const nomEleve = studentNom.trim().toUpperCase();
      if (nomEleve) filtered = filtered.filter((p) => (p.nom || '').toUpperCase() === nomEleve);
    }
    return filtered;
  }, [existingParents, excludeIds, search, studentNom]);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--forest-dark)' }}>{label}</p>
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Retirer</button>
        )}
      </div>

      {!useExisting ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Lien de parenté</label>
            <Dropdown value={lien} onChange={setLien} options={LIENS_PARENTE.map(l => ({ value: l.id, label: l.label }))} style={{ ...inputStyle, marginBottom: 0 }} wrapperStyle={{ flex: 1, minWidth: 0, width: 'auto' }} />
          </div>

          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nom du parent</label>
              <NameInput mode="upper" value={nom} onChange={setNom} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prénom du parent</label>
              <NameInput mode="title" value={prenom} onChange={setPrenom} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Téléphone du parent</label>
            <PhoneInput dial={dial} local={local} onDialChange={setDial} onLocalChange={setLocal} style={{ marginBottom: 0 }} />
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            {search.trim() ? 'Résultats de recherche :' : studentNom.trim() ? `Parents portant le nom « ${studentNom.trim()} » :` : 'Tous les parents enregistrés :'}
          </p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tapez un nom pour rechercher…" style={{ ...inputStyle, marginBottom: 8 }} />
          {existingParents === null && <SkeletonLine width="70%" />}
          {existingParents?.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Aucun parent enregistré dans cette école.</p>}
          {existingParents?.length > 0 && filteredParents.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0', padding: '10px 12px', background: 'var(--line)', borderRadius: 8 }}>
              {search.trim() ? 'Aucun parent ne correspond à cette recherche.' : studentNom.trim() ? `Aucun parent avec le nom « ${studentNom.trim()} ». Tape dans la recherche pour en trouver un autre.` : 'Aucun résultat.'}
            </p>
          )}
          {filteredParents.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 9 }}>
              {filteredParents.map((p, i) => (
                <button type="button" key={p.id} onClick={() => setSelectedExistingId(p.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: i < filteredParents.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', fontSize: 13.5, background: selectedExistingId === p.id ? 'var(--forest-light)' : 'transparent', color: selectedExistingId === p.id ? 'var(--forest-dark)' : 'var(--ink)', fontWeight: selectedExistingId === p.id ? 600 : 400 }}>
                  {p.full_name}
                  {p.phone && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {p.phone}</span>}
                  {p.code && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {p.code}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--line)', padding: 10, borderRadius: 8 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
          <input type="checkbox" checked={useExisting} onChange={(e) => { setUseExisting(e.target.checked); if (!e.target.checked) { setSelectedExistingId(null); setSearch(''); } }} style={{ marginTop: 2 }} />
          <span>
            {isEditing && !onRemove ? "Remplacer par un autre parent déjà enregistré" : "Utiliser un parent déjà enregistré"}
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {isEditing && !onRemove ? "L'ancien lien sera retiré, le nouveau créé." : "Évite de ressaisir les infos. Le parent comptera tous ses enfants dans l'école."}
            </span>
          </span>
        </label>
      </div>

      {useExisting && !selectedExistingId && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>Choisis un parent dans la liste ci-dessus.</p>}
      {!isEditing && !useExisting && !onRemove && <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Laisser le nom vide pour ne pas créer d'accès maintenant.</p>}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
