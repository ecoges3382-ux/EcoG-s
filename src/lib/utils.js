// Séparateur de milliers "." et décimales "," (ex. 125.375,43) — demandé
// explicitement, à la place de l'espace utilisé par la locale fr-FR.
export function fmt(n) {
  return Number(n ?? 0).toLocaleString('de-DE');
}

// Pour tout montant affiché à l'écran (pas les exports CSV, qui gardent
// des nombres bruts) : "F" tout court ne précise pas de quel franc il
// s'agit, ici c'est toujours le franc CFA.
export function fmtF(n) {
  return `${fmt(n)} F CFA`;
}

export function initials(name) {
  return (name || '').split(' ').map((w) => w[0]).join('');
}

// Format d'affichage des noms dans toute l'app : "NOM Prénom" — le nom de
// famille toujours en majuscules, même saisi en minuscule.
export function displayName(nom, prenom) {
  return `${(nom || '').toUpperCase()} ${prenom || ''}`.trim();
}

// Découpe un nom complet libre (une seule colonne dans un import CSV, par
// exemple) en { nom, prenom } — le dernier mot devient le nom de famille.
// Best-effort seulement : à utiliser en dernier recours, quand on n'a pas
// de champs Nom/Prénom déjà séparés à la saisie.
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

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) — un code d'accès
// parent doit rester lisible et saisissable facilement depuis un téléphone.
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

// Trie les classes dans l'ordre pédagogique (Maternelle → Terminale), pas
// alphabétique (où "6e" passerait avant "CE1") ni par date de création.
export function sortClasses(list) {
  return [...list].sort((a, b) => {
    const diff = NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(b.niveau);
    if (diff !== 0) return diff;
    return (a.section || '').localeCompare(b.section || '');
  });
}

export const ROLES = {
  fondateur: { label: 'Fondateur' },
  directeur: { label: 'Directeur' },
  censeur: { label: 'Censeur' },
  secretaire: { label: 'Secrétaire' },
  enseignant: { label: 'Enseignant' },
  parent: { label: 'Parent' },
};

// Ordre hiérarchique d'affichage des comptes utilisateurs, valable pour
// toutes les écoles : fondateur, puis directeur, puis censeur (s'il y en a
// un), puis secrétaire, puis tout le reste (dans l'ordre où ils arrivaient
// déjà, généralement alphabétique).
const ROLE_ORDER = ['fondateur', 'directeur', 'censeur', 'secretaire'];
export function sortByRole(list) {
  return [...list].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role);
    const rb = ROLE_ORDER.indexOf(b.role);
    return (ra === -1 ? ROLE_ORDER.length : ra) - (rb === -1 ? ROLE_ORDER.length : rb);
  });
}
