
### run from frontend/;
npm install
### run so that vite bundles everything;
npm run build
### to preview, use;
npm run preview

### INSTRUCTIONS FOR LANGUAGE SUPPORT

The project now has a custom i18n (internationalization) system.

**How to add new translatable text:**

1. Add your translation key to: `frontend/src/i18n/keys.js`
   Example: `MY_NEW_TEXT = 'MY_NEW_TEXT',`

2. Add the English text for this key to: `frontend/src/i18n/translations/en.js`
   Example: `[TranslationKey.MY_NEW_TEXT]: 'My English text',`

3. (if possible) add translations for all other languages (nl.js, tr.js)

**How to use translations in Javascript:**
```javascript
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";
```

**How to use translations in HTML:**
```html
<button data-i18n="BTN_START_GAME">START GAME</button>
```
The text will automatically update when language changes.

**Supported Languages:**
- English (en)
- Dutch (nl)
- Turkish (tr)

**Location:** Frontend bottom-left corner has a language selector dropdown.

### ONGOING WORK:

- single player ai
- tournament mode
- multiple players more than 2 up to 8
- Other games
- ...