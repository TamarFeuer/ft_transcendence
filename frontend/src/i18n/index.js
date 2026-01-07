import { TranslationKey } from './keys';
import { en } from './translations/en';
import { nl } from './translations/nl';
import { tr } from './translations/tr';

// Re-export TranslationKey for convenience
export { TranslationKey } from './keys';

// Supported languages
export const Language = {
  EN: 'en',
  NL: 'nl',
  TR: 'tr',
};

// All translations
const translations = {
  [Language.EN]: en,
  [Language.NL]: nl,
  [Language.TR]: tr,
};

// Current language state
let currentLanguage = Language.EN;

// LocalStorage key
const STORAGE_KEY = 'app_language';

/**
 * Initialize i18n system - call this on app start
 */
export function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && Object.values(Language).includes(saved)) {
    currentLanguage = saved;
  }
}

/**
 * Get current language
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Set language and persist to localStorage
 */
export function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  // Dispatch event so UI can re-render
  window.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
}

/**
 * Translate a key to current language
 * Supports simple variable interpolation: {varName}
 */
export function t(key, vars) {
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
export function getAvailableLanguages() {
  return [
    { code: Language.EN, name: 'English' },
    { code: Language.NL, name: 'Nederlands' },
    { code: Language.TR, name: 'Türkçe' },
  ];
}

/**
 * Translate and set element text content
 * Helper function for updating DOM elements
 */
export function translateElement(element, key, vars) {
  element.textContent = t(key, vars);
}

/**
 * Update all elements with data-i18n attribute
 * Usage: <button data-i18n="BTN_START_GAME">START GAME</button>
 */
export function updatePageTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key && TranslationKey[key]) {
      element.textContent = t(TranslationKey[key]);
    }
  });
}

/**
 * Simple pluralization support
 * Usage: pluralize('ITEMS', 5) with translations like:
 * { ITEMS_zero: "no items", ITEMS_one: "1 item", ITEMS_other: "{count} items" }
 */
export function pluralize(key, count) {
  const pluralRules = new Intl.PluralRules(currentLanguage);
  const rule = pluralRules.select(count);
  const pluralKey = `${key}_${rule}`;
  
  // Try plural key first, fallback to base key
  return t(pluralKey, { count }) || t(key, { count });
}

/**
 * Format date according to current locale
 * Usage: formatDate(new Date(), { dateStyle: 'long' })
 */
export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat(currentLanguage, options).format(date);
}

/**
 * Format a number according to current locale
 * Usage: formatNumber(1234.56) => "1,234.56" (EN) or "1.234,56" (NL)
 */
export function formatNumber(number, options = {}) {
  return new Intl.NumberFormat(currentLanguage, options).format(number);
}
