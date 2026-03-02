import { MongoClient } from "mongodb";
import { logger } from "./logger.js";

let _client = null;
let _db = null;
let _connecting = null;

export async function getDb(mongoUri) {
  const uri = String(mongoUri || "").trim();
  if (!uri) return null;
  if (_db) return _db;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    try {
      _client = new MongoClient(uri, { maxPoolSize: 5, ignoreUndefined: true });
      await _client.connect();
      _db = _client.db();
      logger.info("db.connected", { MONGODB_URI_set: true });
      return _db;
    } catch (e) {
      logger.error("db.connect_failed", { err: logger.safeErr(e), MONGODB_URI_set: true });
      _db = null;
      return null;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}
