/** Rehidrata el detalle de tecnología sin `location.reload` cuando el bootstrap CSR está registrado. */
export async function refreshTechnologyDetailPage() {
  const boot = window.skillatlas?.bootstrapTechnologyDetailPage;
  if (typeof boot === "function") await boot();
  else window.location.reload();
}
