import axios from "axios";

function clampTimeoutMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 60000;
  return Math.max(5000, Math.min(n, 180000));
}

export async function downloadToBuffer(url, { timeoutMs = 60000, maxBytes = 60 * 1024 * 1024 } = {}) {
  const t = clampTimeoutMs(timeoutMs);

  const res = await axios.request({
    url,
    method: "GET",
    responseType: "arraybuffer",
    timeout: t,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: () => true,
    headers: {
      "User-Agent": "CookMyBotsTikTokBot/1.0",
    },
  });

  if (res.status < 200 || res.status >= 300) {
    const err = new Error("DOWNLOAD_HTTP_" + res.status);
    err.status = res.status;
    throw err;
  }

  return {
    buffer: Buffer.from(res.data),
    contentType: String(res.headers?.["content-type"] || ""),
  };
}
