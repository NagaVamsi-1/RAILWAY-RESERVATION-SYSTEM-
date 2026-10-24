import { useEffect, useState } from "react";

// Tiny hash router (react-router is not installed; hash routes survive refresh
// and direct navigation with no dev-server configuration).
function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

export function navigate(to) {
  window.location.hash = to;
  window.scrollTo(0, 0);
}
