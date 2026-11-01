import { useCallback, useEffect, useMemo, useState } from "react";
import { API, request } from "../api";
import { I18nContext } from "./I18nContext";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  languageDisplayName,
  SUPPORTED_LANGUAGES,
} from "./languages";
import { translate } from "./translate";

const STORAGE_KEY = "rrs.language";

// The language is a harmless preference, so it may live in localStorage and survive logout.
function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function storeLanguage(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable: the choice simply will not survive a refresh */
  }
}

function saveLanguageOnServer(code) {
  return request(`${API}/users/me/language`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: code }),
  });
}

// UC-08: the passenger picks a language and the interface text switches to it.
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key, vars, fallback) => translate(lang, key, vars, fallback),
    [lang]
  );

  // Translates a city name for display; unknown names are shown as they are.
  const city = useCallback(
    (name) => translate(lang, `city.${name}`, undefined, name),
    [lang]
  );

  // Translates a train name by train number or name; unknown ones fall back to the original name.
  const train = useCallback(
    (identifier, fallbackName) => {
      const fallback = fallbackName || identifier;
      if (!identifier) return fallback;

      // First try "train.<number>", then "train.<name>", then fall back to original name
      const byId = translate(lang, `train.${identifier}`, undefined, null);
      if (byId) return byId;

      if (fallbackName) {
        const byName = translate(lang, `train.${fallbackName}`, undefined, null);
        if (byName) return byName;
      }

      return fallback;
    },
    [lang]
  );

  // Returns { ok, message }. An unsupported language is never applied (UC-08 step 2a).
  const selectLanguage = useCallback(
    async (code) => {
      if (!isSupportedLanguage(code)) {
        return {
          ok: false,
          message: translate(lang, "language.unsupported", {
            language: languageDisplayName(code),
          }),
        };
      }

      const previous = lang;
      setLang(code);
      storeLanguage(code);

      // Signed-in passengers also keep the choice on their account.
      if (sessionStorage.getItem("authToken")) {
        try {
          await saveLanguageOnServer(code);
        } catch (error) {
          // The server explicitly refused the language: undo it. A network problem only
          // means it was not saved to the account; the page language still changes.
          if (error.status === 400) {
            setLang(previous);
            storeLanguage(previous);
            return { ok: false, message: error.message };
          }
        }
      }

      return {
        ok: true,
        message: translate(code, "language.changed", {
          language: languageDisplayName(code),
        }),
      };
    },
    [lang]
  );

  // After login: use the language saved on the account, or save the one already chosen.
  const syncAfterLogin = useCallback(
    async (user) => {
      if (isSupportedLanguage(user?.preferredLanguage)) {
        setLang(user.preferredLanguage);
        storeLanguage(user.preferredLanguage);
      } else if (lang !== DEFAULT_LANGUAGE) {
        try {
          await saveLanguageOnServer(lang);
        } catch {
          /* not saved to the account; the page language is unaffected */
        }
      }
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      t,
      city,
      train,
      selectLanguage,
      syncAfterLogin,
      languages: SUPPORTED_LANGUAGES,
    }),
    [lang, t, city, train, selectLanguage, syncAfterLogin]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}