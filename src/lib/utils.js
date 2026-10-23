// Séparateur de milliers "." et décimales "," (ex. 125.375,43) — demandé
// explicitement, à la place de l'espace utilisé par la locale fr-FR.
export function fmt(n) {
  return Number(n ?? 0).toLocaleString('de-DE');
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfWeekIso(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d.toISOString().slice(0, 10);
}
export function endOfWeekIso(iso) {
  const d = new Date(`${startOfWeekIso(iso)}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
export function startOfMonthIso(iso) {
  return `${iso.slice(0, 7)}-01`;
}
export function endOfMonthIso(iso) {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return `${iso.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

export function fmtF(n) {
  return `${fmt(n)} F CFA`;
}

export function formatAmountsInText(text) {
  return (text || '').replace(/\d+(?:\.\d+)*(?:,\d+)?/g, (token) => {
    const [intPart, decPart] = token.split(',');
    const digits = intPart.replace(/\./g, '');
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart !== undefined ? `${grouped},${decPart}` : grouped;
  });
}

export function initials(name) {
  return (name || '').split(' ').map((w) => w[0]).join('');
}

export function displayName(nom, prenom) {
  return `${(nom || '').toUpperCase()} ${prenom || ''}`.trim();
}

export function splitFullName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nom: '', prenom: '' };
  if (parts.length === 1) return { nom: parts[0], prenom: '' };
  return { nom: parts[parts.length - 1], prenom: parts.slice(0, -1).join(' ') };
}

export function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function downloadCsv(filename, rows) {
  const csvContent = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateAccessCode(length = 8) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ACCESS_CODE_ALPHABET[n % ACCESS_CODE_ALPHABET.length]).join('');
}

export const NIVEAUX = [
  'Maternelle', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle',
];

export const NATIONALITES = [
  'Béninoise', 'Burkinabè', 'Burundaise', 'Camerounaise', 'Centrafricaine', 'Congolaise (Brazzaville)', 
  'Congolaise (RDC)', 'Ivoirienne', 'Djiboutienne', 'Égyptienne', 'Érythréenne', 'Éthiopienne', 
  'Gabonaise', 'Gambienne', 'Ghanéenne', 'Guinéenne', 'Équato-guinéenne', 'Bissau-guinéenne', 
  'Kényane', 'Libérienne', 'Libyenne', 'Malgache', 'Malawienne', 'Malienne', 'Marocaine', 
  'Mauritanienne', 'Mauricienne', 'Mozambicaine', 'Namibienne', 'Nigérienne', 'Nigériane', 
  'Rwandaise', 'Sénégalaise', 'Seychelloise', 'Sierra-Léonaise', 'Somalienne', 'Sud-africaine', 
  'Soudanaise', 'Sud-soudanaise', 'Tanzanienne', 'Tchadienne', 'Togolaise', 'Tunisienne', 
  'Ougandaise', 'Zambienne', 'Zimbabwéenne', 'Française', 'Belge', 'Canadienne', 'Américaine', 
  'Algérienne', 'Allemande', 'Angolaise', 'Saoudienne', 'Argentine', 'Australienne', 'Autrichienne', 
  'Brésilienne', 'Britannique', 'Chinoise', 'Espagnole', 'Indienne', 'Italienne', 'Japonaise', 
  'Libanaise', 'Portugaise', 'Russe', 'Suisse', 'Turque', 'Autre'
];

export function sortClasses(list) {
  return [...list].sort((a, b) => {
    const diff = NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(b.niveau);
    if (diff !== 0) return diff;
    return (a.section || '').localeCompare(b.section || '');
  });
}

export const TRANCHES = [
  { id: 'tranche1', label: '1ère tranche' },
  { id: 'tranche2', label: '2ème tranche' },
  { id: 'tranche3', label: '3ème tranche' },
  { id: 'moitie', label: 'Moitié' },
  { id: 'complet', label: 'Complet' },
  { id: 'autre', label: 'Autre' },
];
export function trancheLabel(id) {
  return TRANCHES.find((t) => t.id === id)?.label || (id === 'partiel' ? 'Partiel' : id);
}

export const MODES = [
  { id: 'especes', label: 'Espèces' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'virement', label: 'Virement' },
  { id: 'cheque', label: 'Chèque' },
];
export function modeLabel(id) {
  return MODES.find((m) => m.id === id)?.label || id;
}

export const TYPES_FRAIS = [
  { id: 'scolarite', label: 'Scolarité' },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'inscription', label: 'Inscription' },
  { id: 'autre', label: 'Autre' },
  { id: 'solde_ouverture_ecolage', label: "Solde d'ouverture (écolage)", hidden: true },
  { id: 'solde_ouverture_connexe', label: "Solde d'ouverture (connexes)", hidden: true },
];
export function typeFraisLabel(id) {
  return TYPES_FRAIS.find((t) => t.id === id)?.label || id;
}

export const ROLES = {
  fondateur: { label: 'Fondateur' },
  directeur: { label: 'Directeur' },
  censeur: { label: 'Censeur' },
  secretaire: { label: 'Secrétaire' },
  enseignant: { label: 'Enseignant' },
  parent: { label: 'Parent' },
};

const ROLE_ORDER = ['fondateur', 'directeur', 'censeur', 'secretaire'];
export function sortByRole(list) {
  return [...list].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role);
    const rb = ROLE_ORDER.indexOf(b.role);
    return (ra === -1 ? ROLE_ORDER.length : ra) - (rb === -1 ? ROLE_ORDER.length : rb);
  });
}

export const SUPPORT_WHATSAPP_NUMBER = '22995056424';
export const SUPPORT_WHATSAPP_DISPLAY = '+229 95 05 64 24';
export const SUPPORT_EMAIL = 'ecoges3382@gmail.com';

export function supportWhatsappLink(message) {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
export function supportMailLink(subject) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

export function stickyColStyle(bg) {
  return {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    background: bg,
    borderRight: '1px solid var(--line)',
    transform: 'translateZ(0)',
    WebkitTransform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };
}
