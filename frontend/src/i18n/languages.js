// BL-15: languages the interface supports (UC-08). Keep in step with
// backend/src/config/languages.js, which validates the saved preference.
export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
];

// Shown in the language menu but not applied: choosing one explains that it is not supported
// yet (UC-08 alternate flow 2a-2c).
export const UNAVAILABLE_LANGUAGES = [
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
];

export function isSupportedLanguage(code) {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

export function languageDisplayName(code) {
  const language = [...SUPPORTED_LANGUAGES, ...UNAVAILABLE_LANGUAGES].find(
    (item) => item.code === code
  );
  if (!language) return String(code);
  return language.nativeName === language.name
    ? language.name
    : `${language.nativeName} (${language.name})`;
}
