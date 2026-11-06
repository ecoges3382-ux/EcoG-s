export function slug(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

export function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const existing = document.querySelector('script[data-html2pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('CDN html2pdf inaccessible.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.setAttribute('data-html2pdf', 'true');
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('CDN html2pdf inaccessible.'));
    document.head.appendChild(script);
  });
}

export const normalizeType = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function classifyNote(n) {
  const t = normalizeType(n.type);
  if (t.includes('devoir')) return 'devoir';
  if (t.includes('examen')) return 'examen';
  return 'interro';
}

export function toCalcEnrollment(e) {
  return {
    montant_du: e.montant_du,
    montant_paye: e.montant_paye,
    frais_connexe_du: e.frais_connexe_du,
    frais_connexe_paye: e.frais_connexe_paye,
    note_arrangement: e.has_arrangement ? 'arrangement actif' : null,
  };
}

export function periodeLabel(p) {
  return p === 'annuel' ? 'Année complète' : p;
}
