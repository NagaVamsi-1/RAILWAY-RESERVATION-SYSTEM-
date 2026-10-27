export const API = "http://localhost:5000/api";

// Small fetch wrapper used by the payment / PNR / cancellation components.
export async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed.");
  }

  return data;
}

export function formatMoney(amount) {
  const value = Number(amount ?? 0);
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: value % 1 ? 2 : 0 })}`;
}
