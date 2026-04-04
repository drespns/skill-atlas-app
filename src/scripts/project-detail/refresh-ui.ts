/** Rehidrata el detalle de proyecto sin `location.reload` cuando el bootstrap CSR está registrado. */
export async function refreshProjectDetailPage() {
  const boot = window.skillatlas?.bootstrapProjectDetailPage;
  if (typeof boot === "function") await boot();
  else window.location.reload();
}
