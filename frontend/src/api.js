
export const API = "http://localhost:5000/api";

// Attach the login token to API requests when one exists.
export async function request(url, options = {}) {
  const token = sessionStorage.getItem("authToken");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed.");
  }

  return data;
}

export function formatMoney(amount) {
  const value = Number(amount ?? 0);
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: value % 1 ? 2 : 0,
  })}`;
}
