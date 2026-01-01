export const FAKE_USERS = {
  "u-alice": { id: "u-alice", name: "Alice", avatar: "🏓", createdAt: Date.now(), socket: null},
  "u-bob": { id: "u-bob", name: "Bob", avatar: "👻", createdAt: Date.now(), socket: null},
  "u-tamar": { id: "u-tamar", name: "Tamar", avatar: "⭐", createdAt: Date.now(), socket: null},
  "u-noam" : { id: "u-noam", name: "Noam", avatar : "🐱", createdAt: Date.now(), socket: null},
  "u-yaara" : { id: "u-yaara", name: "Yaara", avatar : "💕", createdAt: Date.now(), socket: null},
  "u-guest": { id: "u-guest", name: "Guest", avatar: "👤", createdAt: Date.now(), socket: null},

};

export function getNameFromId(userId) {
  return FAKE_USERS[userId]?.name ?? "Guest";
}
