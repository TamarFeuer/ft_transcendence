import { TranslationKey } from './keys.js';
import { en } from './translations/en.js';
import { nl } from './translations/nl.js';
import { tr } from './translations/tr.js';

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

  // Support placeholder translations: data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key && TranslationKey[key]) {
      if (element.placeholder !== undefined) {
        element.placeholder = t(TranslationKey[key]);
      } else {
        element.setAttribute('placeholder', t(TranslationKey[key]));
      }
    }
  });
}

