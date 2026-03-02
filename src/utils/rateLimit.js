const lastByChat = new Map();

export function checkChatCooldown(chatId, cooldownMs) {
  const key = String(chatId || "");
  const now = Date.now();
  const last = lastByChat.get(key) || 0;
  if (now - last < cooldownMs) {
    return { ok: false, waitMs: cooldownMs - (now - last) };
  }
  lastByChat.set(key, now);
  // best-effort bounded map
  if (lastByChat.size > 5000) {
    const firstKey = lastByChat.keys().next().value;
    if (firstKey) lastByChat.delete(firstKey);
  }
  return { ok: true, waitMs: 0 };
}
