// src/services/memoryStore.js

const sessions = new Map();
const TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_MESSAGES = 20;

/**
 * Get recent messages for a session
 */
export function getSessionMessages(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.messages : [];
}

/**
 * Save a new message to the session memory
 */
export function saveSessionMessage(sessionId, message) {
  let session = sessions.get(sessionId) || {
    messages: [],
    lastUsed: Date.now(),
  };

  session.messages.push(message);
  session.lastUsed = Date.now();

  // Trim to last N messages
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }

  sessions.set(sessionId, session);
}

/**
 * Clean up stale sessions periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > TTL) {
      sessions.delete(id);
    }
  }
}, 60 * 1000); // every minute
