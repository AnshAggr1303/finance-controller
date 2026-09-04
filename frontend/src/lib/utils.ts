/**
 * Utility functions for currency and date formatting in ReconAI
 */

export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0.00";
  
  // Format using standard Indian numbering system (e.g. ₹3,48,250.00)
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(ts?: string | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    // e.g. "14:32:08 UTC"
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    const seconds = String(d.getUTCSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds} UTC`;
  } catch {
    return ts;
  }
}
