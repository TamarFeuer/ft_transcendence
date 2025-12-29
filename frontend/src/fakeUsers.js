export const FAKE_USERS = {
  alice: { id: "u-alice", name: "Alice", avatar: "🏓", createdAt: Date.now(), loggedIn: true},
  bob: { id: "u-bob", name: "Bob", avatar: "🔝", createdAt: Date.now(), loggedIn: true},
  charlie: { id: "u-tamar", name: "Tamar", avatar: "⭐", createdAt: Date.now(), loggedIn: true},
  guest: { id: "u-guest", name: "Guest", avatar: "💕", createdAt: Date.now(), loggedIn: false },

};

export function getNameFromId(userId) {
  for (const key in FAKE_USERS) {
    if (FAKE_USERS[key].id === userId) {
      return FAKE_USERS[key].name;
    }
  }
  return "Guest"; // fallback if not found
}
