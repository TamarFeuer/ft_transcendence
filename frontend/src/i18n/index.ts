import { TranslationKey } from './keys';
import { en } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { tr } from './translations/tr';
import { nl } from './translations/nl';

// Re-export TranslationKey for convenience
export { TranslationKey } from './keys';

// Supported languages
export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  TR = 'tr',
  NL = 'nl',
}

// All translations
const translations: Record<Language, Record<TranslationKey, string>> = {
  [Language.EN]: en,
  [Language.ES]: es,
  [Language.FR]: fr,
  [Language.TR]: tr,
  [Language.NL]: nl,
};

// Current language state
let currentLanguage: Language = Language.EN;

// LocalStorage key
const STORAGE_KEY = 'app_language';

/**
 * Initialize i18n system - call this on app start
 */
export function initI18n(): void {
  const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
  if (saved && Object.values(Language).includes(saved)) {
    currentLanguage = saved;
  }
}

/**
 * Get current language
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Set language and persist to localStorage
 */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  // Dispatch event so UI can re-render
  window.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
}

/**
 * Translate a key to current language
 * Supports simple variable interpolation: {varName}
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let text = translations[currentLanguage][key];
  
  if (vars) {
    Object.entries(vars).forEach(([varKey, value]) => {
      text = text.replace(`{${varKey}}`, String(value));
    });
  }
  
  return text;
}

/**
 * Get all available languages for language selector
 */
export function getAvailableLanguages(): Array<{ code: Language; name: string }> {
  return [
    { code: Language.EN, name: 'English' },
    { code: Language.ES, name: 'Español' },
    { code: Language.FR, name: 'Français' },
    { code: Language.TR, name: 'Türkçe' },
    { code: Language.NL, name: 'Nederlands' },
  ];
}

/**
 * Translate and set element text content
 * Helper function for updating DOM elements
 */
export function translateElement(element: HTMLElement, key: TranslationKey, vars?: Record<string, string | number>): void {
  element.textContent = t(key, vars);
}

/**
 * Update all elements with data-i18n attribute
 * Usage: <button data-i18n="BTN_START_GAME">START GAME</button>
 */
export function updatePageTranslations(): void {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n') as TranslationKey;
    if (key && TranslationKey[key]) {
      element.textContent = t(TranslationKey[key]);
    }
  });
}
