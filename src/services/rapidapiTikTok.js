import axios from "axios";
import { cfg } from "../lib/config.js";
import { logger } from "../lib/logger.js";

function isPlaceholderBase(base) {
  const b = String(base || "").trim().toLowerCase();
  return !b || b === "https://example.p.rapidapi.com" || b.includes("example.p.rapidapi.com");
}

function clampTimeoutMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 30000;
  return Math.max(5000, Math.min(n, 120000));
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(Math.floor(n), max));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) {
        ok = false;
        break;
      }
      cur = cur[part];
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

function findBestVideoUrl(data) {
  const candidates = [];

  const pushIf = (v) => {
    if (!v) return;
    if (typeof v === "string") candidates.push(v);
    else if (Array.isArray(v)) {
      for (const x of v) if (typeof x === "string") candidates.push(x);
    }
  };

  pushIf(pick(data, ["noWatermark", "nowm", "no_watermark", "wmplay"]));
  pushIf(pick(data, ["video.nowm", "video.noWatermark", "video.no_watermark"]));
  pushIf(pick(data, ["data.noWatermark", "data.nowm", "data.video.noWatermark", "data.video.nowm"]));
  pushIf(
    pick(data, [
      "play",
      "video",
      "download",
      "url",
      "videoUrl",
      "data.play",
      "data.video",
      "data.download",
      "data.url",
    ])
  );

  const maybeArr = pick(data, ["urls", "data.urls", "video.urls", "data.video.urls"]);
  pushIf(maybeArr);

  const uniq = [];
  const seen = new Set();
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (!s) continue;
    if (!/^https?:\/\//i.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
  }

  const pref = uniq.find((u) => /nowm|no_?watermark|hd|download/i.test(u)) || uniq[0];
  return pref || "";
}

function parseRetryAfterSeconds(headers) {
  const h = headers || {};
  const raw = h["retry-after"] ?? h["Retry-After"];
  if (!raw) return null;

  const asInt = Number(raw);
  if (Number.isFinite(asInt) && asInt > 0) return Math.min(3600, Math.floor(asInt));

  const asDateMs = Date.parse(String(raw));
  if (Number.isFinite(asDateMs)) {
    const delta = Math.ceil((asDateMs - Date.now()) / 1000);
    if (delta > 0) return Math.min(3600, delta);
  }

  return null;
}

function classifyDownloaderError({ status, err }) {
  if (status === 429) {
    return { category: "rate_limited", isTransient: true };
  }

  if (status === 408 || status === 0) {
    return { category: "network", isTransient: true };
  }

  if (status >= 500 && status <= 599) {
    return { category: "upstream_5xx", isTransient: true };
  }

  if (status >= 400 && status <= 499) {
    return { category: "bad_request", isTransient: false };
  }

  const msg = String(logger.safeErr(err) || "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("eai_again") ||
    msg.includes("network")
  ) {
    return { category: "network", isTransient: true };
  }

  return { category: "unknown", isTransient: true };
}

function computeBackoffMs(attempt, baseMs, maxMs) {
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(maxMs, exp);
  const jitter = capped * (0.25 * Math.random());
  return Math.max(0, Math.floor(capped + jitter));
}

export async function fetchTikTokDownload({ tiktokUrl, requestId }) {
  const base = String(cfg.RAPIDAPI_TIKTOK_ENDPOINT_BASE || "");

  if (!cfg.RAPIDAPI_KEY || !cfg.RAPIDAPI_HOST || isPlaceholderBase(base)) {
    return {
      ok: false,
      error:
        "RapidAPI is not configured yet. Set RAPIDAPI_KEY, RAPIDAPI_HOST, and RAPIDAPI_TIKTOK_ENDPOINT_BASE.",
      classification: { category: "not_configured", status: 412, isTransient: false },
    };
  }

  const timeoutMs = clampTimeoutMs(cfg.HTTP_TIMEOUT_MS);

  const maxRetries = clampInt(cfg.TIKTOK_MAX_RETRIES, 2, 0, 10);
  const retryBaseMs = clampInt(cfg.TIKTOK_RETRY_BASE_MS, 800, 50, 30000);
  const retryMaxMs = clampInt(cfg.TIKTOK_RETRY_MAX_MS, 8000, 200, 120000);

  const url = base.replace(/\/+$/, "") + "/";

  logger.info("rapidapi.tiktok.start", {
    requestId,
    baseConfigured: !isPlaceholderBase(base),
    hasKey: !!cfg.RAPIDAPI_KEY,
    hasHost: !!cfg.RAPIDAPI_HOST,
    timeoutMs,
    maxRetries,
  });

  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
    const attemptStarted = Date.now();

    try {
      const res = await axios.request({
        url,
        method: "GET",
        timeout: timeoutMs,
        params: { url: tiktokUrl },
        headers: {
          "X-RapidAPI-Key": cfg.RAPIDAPI_KEY,
          "X-RapidAPI-Host": cfg.RAPIDAPI_HOST,
        },
        validateStatus: () => true,
      });

      const ms = Date.now() - attemptStarted;

      if (res.status < 200 || res.status >= 300) {
        const retryAfterSec = parseRetryAfterSeconds(res.headers);
        const cls = classifyDownloaderError({ status: res.status, err: null });

        logger.warn("rapidapi.tiktok.http_error", {
          requestId,
          status: res.status,
          ms,
          attempt,
          classification: cls.category,
          retryAfterSec: retryAfterSec ?? undefined,
        });

        if (attempt <= maxRetries + 0 && cls.isTransient && attempt <= maxRetries) {
          let delayMs = computeBackoffMs(attempt, retryBaseMs, retryMaxMs);
          if (retryAfterSec != null) {
            const retryAfterMs = Math.min(120000, retryAfterSec * 1000);
            delayMs = Math.max(delayMs, retryAfterMs);
          }

          logger.info("rapidapi.tiktok.retrying", {
            requestId,
            attempt,
            status: res.status,
            classification: cls.category,
            delayMs,
          });
          await sleep(delayMs);
          continue;
        }

        return {
          ok: false,
          error: "TikTok downloader API error (HTTP " + res.status + "). Try again later.",
          classification: {
            category: cls.category,
            status: res.status,
            isTransient: cls.isTransient,
            retryAfterSeconds: retryAfterSec ?? undefined,
          },
        };
      }

      const data = res.data;
      const videoUrl = findBestVideoUrl(data);

      const author =
        pick(data, [
          "author",
          "author.name",
          "author.unique_id",
          "data.author",
          "data.author.name",
          "data.author.unique_id",
          "uploader",
        ]) || "";
      const caption =
        pick(data, [
          "caption",
          "title",
          "desc",
          "description",
          "data.caption",
          "data.title",
          "data.desc",
          "data.description",
        ]) || "";

      if (!videoUrl) {
        logger.warn("rapidapi.tiktok.no_video_url", {
          requestId,
          ms,
          keys: data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [],
          attempt,
        });
        return {
          ok: false,
          error: "I couldn't find a downloadable video URL from the API response.",
          classification: { category: "bad_response", status: 502, isTransient: true },
        };
      }

      logger.info("rapidapi.tiktok.success", {
        requestId,
        status: res.status,
        ms: Date.now() - startedAt,
        attempt,
        hasCaption: !!String(caption || "").trim(),
        hasAuthor: !!String(author || "").trim(),
      });

      return {
        ok: true,
        videoUrl,
        meta: {
          author: String(author || "").trim(),
          caption: String(caption || "").trim(),
        },
      };
    } catch (err) {
      const ms = Date.now() - attemptStarted;
      const status = err?.response?.status || 0;
      const cls = classifyDownloaderError({ status, err });

      logger.error("rapidapi.tiktok.failure", {
        requestId,
        ms,
        attempt,
        status,
        classification: cls.category,
        err: logger.safeErr(err),
      });

      if (attempt <= maxRetries && cls.isTransient) {
        const delayMs = computeBackoffMs(attempt, retryBaseMs, retryMaxMs);
        logger.info("rapidapi.tiktok.retrying", {
          requestId,
          attempt,
          status,
          classification: cls.category,
          delayMs,
        });
        await sleep(delayMs);
        continue;
      }

      return {
        ok: false,
        error: "TikTok downloader API request failed. Try again later.",
        classification: { category: cls.category, status, isTransient: cls.isTransient },
      };
    }
  }

  return {
    ok: false,
    error: "TikTok downloader API request failed. Try again later.",
    classification: { category: "unknown", status: 0, isTransient: true },
  };
}
