import { safeErr } from "./safeErr.js";

function log(level, msg, meta = {}) {
  const out = {
    t: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  if (level === "error") console.error(JSON.stringify(out));
  else if (level === "warn") console.warn(JSON.stringify(out));
  else console.log(JSON.stringify(out));
}

export const logger = {
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  safeErr,
};
