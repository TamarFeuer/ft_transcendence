export const FAKE_USERS = {
  "u-alice": {
    id: "u-alice",
    name: "Alice",
    avatar: "🏓",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-bob", "u-tamar", "u-cat"]
  },
  "u-bob": {
    id: "u-bob",
    name: "Bob",
    avatar: "👻",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-alice", "u-cat"]
  },
  "u-tamar": {
    id: "u-tamar",
    name: "Tamar",
    avatar: "⭐",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-alice", "u-yaara", "u-cat"]
  },
  "u-noam": {
    id: "u-noam",
    name: "Noam",
    avatar: "🐱",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-cat"]
  },
  "u-yaara": {
    id: "u-yaara",
    name: "Yaara",
    avatar: "💕",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-tamar", "u-cat"]
  },
  "u-cat": {
    id: "u-cat",
    name: "Cat",
    avatar: "🐈🐱🧶",
    createdAt: Date.now(),
    loggedIn: true,
    socket: null,
    friends: ["u-tamar", "u-noam", "u-yaara", "u-bob", "u-alice"]
  },
  "u-guest": {
    id: "u-guest",
    name: "Guest",
    avatar: "👤",
    createdAt: Date.now(),
    loggedIn: false,
    socket: null,
    friends: []
  }
};

export function getNameFromId(userId) {
  return FAKE_USERS[userId]?.name ?? "Guest";
}
