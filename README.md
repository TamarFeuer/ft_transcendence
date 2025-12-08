
run from frontend/;
npm install
run so that vite bundles everything;
npm run build
to preview, use;
npm run preview

INSTRUCTIONS FOR LANGUAGE SUPPORT

The project now has a custom enum-based i18n (internationalization) system.

**How to add new translatable text:**

1. Add your translation key to: `/workspaces/ft_transcendence/frontend/src/i18n/keys.ts`
   Example: `MY_NEW_TEXT = 'MY_NEW_TEXT',`

2. Add the English text for this key to: `/workspaces/ft_transcendence/frontend/src/i18n/translations/en.ts`
   Example: `[TranslationKey.MY_NEW_TEXT]: 'My English text',`

3. Add translations for all other languages (es.ts, fr.ts, tr.ts, nl.ts)

**How to use translations in TypeScript:**
```typescript
import { t, TranslationKey } from './i18n';

// Simple translation
const text = t(TranslationKey.MY_NEW_TEXT);

// With variables
const msg = t(TranslationKey.MSG_PLAYER_WINS, { player: 'John' });
alert(msg); // "John wins!"
```

**How to use translations in HTML:**
```html
<button data-i18n="BTN_START_GAME">START GAME</button>
```
The text will automatically update when language changes.

**Supported Languages:**
- English (en)
- Spanish (es)
- French (fr)
- Turkish (tr)
- Dutch (nl)

**Location:** Frontend top-right corner has a language selector dropdown.


TODO:

single player ai => Goksu is searching for the best algo :)
tournament mode
multiple players more than 2 up to 8
Other games => 2 games are added however they are not supporting some of the subject needs
