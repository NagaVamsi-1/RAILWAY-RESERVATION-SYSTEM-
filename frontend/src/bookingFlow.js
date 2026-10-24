// Non-sensitive search/selection state is kept in sessionStorage so a refresh on
// the passenger page does not lose the chosen train. Payment details and
// passenger data are never stored.
const KEY = "rrs.search";

export const emptySearch = {
  source: "Bengaluru",
  destination: "Chennai",
  date: "2026-11-01",
  trains: [],
  selectedTrain: null,
  travelClass: "",
};

export function loadSearch() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...emptySearch, ...JSON.parse(raw) } : emptySearch;
  } catch {
    return emptySearch;
  }
}

export function saveSearch(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: state simply will not survive refresh */
  }
}

export function clearSearch() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function trainKey(train) {
  return String(train?.number || train?.id || "");
}

export function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
