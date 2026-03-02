import { getDb } from "./db.js";
import { logger } from "./logger.js";

const COL = "memory_messages";

export async function addTurn({ mongoUri, platform, userId, chatId, role, text }) {
  const db = await getDb(mongoUri);
  const doc = {
    platform,
    userId: String(userId),
    chatId: chatId ? String(chatId) : "",
    role,
    text: String(text || "").slice(0, 4000),
    ts: new Date(),
  };

  if (!db) return; // allow bot to run without DB

  try {
    await db.collection(COL).insertOne(doc);
  } catch (e) {
    logger.error("db.write_failed", {
      collection: COL,
      op: "insertOne",
      err: logger.safeErr(e),
    });
  }
}

export async function getRecentTurns({ mongoUri, platform, userId, chatId, limit = 14 }) {
  const db = await getDb(mongoUri);
  if (!db) return [];

  const q = {
    platform,
    userId: String(userId),
  };
  if (chatId) q.chatId = String(chatId);

  try {
    const rows = await db
      .collection(COL)
      .find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return rows.reverse().map((r) => ({ role: r.role, text: r.text }));
  } catch (e) {
    logger.error("db.read_failed", {
      collection: COL,
      op: "find",
      err: logger.safeErr(e),
    });
    return [];
  }
}

export async function clearUserMemory({ mongoUri, platform, userId, chatId }) {
  const db = await getDb(mongoUri);
  if (!db) return;

  const q = { platform, userId: String(userId) };
  if (chatId) q.chatId = String(chatId);

  try {
    await db.collection(COL).deleteMany(q);
  } catch (e) {
    logger.error("db.write_failed", {
      collection: COL,
      op: "deleteMany",
      err: logger.safeErr(e),
    });
  }
}
