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

export const NIVEAUX = [
  'Maternelle', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle',
];

export const ROLES = {
  fondateur: { label: 'Fondateur' },
  directeur: { label: 'Directeur' },
  secretaire: { label: 'Secrétaire' },
  enseignant: { label: 'Enseignant' },
};
