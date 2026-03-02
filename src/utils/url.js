const TIKTOK_HOST_RE = /(^|\.)tiktok\.com$/i;
const TIKTOK_SHORT_HOST_RE = /(^|\.)(vm|vt)\.tiktok\.com$/i;

export function extractFirstUrl(text) {
  const t = String(text || "");
  const m = t.match(/https?:\/\/[^\s<>]+/i);
  return m ? m[0] : "";
}

export function isTikTokUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = String(u.hostname || "");
    return TIKTOK_HOST_RE.test(host) || TIKTOK_SHORT_HOST_RE.test(host);
  } catch {
    return false;
  }
}

export function normalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    // Strip most tracking while keeping path/query (some APIs need query)
    u.hash = "";
    return u.toString();
  } catch {
    return String(urlStr || "").trim();
  }
}
