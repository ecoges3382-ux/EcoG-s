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

// Normalise un numéro saisi localement (ex. "97 00 00 00" ou "0197000000")
// au format E.164 attendu par Supabase Auth. Un numéro déjà écrit avec un
// "+" (n'importe quel pays) est laissé tel quel — seul le cas local sans
// indicatif suppose le Bénin (+229), contexte de déploiement de l'appli.
export function formatPhoneE164(raw, defaultCountryCode = '229') {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  const withoutTrunkZero = cleaned.replace(/^0+/, '');
  return `+${defaultCountryCode}${withoutTrunkZero}`;
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
