This project has been created as part
of the 42 curriculum by rverhoev, akaya-oz, tfeuer, nsarmada, snijhuis.


# Documentation

## Table of Contents
- [Description](#description)
- [Instructions](#instructions)
- [Resources](#resources)
- [Team Information](#team-information)
- [Project Management](#project-management)
- [Technical Stack](#technical-stack)
- [Database Schema](#database-schema)
- [Feature List](#feature-list)
  - [Authentication & Security](#authentication--security)
  - [User Management](#user-management)
  - [Local Pong](#local-pong)
  - [Online Pong](#online-pong)
  - [AI Player](#ai-player)
  - [Tournaments](#tournaments)
  - [Friends & Social Features](#friends--social-features)
  - [Chat System](#chat-system)
  - [Additional Games](#additional-games)
  - [Graphics & UI](#graphics--ui)
  - [Internationalization (i18n)](#internationalization-i18n)
- [Modules](#modules)
- [Individual Contributions](#individual-contributions)


### description
<clear name for the project and its
key features>


### instructions
<all the needed prerequisites (software,
tools, versions, configuration like .env setup, etc.), and step-by-step instructions to
run the project>


### resources
<classic references related to the topic (documentation, articles, tutorials, etc.), as well as a description of how AI was used —
specifying for which tasks and which parts of the project>


### team-information
<For each team member mentioned at the top of the README.md, you must provide:
27
ft_transcendence Surprise.
◦ Assigned role(s): PO, PM, Tech Lead, Developers, etc.
◦ Brief description of their responsibilities>


### project-management
<◦ How the team organized the work (task distribution, meetings, etc.).
◦ Tools used for project management (GitHub Issues, Trello, etc.).
◦ Communication channels used (Discord, Slack, etc.)>


### technical-stack
<◦ Frontend technologies and frameworks used.
◦ Backend technologies and frameworks used.
◦ Database system and why it was chosen.
◦ Any other significant technologies or libraries.
◦ Justification for major technical choices>


### database-schema
<◦ Visual representation or description of the database structure.
◦ Tables/collections and their relationships.
◦ Key fields and data types>


### feature-list
<◦ Complete list of implemented features.
◦ Which team member(s) worked on each feature.
◦ Brief description of each feature’s functionality>

The following features are implemented:
#### Authentication & Security

#### User Management

#### Local Pong

#### Online Pong

#### AI Player

#### Tournaments

#### Friends & Social Features

#### Chat System

#### Additional Games

#### Graphics & UI

#### Internationalization (i18n)
The project has a custom i18n (internationalization) system.
Supported Languages:
- English (en)
- Dutch (nl)
- Turkish (tr)

(To be removed later):
How to add new translatable text:

1. Add your translation key to: `frontend/src/i18n/keys.js`
   Example: `MY_NEW_TEXT = 'MY_NEW_TEXT',`

2. Add the English text for this key to: `frontend/src/i18n/translations/en.js`
   Example: `[TranslationKey.MY_NEW_TEXT]: 'My English text',`

3. (if possible) add translations for all other languages (nl.js, tr.js)

How to use translations in Javascript:
```javascript
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";
```

**How to use translations in HTML:**
```html
<button data-i18n="BTN_START_GAME">START GAME</button>
```
The text will automatically update when language changes.
Frontend bottom-left corner has a language selector dropdown.


### modules
<◦ List of all chosen modules (Major and Minor).
◦ Point calculation (Major = 2pts, Minor = 1pt).
◦ Justification for each module choice, especially for custom "Modules of
choice".
◦ How each module was implemented.
◦ Which team member(s) worked on each module>


### individual-contributions
<◦ Detailed breakdown of what each team member contributed.
◦ Specific features, modules, or components implemented by each person.
◦ Any challenges faced and how they were overcome.
28
ft_transcendence Surprise.
Any other useful or relevant information is welcome (usage documentation, known
limitations, license, credits, etc.)>
