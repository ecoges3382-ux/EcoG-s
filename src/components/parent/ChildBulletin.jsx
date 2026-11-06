import { useState, useEffect } from 'react';
import { PERIODES_BULLETIN, subjectPeriodeMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, subjectAnnualMoyenne, appreciation } from '../../lib/bulletin.js';
import { slug, isMobileDevice, loadHtml2Pdf, classifyNote, periodeLabel } from '../../lib/parentPortal.js';
import DocumentHeader from '../DocumentHeader.jsx';
import Dropdown from '../Dropdown.jsx';
import { Section } from './ChildFinance.jsx';

const PERIODE_OPTIONS = [...PERIODES_BULLETIN, 'annuel'];

function ColonneNotes({ titre, couleur, fond, notes }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: couleur, background: fond, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {titre}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
          {notes.length > 0 ? `(${notes.length})` : ''}
        </span>
      </div>
      {notes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}>
          Aucune note
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {notes.map((n, i) => {
            const dateAffichee = n.date_evaluation || n.created_at;
            return (
              <div key={n.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  {dateAffichee ? new Date(dateAffichee).toLocaleDateString('fr-FR') : `Note ${i + 1}`}
                </span>
                <span style={{ fontWeight: 700 }}>{n.note}/{n.sur}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChildBulletin({ detail, periode, setPeriode, onChangeYear }) {
  const { student, school, school_year: schoolYear, enrollment, years, grades, subjects, rangs } = detail;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFilename, setPdfFilename] = useState(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);

  const annuel = periode === 'annuel';

  const lignes = (subjects || []).map((su) => (
    annuel
      ? { ...su, t1: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 1'), t2: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 2'), t3: subjectPeriodeMoyenne(grades, student.id, su.id, 'Trimestre 3'), moyenne: subjectAnnualMoyenne(grades, student.id, su.id) }
      : { ...su, moyenne: subjectPeriodeMoyenne(grades, student.id, su.id, periode) }
  ));
  const moyenneGenerale = annuel ? annualMoyenneGenerale(subjects, grades, student.id) : periodeMoyenneGenerale(subjects, grades, student.id, periode);
  const rang = rangs?.[periode] || null;

  const notesDetaillees = (() => {
    const gradesPourPeriode = annuel ? (grades || []) : (grades || []).filter((g) => g.periode === periode);
    const parMatiere = {};
    gradesPourPeriode.forEach((g) => {
      if (!parMatiere[g.subject_id]) parMatiere[g.subject_id] = [];
      parMatiere[g.subject_id].push(g);
    });
    return Object.entries(parMatiere)
      .map(([subjectId, notes]) => {
        const subject = (subjects || []).find((s) => s.id === subjectId) || notes[0]?.subjects || null;
        const sortedNotes = [...notes].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        return { subjectId, subject, notes: sortedNotes };
      })
      .sort((a, b) => (a.subject?.nom || '').localeCompare(b.subject?.nom || ''));
  })();

  async function buildPdfBlob() {
    const html2pdf = await loadHtml2Pdf();
    const element = document.getElementById('bulletin-print');
    if (!element) throw new Error('Élément bulletin introuvable.');
    const filename = `bulletin-${slug(student.full_name)}-${slug(periodeLabel(periode))}.pdf`;
    const opt = {
      margin: 10, filename, image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
    return { blob, filename };
  }

  useEffect(() => {
    if (!enrollment) return;
    let cancelled = false;
    setPdfBlob(null);
    setPdfFilename(null);
    setPdfBuilding(true);

    const timer = setTimeout(async () => {
      try {
        const { blob, filename } = await buildPdfBlob();
        if (!cancelled) {
          setPdfBlob(blob);
          setPdfFilename(filename);
        }
      } catch (err) {
        console.error('Pré-génération PDF:', err);
      }
      if (!cancelled) setPdfBuilding(false);
    }, 800);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, enrollment?.id, student.full_name]);

  async function downloadBulletinPDF() {
    setPdfLoading(true);
    try {
      let blob = pdfBlob;
      let filename = pdfFilename;
      if (!blob) {
        const result = await buildPdfBlob();
        blob = result.blob;
        filename = result.filename;
      }
      const mobile = isMobileDevice();
      if (!mobile && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }] });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setPdfLoading(false);
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') { setPdfLoading(false); return; }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 3000);
    } catch (err) {
      console.error('Erreur PDF:', err);
      alert('Impossible de générer le PDF : ' + (err.message || 'inconnue'));
    }
    setPdfLoading(false);
  }

  async function shareBulletinPDF() {
    if (!pdfBlob) { alert('Le PDF est en cours de préparation, réessayez dans 2 secondes.'); return; }
    setPdfLoading(true);
    const file = new File([pdfBlob], pdfFilename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Bulletin scolaire', text: `Bulletin de ${student.full_name} — ${periodeLabel(periode)}` });
        setPdfLoading(false);
        return;
      } catch (err) {
        if (err.name === 'AbortError') { setPdfLoading(false); return; }
        console.error('Erreur navigator.share:', err);
      }
    }
    const mobile = isMobileDevice();
    try {
      if (!mobile && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: pdfFilename, types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }] });
          const writable = await handle.createWritable();
          await writable.write(pdfBlob);
          await writable.close();
          setPdfLoading(false);
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') { setPdfLoading(false); return; }
        }
      }
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 3000);
      if (mobile) alert("Le partage direct n'est pas disponible sur cet appareil.\nLe PDF a été téléchargé dans vos fichiers.");
    } catch (err) {
      console.error('Fallback partage PDF:', err);
      alert('Impossible de partager le PDF.');
    }
    setPdfLoading(false);
  }

  const shareDisabled = pdfLoading || pdfBuilding;

  return (
    <>
      {years?.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Année scolaire</label>
          <Dropdown value={schoolYear?.id || ''} onChange={onChangeYear} options={years.map((y) => ({ value: y.id, label: `${y.label}${y.is_current ? ' (en cours)' : ''}` }))} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }} wrapperStyle={{ width: 'auto', minWidth: 180 }} />
        </div>
      )}

      <Section title="Bulletin">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODE_OPTIONS.map((p) => (
            <button
              key={p} onClick={() => setPeriode(p)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${periode === p ? 'var(--forest)' : 'var(--line-strong)'}`, background: periode === p ? 'var(--forest)' : 'var(--paper)', color: periode === p ? '#fff' : 'var(--ink)' }}
            >
              {periodeLabel(p)}
            </button>
          ))}
        </div>

        <div id="bulletin-print" className="card-bold" style={{ padding: '18px 20px', overflow: 'hidden', backgroundColor: 'white' }}>
          <DocumentHeader school={school} title="Bulletin scolaire" subtitle={`${periodeLabel(periode)} · Année scolaire ${schoolYear?.label || ''}`} />
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600 }}>
            {student.full_name} · {enrollment.classe?.nom || '—'}
          </p>
          {lignes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune matière pour cette classe.</p>}
          {lignes.length > 0 && (
            annuel ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.5fr 0.5fr 0.6fr', padding: '0 0 8px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  <span>Matière</span><span>T1</span><span>T2</span><span>T3</span><span>Annuelle</span>
                </div>
                {lignes.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.5fr 0.5fr 0.5fr 0.6fr', padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center' }}>
                    <span>{l.nom}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t1 != null ? l.t1.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t2 != null ? l.t2.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.t3 != null ? l.t3.toFixed(2) : '—'}</span>
                    <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr', padding: '0 0 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  <span>Matière</span><span>Moyenne /20</span><span>Appréciation</span>
                </div>
                {lignes.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
                    <span>{l.nom}</span>
                    <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>{appreciation(l.moyenne) || '—'}</span>
                  </div>
                ))}
              </>
            )
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', background: 'var(--forest-light)', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: 'var(--forest-dark)' }}>Moyenne générale</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--forest-dark)' }}>{moyenneGenerale != null ? `${moyenneGenerale.toFixed(2)} / 20` : '—'}</p>
            </div>
            <div style={{ flex: '1 1 140px', background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Rang</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{rang ? `${rang.rang}${rang.rang === 1 ? 'er' : 'e'} / ${rang.total}` : 'Non classé'}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={downloadBulletinPDF} disabled={pdfLoading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: pdfLoading ? 'default' : 'pointer', opacity: pdfLoading ? 0.6 : 1 }}>
            <i className="ti ti-download" style={{ fontSize: 18 }} aria-hidden="true"></i>
            {pdfLoading ? 'Génération…' : 'Télécharger en PDF'}
          </button>
          <button type="button" onClick={shareBulletinPDF} disabled={shareDisabled} title={pdfBuilding ? 'PDF en cours de préparation…' : ''} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: shareDisabled ? 'default' : 'pointer', opacity: shareDisabled ? 0.6 : 1 }}>
            <i className="ti ti-share" style={{ fontSize: 18 }} aria-hidden="true"></i>
            {pdfBuilding ? 'Préparation…' : (pdfLoading ? 'Envoi…' : 'Partager')}
          </button>
        </div>
      </Section>

      <Section title={`Détail des notes — ${periodeLabel(periode)}`}>
        {notesDetaillees.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Aucune note enregistrée pour cette période.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {notesDetaillees.map(({ subjectId, subject, notes }) => {
              const devoirs = notes.filter((n) => classifyNote(n) === 'devoir');
              const examens = notes.filter((n) => classifyNote(n) === 'examen');
              const interros = notes.filter((n) => classifyNote(n) === 'interro');

              return (
                <div key={subjectId} className="card-bold" style={{ padding: '14px 18px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {subject?.nom || 'Matière inconnue'}
                    {subject?.coefficient && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-light)', padding: '2px 8px', borderRadius: 20 }}>
                        Coef. {subject.coefficient}
                      </span>
                    )}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: examens.length > 0 ? 12 : 0 }}>
                    <ColonneNotes titre="Interrogations" couleur="var(--forest)" fond="var(--forest-light)" notes={interros} />
                    <ColonneNotes titre="Devoirs" couleur="var(--clay-dark)" fond="var(--gold-light)" notes={devoirs} />
                  </div>

                  {examens.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <ColonneNotes titre="Examens" couleur="var(--danger)" fond="var(--danger-light)" notes={examens} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
