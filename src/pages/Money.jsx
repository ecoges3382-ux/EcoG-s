--- src/pages/Money.jsx
+++ src/pages/Money.jsx
@@
   async function decide(id, statut) {
     const { error: updateError } = await supabase.from('salary_advances').update({ statut }).eq('id', id);
     if (updateError) setError(updateError.message);
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
+      .update({
+        montant_rembourse: Number(a.montant),
+        statut: 'remboursee',
+      })
+      .eq('id', a.id);
+
+    if (updateError) setError(updateError.message);
+    else {
+      showToast('Avance marquée comme payée');
+      reload();
+    }
+  }
@@
-              {canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
+              {canDecide && a.statut === 'approuvee' && Number(a.solde) > 0 ? (
+                <button onClick={() => markAsPaid(a)}>
+                  <i className="ti ti-check" aria-hidden="true"></i>
+                  Marquer après déduction
+                </button>
+              ) : canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
@@
   const map = {
     approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
+    remboursee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
--- src/pages/StaffDetail.jsx
+++ src/pages/StaffDetail.jsx
@@
 const ADVANCE_STATUS = {
   approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
+  remboursee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
   refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
@@
-  const enCours = advances.filter((a) => a.statut !== 'approuvee' && a.statut !== 'refusee');
+  const enCours = advances.filter((a) => ['approuvee', 'remboursee', 'refusee'].includes(a.statut));
