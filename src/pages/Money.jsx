--- a/src/pages/Money.jsx
+++ b/src/pages/Money.jsx
@@ -730,6 +730,18 @@ function Advances() {
     else { showToast('Enregistré'); reload(); }
   }
 
+  async function markAsPaid(a) {
+    if (!(await confirm(
+      `Confirmer que ${fmtF(a.montant)} a été déduit du salaire de ${a.staff?.full_name || 'ce membre du personnel'} ?`,
+      { confirmLabel: 'Marquer comme payée' }
+    ))) return;
+
+    const { error: updateError } = await supabase
+      .from('salary_advances')
+      .update({ montant_rembourse: Number(a.montant), statut: 'remboursee' })
+      .eq('id', a.id);
+
+    if (updateError) setError(updateError.message);
+    else { showToast('Avance marquée comme payée'); reload(); }
+  }
+
   // Uniquement tant que la demande n'a pas encore été statuée — une fois
   // approuvée ou refusée (potentiellement déjà partiellement remboursée),
   // elle reste dans l'historique, comme les autres registres financiers.
@@ -770,7 +782,13 @@ function Advances() {
             {a.motif && <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: 'var(--muted)' }}>{a.motif}</p>}
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
               <StatusBadge statut={a.statut} />
-              {canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
+              {canDecide && a.statut === 'approuvee' ? (
+                <button onClick={() => markAsPaid(a)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>
+                  <i className="ti ti-check" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
+                  Marquer comme payé
+                </button>
+              ) : canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
                 <div>
                   <button onClick={() => decide(a.id, 'approuvee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', marginRight: 6 }}>Approuver</button>
                   <button onClick={() => decide(a.id, 'refusee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', marginRight: 6 }}>Refuser</button>
@@ -826,6 +844,7 @@ function StatusBadge({ statut }) {
 function StatusBadge({ statut }) {
   const map = {
     approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
+    remboursee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
     refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
     attente_directeur: { label: 'Attente directeur', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
     attente_fondateur: { label: 'Attente fondateur', bg: 'var(--amber-light)', fg: 'var(--amber)' },
