This project has been created as part
of the 42 curriculum by rverhoev, akaya-oz, tfeuer, nsarmada, snijhuis.


# Documentation

## Table of Contents
- [Description](#description)
- [Instructions](#instructions)
- [Resources](#resources)
- [Team Information](#team-information)
- [Project Management](#project-management)
  - [Tools](#tools)
  - [Process](#process)
  - [Onboarding](#onboarding)
  - [Communication Channels](#communication-channels)
- [Technical Stack](#technical-stack)
- [Database Schema](#database-schema)
  - [Chat, Friends & Block](#chat-friends--block)
  - [Pong Stats & Chess](#pong-stats--chess)
  - [Tournament](#tournament)
- [Feature List](#feature-list)
  - [Authentication & Security](#authentication--security)
  - [User Management](#user-management)
  - [Local Pong](#local-pong)
  - [Online Pong](#online-pong)
  - [AI Player](#ai-player)
  - [Tournaments](#tournaments)
  - [Chess](#chess)
    - [Chess REST API](#chess-rest-api)
    - [Chess WebSocket Protocol](#chess-websocket-protocol)
  - [Friends](#friends)
    - [Friends REST API](#friends-rest-api)
  - [Block](#block)
    - [Block REST API](#block-rest-api)
  - [Chat System](#chat-system)
    - [WebSocket Message Protocol](#websocket-message-protocol)
  - [Additional Games](#additional-games)
  - [Graphics & UI](#graphics--ui)
  - [Internationalization (i18n)](#internationalization-i18n)
- [Modules](#modules)
- [Individual Contributions](#individual-contributions)


### Description
<clear name for the project and its
key features>


### Instructions
<all the needed prerequisites (software,
tools, versions, configuration like .env setup, etc.), and step-by-step instructions to
run the project>

**Currently we build and run by: docker compose -d --build**


### Resources
<classic references related to the topic (documentation, articles, tutorials, etc.), as well as a description of how AI was used —
specifying for which tasks and which parts of the project>


### Team Information
<For each team member mentioned at the top of the README.md, you must provide:
◦ Assigned role(s): PO, PM, Tech Lead, Developers, etc.
◦ Brief description of their responsibilities>


### Project Management

The team's project management approach evolved over time, shaped in part by a LeanIT workshop given at Codam by Niels Loader from Eraneos, which introduced Agile and Scrum practices.

#### Tools

The backlog was initially set up on Trello and later migrated to GitHub Projects after the LeanIT workshop, so that issues, code, and project tracking would all live in the same place. User stories were written and maintained as GitHub Issues, with the initial backlog drafted and kept up to date by the PM.

#### Process

The team adopted a one-week sprint cadence, though in practice this was not always strictly followed. A weekly team meeting was scheduled for Mondays at 12:00 to sync on progress, surface blockers, and plan upcoming work.

A code review policy was established early in the project: pull requests must receive at least one approving review before being merged into `main`. The intent was to ensure that no code reaches the main branch without a second pair of eyes, both as a quality safeguard and as a way to spread knowledge across the team.

The structure of this README was also defined as part of the project management work, with individual sections then filled in by their respective owners.

#### Onboarding

As the team grew over the course of the project, onboarding new members was handled collaboratively: walking them through the existing codebase and project structure, explaining the team's processes (review policy, weekly meetings, project board), adding them to the relevant tools (Slack, GitHub repository, GitHub Projects), and pairing with them on their first issues or PRs.

#### Communication Channels

- **Slack** — primary channel for day-to-day discussion, decisions, and quick coordination
- **GitHub issue comments** — for discussion tied to specific user stories or tasks
- **GitHub PR comments** — for code review feedback and technical discussion
- **Weekly meetings** — for synchronous discussion, planning, and decisions


### Technical Stack
<◦ Frontend technologies and frameworks used.
◦ Backend technologies and frameworks used.
◦ Database system and why it was chosen.
◦ Any other significant technologies or libraries.
◦ Justification for major technical choices>


### Database Schema

The database is PostgreSQL. The schema is split into three diagrams by domain.

#### Chat, Friends & Block

Centres on `auth_user`. Friend requests and blocks are direct user-to-user relationships. Chat is built around a `Conversation` container — messages, participants, and game invites all hang off it. `ConversationParticipant` tracks per-user state (unread count, read timestamp, tab visibility).

![Chat, Friends & Block](docs/images/chat_diagram.png)

##### Example Data

Sample data from a test session (users: tamar=1, Alascode331=2, The_cat=3, PongLover59=4):

![Chat Tables](docs/images/chat_tables.png)

#### Pong Stats & Chess

Each user gets a `stats_players` profile (auto-created on registration) that accumulates pong stats and ELO. Matches reference players, not users directly. Achievements are defined once in `stats_achievements` and linked to players via `stats_player_achievements`. Chess has its own parallel player and match tables with separate ELO tracking.

![Pong Stats & Chess](docs/images/stats-chess_diagram.png)

#### Tournament

A `Tournament` is created by a user and has many `TournamentParticipant` rows (one per registered player) and many `TournamentGame` rows (one per match in the bracket). Games reference users directly and track round, status, and the external `game_id` used to link to the live pong session.

![Tournament](docs/images/tournament_diagram.png)


### Feature List
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

#### Chess

Chess is implemented as a second game mode alongside Pong. Players switch between Pong and Chess from the home hub (`/`). The frontend uses [chess.js](https://github.com/jhlywa/chess.js) for rules and move validation in the browser; the backend uses [python-chess](https://python-chess.readthedocs.io/) as the source of truth for online games. Piece graphics are Cburnett-style SVGs in `frontend/public/chess-pieces/`.

**Modes:**

| Mode | Route | Auth | Description |
|------|-------|------|-------------|
| Local (hot-seat) | `/chess` | Required | Two players on one device; rules enforced client-side only. |
| Online matchmaking | `/chess-online` | Required | Join or create a lobby via REST, then play over WebSocket. |
| Friend invite | `/chess-online?gameId=…` | Required | Invitor creates a private session via chat; invitee accepts and connects to the same `gameId`. |

Online play is only entered intentionally: the home **Online Game** button sets a flag before navigation, or the user follows an invite link with `gameId` in the query string. A bare refresh or direct visit to `/chess-online` without either is redirected away.

Active chess sessions mark both players in `IN_GAME_USERS` (shared with Pong and chat), which blocks duplicate games and updates the chat online list. Game results are broadcast on the global chat WebSocket as `gameResult` with `game_type: "chess"`.

##### Chess REST API

All endpoints are under `/api/chess/`. Authentication via JWT cookie (`access_token`), same as other protected APIs.

###### `POST /api/chess/join/`

Create a new game or join an open waiting lobby (matchmaking). For friend invites, pass the invitee’s user ID; the session is invite-only until that user joins.

```json
Request (matchmaking):  {}
Request (invite):       { "invitee_id": 42 }
Response:               { "gameId": "a1b2c3d4-..." }
```

Matchmaking skips sessions that already have an `invitee_id` (invite-only tables). Colors are assigned when the session is created (random for the creator) or when the second player joins; the WebSocket connect order does not decide colors.

###### `GET /api/chess/stats/`

Current user’s chess record. Returns defaults if the user has never played.

```json
Response: {
  "total_games": 12,
  "total_wins": 7,
  "total_losses": 5,
  "elo_rating": 1248
}
```

###### `GET /api/chess/leaderboard/`

Top 10 players by ELO (public).

```json
Response: {
  "leaderboard": [
    { "username": "tamar", "elo_rating": 1350, "total_wins": 20, "total_games": 30 }
  ]
}
```

###### `GET /api/chess/match-history/`

Last 20 matches for the authenticated user.

```json
Response: {
  "matches": [
    {
      "white": "tamar",
      "black": "rik",
      "opponent": "rik",
      "result": "1-0",
      "winner": "tamar",
      "timestamp": "2026-05-10T14:30:00.123456+00:00"
    }
  ]
}
```

`result` uses standard chess notation: `1-0`, `0-1`, `1/2-1/2`, or `abandonment` when a player disconnects mid-game.

The stats page is at `/chess-stats` (linked from the profile). Profile also shows chess wins, losses, and ELO when available.

---

##### Chess WebSocket Protocol

**Endpoint:** `ws(s)://<host>/ws/chess/<game_id>/`

Authenticated via `TokenAuthMiddleware` (JWT from cookies on the WebSocket handshake). After connect, the server assigns `white` or `black` and broadcasts game state to the `chess_<game_id>` channel group.

**Close codes:**

| Code | Meaning |
|------|---------|
| `4004` | Unknown or expired `game_id` |
| `4003` | Not a participant, table full, or user already in another active game |

---

**Frontend → Backend**

###### `move`

Send a move in UCI form (`from` + `to` squares, optional promotion). Only accepted when it is your turn and the game is `active`.

```json
{ "type": "move", "from": "e2", "to": "e4" }
{ "type": "move", "from": "e7", "to": "e8", "promotion": "q" }
```

Illegal moves receive a direct `illegal_move` message to the sender only (not broadcast).

---

**Backend → Frontend**

###### `assign`

Sent immediately after a successful connect.

```json
{ "type": "assign", "color": "white" }
```

###### `gameStart`

Both players connected; game is active. Board orientation: black’s client flips the view.

```json
{
  "type": "gameStart",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "white": "tamar",
  "black": "rik",
  "white_elo": 1200,
  "black_elo": 1185
}
```

###### `gameState`

Broadcast after every legal move.

```json
{
  "type": "gameState",
  "fen": "...",
  "turn": "black"
}
```

###### `gameOver`

Game ended (checkmate, draw, stalemate, or abandonment).

```json
{ "type": "gameOver", "winner": "white", "result": "1-0" }
{ "type": "gameOver", "winner": null, "result": "1/2-1/2" }
{ "type": "gameOver", "winner": "black", "result": "abandonment" }
```

On game over, ELO is updated (K-factor 40), a `ChessMatch` row is persisted, the in-memory `ChessSession` is removed, and a `gameResult` event is sent on global chat.

---

**Implementation notes**

- **In-memory games:** Active boards live in `ChessSession._games` (not the database). Only finished games are stored in `ChessMatch` / `ChessPlayer`.
- **ELO:** Default rating 1200; draws update both players with result `0.5` but are not counted separately in win/loss totals on `ChessPlayer`.
- **Chat invites:** Invitor calls `POST /api/chess/join/` with `invitee_id`, sends a chat `send_game_invite` with `game_type: "chess"`, and opens `/chess-online?gameId=…`. Acceptor uses the invite link in the DM; accepting clears competing invites when the game starts.
- **Frontend modules:** `frontend/src/chess/chess.js` (local + shared board UI), `chess-online.js` (WebSocket client), `chess-modal.js` (result overlay). Leaving `/chess-online` closes the socket via `closeChessConnection()` in the router.

#### Friends

Friends are managed from your own profile (`/profile`). Other users’ profiles (`/profile/:username`) show stats and match history only — friend actions are not available there.

Friendships are stored as a single `FriendRequest` row between two users with `status: "accepted"`. Pending and declined requests use the same model. There is no separate friends join table.

**UI flow (own profile):**

| Section | Action |
|---------|--------|
| Add Friend | Enter a username and send a request (`POST /api/friends/send`). |
| Pending Requests | Incoming requests with Accept / Decline. |
| Friends | List of accepted friends, sorted online first (using the chat `onlineUsers` map), with Remove per friend. |

**Business rules:**

- Cannot send a request to yourself.
- Cannot send if either user has blocked the other (`is_blocked` from the block app).
- Cannot send if already friends (an accepted request exists in either direction).
- Cannot send a duplicate outgoing request while one is still `pending` (declined requests can be sent again).
- **Mutual pending auto-accept:** If user B already sent a pending request to user A, and A sends a request to B, the existing request is accepted immediately (both become friends without B pressing Accept).
- **Blocking removes friendship:** `POST /api/block/` deletes any accepted `FriendRequest` between the two users (see [Block](#block)).

**Real-time updates:** The profile page listens for the browser event `friendListChanged`. Chat WebSocket delivers `{ "type": "friendListChanged" }` after a block is reported (`report_blocked_user`), which triggers a friends list refresh. Accept/decline/remove also re-render the list directly after the REST call succeeds.

**Frontend modules:** `frontend/src/users_friends/friends.js` (API helpers), `profilePage.js` (UI). All requests use `fetchWithRefreshAuth` (JWT cookies + token refresh).

---

##### Friends REST API

All endpoints are under `/api/friends/`. Authentication via JWT cookie (`access_token`).

###### `POST /api/friends/send`

Send a friend request by target username.

```json
Request:  { "to_username": "rik" }
Response: { "success": true, "message": "Friend request sent to rik" }
```

Possible errors: `400` (self-request, already friends, pending duplicate, blocked), `404` (user not found), `401` (not authenticated).

Auto-accept response when the other user already has a pending request to you:

```json
Response: { "success": true, "message": "You are now friends with rik" }
```

###### `GET /api/friends/pending`

List incoming pending requests for the authenticated user.

```json
Response: {
  "requests": [
    { "id": 3, "from_user__username": "tamar", "status": "pending" }
  ]
}
```

###### `POST /api/friends/accept`

Accept a pending request. Only the recipient (`to_user`) may accept.

```json
Request:  { "request_id": 3 }
Response: { "success": true }
```

Errors: `403` (not your request), `400` (already processed), `404` (request not found).

###### `POST /api/friends/delete`

Decline a pending request (sets status to `declined`). Only the recipient may decline.

```json
Request:  { "request_id": 3 }
Response: { "success": true }
```

###### `GET /api/friends/list`

Return all accepted friends of the authenticated user.

```json
Response: {
  "friends": [
    { "id": 7, "username": "rik" },
    { "id": 42, "username": "tamar" }
  ]
}
```

The frontend splits this list into online vs offline using chat presence (`onlineUsers`).

###### `POST /api/friends/remove`

Remove an accepted friendship by the other user’s ID. Deletes the `FriendRequest` row (either direction).

```json
Request:  { "friend_id": 7 }
Response: {
  "success": true,
  "message": "You have successfully removed rik from your friends list"
}
```

---

**Data model (`friends.FriendRequest`):**

| Field | Description |
|-------|-------------|
| `from_user` | User who sent the request |
| `to_user` | User who receives the request |
| `status` | `pending`, `accepted`, or `declined` |
| `created_at` / `updated_at` | Timestamps |

#### Block

Blocking is available from the chat context menu (right-click an online user). Blocks are stored as a `Block` row in the database.

**Business rules:**

- Blocking a user removes any existing friendship between the two users.
- Once blocked, neither the blocker nor the blocked user can send messages to each other. The chat input is replaced with a notice: _"You have blocked this user."_ for the blocker and _"You have been blocked."_ for the blocked user.
- If either user closes the DM tab after a block, they cannot reopen it until the block is lifted.
- Blocking does not interrupt an ongoing game — if a game is already in progress, it continues to completion. This prevents blocking from being used as a way to abandon a losing game.
- Users you have blocked are still visible in the online users list so you can unblock them. Users who blocked you are hidden from your list.

**Real-time updates:** After a block is saved via the REST API, the frontend calls `reportBlockedUser()` over the chat WebSocket. This notifies the consumer to cancel any pending game invites between the two users, broadcast an updated online users list, and send `friendListChanged` to both users.

---

##### Block REST API

All endpoints are under `/api/block/`. Authentication via JWT cookie (`access_token`).

###### `POST /api/block/`
Block a user by their user ID. Also removes any existing friendship between the two users.
```json
Request:  { "user_id": 7 }
Response: { "success": true, "message": "You have blocked rik" }
```

###### `DELETE /api/block/unblock`
Unblock a previously blocked user by their user ID.
```json
Request:  { "user_id": 7 }
Response: { "success": true }
```

---

#### Chat System

The chat system is a persistent WebSocket overlay that stays alive across SPA navigation. It handles global chat, direct messages (with the last 50 messages persisted), online presence, game invites, typing indicators, read receipts, block events, game results broadcast to global chat, and profile viewing.

##### UI

![Chat UI](docs/images/chat-ui.png)

**DOM structure of `chatContainer`:**
```
chatContainer
├── chatHeader
│   ├── channelTabs        (Global tab + DM tabs)
│   └── closeChatBtn
└── chatContent
    ├── usersSidebar
    │   └── onlineUsersList
    └── chatPanel
        ├── channelTitle
        ├── chatMessages
        ├── typingIndicator
        └── chatInputWrapper
            ├── chatInput
            ├── blockNotice
            ├── charCounter
            └── sendChatBtn
```

The chat window is a fixed overlay rendered in `index.html`, outside the SPA's `#app-root`. It stays mounted and connected across all page navigations. Everything inside it is dynamically rendered by JavaScript:

- **Online users list** — rebuilt every time someone connects, disconnects, or changes game status. Users who blocked you are hidden; users you blocked are still shown so you can unblock them.
- **Channel tabs** — the Global tab is always present. DM tabs are created on the fly when you open a conversation or receive a message from someone you don't have a tab open for yet. Tabs persist across navigation and show an unread badge when new messages arrive.
- **Messages** — kept in memory per channel for the session. DM history (last 50 messages) is fetched from the database when a tab is opened. Global messages are not persisted.
- **Channel title** — updates dynamically when switching between Global and DM tabs.
- **Typing indicator** — appears when the other person is typing, cleared automatically when they stop.
- **Read receipts** — a checkmark or indicator updates when your DM partner has read your messages.
- **Block notice** — replaces the input area when either user has blocked the other, preventing new messages.
- **Character counter** — shows the current character count against the 300 character limit as you type.
- **Game invite UI** — inline invite cards appear in the DM with accept/decline actions. Expired or cancelled invites are cleaned up automatically.
- **Context menu** — clicking an online user opens a menu with four actions: View Profile, Chat, Invite to Game, and Block. Invite to Game opens a game picker submenu to choose between Pong and Chess.

##### WebSocket Message Protocol

All messages are JSON. The `type` field determines the message kind.

**Convention:**
- Frontend → Backend: `snake_case`
- Backend → Frontend: `camelCase`
- Internal Django Channels routing (`group_send`): `dot.separated` — never reaches the frontend

**Frontend → Backend**

###### `send_message`
Send a global or DM message. Omit `recipient_id` for global.
```json
{ "type": "send_message", "message": "hello", "recipient_id": "42" }
```

###### `fetch_history`
Request the last 50 messages from a DM conversation.
```json
{ "type": "fetch_history", "dm_partner_id": "42" }
```

###### `get_open_dms`
Request all open DM tabs (sent on connect to restore tabs).
```json
{ "type": "get_open_dms" }
```

###### `set_active_conversation`
Tell the backend which conversation is currently open. Send `null` partner_id when switching to global.
```json
{ "type": "set_active_conversation", "partner_id": "42" }
```

###### `mark_read`
Reset unread count for a DM conversation.
```json
{ "type": "mark_read", "dm_partner_id": "42" }
```

###### `hide_dm`
Hide a DM tab — it won't reappear on refresh unless a new message arrives.
```json
{ "type": "hide_dm", "dm_partner_id": "42" }
```

###### `send_game_invite`
Send a game invite. `game_type` is `"pong"` or `"chess"`.
```json
{ "type": "send_game_invite", "invitee_id": "42", "game_type": "pong", "game_id": "abc-123" }
```

###### `cancel_game_invite`
Cancel a sent invite.
```json
{ "type": "cancel_game_invite", "invitee_id": "42", "game_id": "abc-123" }
```

###### `accept_game_invite`
Accept a received invite — deletes it from DB and notifies the sender.
```json
{ "type": "accept_game_invite", "game_id": "abc-123" }
```

###### `report_blocked_user`
Notify the backend a user was blocked. Triggers invite cleanup and online users broadcast.
```json
{ "type": "report_blocked_user", "recipient_id": "42" }
```

###### `notify_typing` / `notify_stop_typing`
Notify that the current user started or stopped typing. Omit `typing_recipient_id` for global.
```json
{ "type": "notify_typing", "typing_recipient_id": "42" }
{ "type": "notify_stop_typing", "typing_recipient_id": "42" }
```

**Backend → Frontend**

###### `selfId`
Sent on connect to confirm the user's identity.
```json
{ "type": "selfId", "user_id": "42", "user_name": "tamar" }
```

###### `chatMessage`
Delivers a message. `private: true` for DMs. Sent to all tabs of both sender and recipient.
```json
{ "type": "chatMessage", "message": "hello", "sender_id": "42", "sender_name": "tamar", "private": true, "recipient_id": "7" }
```

###### `dmHistory`
Last 50 messages of a DM conversation, oldest first. `seen` indicates whether the other user has read your last sent message. Invite messages have an empty `message` and an `invite` object instead.
```json
{
  "type": "dmHistory",
  "dm_partner_id": "42",
  "seen": true,
  "messages": [
    { "sender_id": "42", "sender_name": "tamar", "message": "hello", "created_at": "2026-05-10T12:00:00" },
    { "sender_id": "7", "sender_name": "rik", "message": "", "invite": { "gameType": "pong", "gameId": "abc-123" }, "created_at": "2026-05-10T12:01:00" }
  ]
}
```

###### `openDms`
All open DM tabs. Key is the other user's user_id. `unread` is the unread message count. `seen` indicates whether the other user has read your last message.
```json
{
  "type": "openDms",
  "dms": {
    "42": { "user_name": "tamar", "unread": 3, "seen": false },
    "7":  { "user_name": "rik",   "unread": 0, "seen": true  }
  }
}
```

###### `messagesSeenByDmPartner`
Your DM partner has read your messages.
```json
{ "type": "messagesSeenByDmPartner", "by": "42" }
```

###### `onlineUsers`
Personalized online users list sent to every user on connect/disconnect/game status change. `users` excludes users who blocked you. Users you blocked are still included so you can unblock them.
```json
{
  "type": "onlineUsers",
  "users": { "42": "tamar", "7": "rik" },
  "blocked_by_me_ids": ["7"],
  "blocked_me_ids": [],
  "in_game_ids": ["42"]
}
```

###### `gameInvite`
You received a game invite.
```json
{ "type": "gameInvite", "sender_id": "42", "sender_name": "tamar", "game_type": "pong", "game_id": "abc-123" }
```

###### `gameInviteExpired`
An invite you received was cancelled by the sender.
```json
{ "type": "gameInviteExpired", "game_id": "abc-123" }
```

###### `gameInviteAccepted`
An invite you sent was accepted.
```json
{ "type": "gameInviteAccepted", "game_id": "abc-123" }
```

###### `gameInviteBlocked`
An invite was cancelled because you blocked the other user.
```json
{ "type": "gameInviteBlocked", "game_id": "abc-123" }
```

###### `gameInviteRejected`
Your invite was rejected because one of the users is already in a game.
```json
{ "type": "gameInviteRejected", "reason": "in_game" }
```

###### `gameResult`
A game ended. Broadcast to all connected users. For draws, `winner` and `loser` are `null` and `draw_players` contains both usernames.
```json
{ "type": "gameResult", "winner": "tamar", "loser": "rik", "draw_players": null, "game_type": "pong" }
```

###### `friendListChanged`
Your friend list changed. Frontend should re-fetch.
```json
{ "type": "friendListChanged" }
```

###### `otherTyping` / `otherStoppedTyping`
Someone started or stopped typing. `private: true` for DMs, `false` for global.
```json
{ "type": "otherTyping", "typer_id": "42", "typer_name": "tamar", "private": true }
{ "type": "otherStoppedTyping", "typer_id": "42", "typer_name": "tamar", "private": false }
```

#### Additional Games

See [Chess](#chess) for the second implemented game (local, online, ELO, and chat invites).

#### Graphics & UI

#### Internationalization (i18n)
The project has a custom i18n (internationalization) system.

Supported Languages:
- English (en)
- Dutch (nl)
- Turkish (tr)

**TODO (remove before final submission)**  
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

How to use translations in HTML:
```html
<button data-i18n="BTN_START_GAME">START GAME</button>
```
The text will automatically update when language changes.
Frontend bottom-left corner has a language selector dropdown.


### Modules
<◦ List of all chosen modules (Major and Minor).
◦ Point calculation (Major = 2pts, Minor = 1pt).
◦ Justification for each module choice, especially for custom "Modules of
choice".
◦ How each module was implemented.
◦ Which team member(s) worked on each module>


### Individual Contributions
<◦ Detailed breakdown of what each team member contributed.
◦ Specific features, modules, or components implemented by each person.
◦ Any challenges faced and how they were overcome.
Any other useful or relevant information is welcome (usage documentation, known
limitations, license, credits, etc.)>
