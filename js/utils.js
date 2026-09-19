function sendPrompt(text){
  alert("Dans l'application finale, cette action déclencherait :\n\n\"" + text + "\"");
}

function fmt(n){ return n.toLocaleString('fr-FR'); }
function initials(name){ return name.split(' ').map(w=>w[0]).join(''); }

function csvEscape(val){
  const s = String(val ?? "");
  if(s.includes(',') || s.includes('"') || s.includes('\n')){
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}

function downloadCsv(filename, rows){
  const csvContent = rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(["﻿" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
