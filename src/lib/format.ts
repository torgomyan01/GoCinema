/** Deterministic AMD price (space thousands) — avoids SSR/client locale mismatch. */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
