export function fmt(n) {
  return Number(n ?? 0).toLocaleString('fr-FR');
}

export function initials(name) {
  return (name || '').split(' ').map((w) => w[0]).join('');
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

export const ROLES = {
  fondateur: { label: 'Fondateur' },
  directeur: { label: 'Directeur' },
  secretaire: { label: 'Secrétaire' },
  enseignant: { label: 'Enseignant' },
  parent: { label: 'Parent' },
};
