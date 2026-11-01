import en from "./translations/en";
import hi from "./translations/hi";
import kn from "./translations/kn";
import ta from "./translations/ta";

const CATALOGUES = { en, hi, kn, ta };

/**
 * Looks up `key` in the chosen language, then in English, then returns `fallback`
 * (or the key itself). `{name}` placeholders are filled from `vars`.
 */
export function translate(lang, key, vars, fallback) {
  const text = CATALOGUES[lang]?.[key] ?? en[key] ?? fallback ?? key;

  if (!vars) return text;

  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export const CATALOGUE_CODES = Object.keys(CATALOGUES);
