import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import { SUPPORTED_LANGUAGES, UNAVAILABLE_LANGUAGES } from "../i18n/languages";

// BL-15 / UC-08: language settings. Supported languages switch the interface straight away.
// The "not available yet" options exist so that choosing an unsupported language can be
// handled properly: it is not applied and the passenger is told why (UC-08 alt. flow 2a-2c).
export default function LanguageSelector() {
  const { lang, t, selectLanguage } = useI18n();
  const [notice, setNotice] = useState(null);

  // The message disappears by itself after a few seconds.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleChange(event) {
    const result = await selectLanguage(event.target.value);
    setNotice({ ok: result.ok, text: result.message });
  }

  return (
    <div className="language-selector">
      <label>
        <span className="language-label">🌐 {t("language.label")}</span>
        <select
          value={lang}
          onChange={handleChange}
          aria-describedby="language-status"
        >
          <optgroup label={t("language.available")}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <option value={language.code} key={language.code}>
                {language.nativeName}
                {language.nativeName !== language.name ? ` (${language.name})` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("language.unavailable")}>
            {UNAVAILABLE_LANGUAGES.map((language) => (
              <option value={language.code} key={language.code}>
                {language.nativeName} ({language.name})
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <p
        id="language-status"
        className={`language-status ${notice ? (notice.ok ? "ok" : "error") : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice ? notice.text : ""}
      </p>
    </div>
  );
}
