const lastByChat = new Map();

function nowMs() {
  return Date.now();
}

function clampNum(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(n, max));
}

// Existing behavior (per-chat cooldown) preserved
export function checkChatCooldown(chatId, cooldownMs) {
  const key = String(chatId || "");
  const now = nowMs();
  const last = lastByChat.get(key) || 0;
  if (now - last < cooldownMs) {
    return { ok: false, waitMs: cooldownMs - (now - last) };
  }
  lastByChat.set(key, now);
  if (lastByChat.size > 5000) {
    const firstKey = lastByChat.keys().next().value;
    if (firstKey) lastByChat.delete(firstKey);
  }
  return { ok: true, waitMs: 0 };
}

// Token-bucket limiter (RPS-style). Returns true if allowed.
const buckets = new Map();

export function allowRps(key, rps, burst = 1) {
  const k = String(key || "");
  const rate = clampNum(rps, 1, 0.1, 1000);
  const cap = clampNum(burst, 1, 1, 50);

  const now = nowMs();
  const b = buckets.get(k) || { tokens: cap, last: now };

  const elapsed = Math.max(0, now - b.last);
  const refill = (elapsed / 1000) * rate;
  b.tokens = Math.min(cap, b.tokens + refill);
  b.last = now;

  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;

  buckets.set(k, b);
  if (buckets.size > 15000) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  return ok;
}
