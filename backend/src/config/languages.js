// BL-15: Languages the interface supports (UC-08, FR-08, NFR-04).
// The translations themselves live in the frontend (frontend/src/i18n); this list is the
// server-side source of truth used to validate a passenger's saved language preference.
const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
];

const DEFAULT_LANGUAGE = "en";

const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((language) => language.code);

function isSupportedLanguage(code) {
  return typeof code === "string" && LANGUAGE_CODES.includes(code.trim().toLowerCase());
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  isSupportedLanguage,
};
