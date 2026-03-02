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

  // Common fields across providers
  pushIf(pick(data, ["noWatermark", "nowm", "no_watermark", "wmplay"]))
  pushIf(pick(data, ["video.nowm", "video.noWatermark", "video.no_watermark"]))
  pushIf(pick(data, ["data.noWatermark", "data.nowm", "data.video.noWatermark", "data.video.nowm"]))
  pushIf(pick(data, ["play", "video", "download", "url", "videoUrl", "data.play", "data.video", "data.download", "data.url"]))

  // Some providers return nested arrays
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

  // Prefer urls that look like no-watermark
  const pref = uniq.find((u) => /nowm|no_?watermark|hd|download/i.test(u)) || uniq[0];
  return pref || "";
}

export async function fetchTikTokDownload({ tiktokUrl, requestId }) {
  const base = String(cfg.RAPIDAPI_TIKTOK_ENDPOINT_BASE || "");

  if (!cfg.RAPIDAPI_KEY || !cfg.RAPIDAPI_HOST || isPlaceholderBase(base)) {
    return {
      ok: false,
      error:
        "RapidAPI is not configured yet. Set RAPIDAPI_KEY, RAPIDAPI_HOST, and RAPIDAPI_TIKTOK_ENDPOINT_BASE.",
    };
  }

  const timeoutMs = clampTimeoutMs(cfg.HTTP_TIMEOUT_MS);

  const url = base.replace(/\/+$/, "") + "/";
  const startedAt = Date.now();

  logger.info("rapidapi.tiktok.start", {
    requestId,
    baseConfigured: !isPlaceholderBase(base),
    hasKey: !!cfg.RAPIDAPI_KEY,
    hasHost: !!cfg.RAPIDAPI_HOST,
    timeoutMs,
  });

  try {
    // Provider-specific shape varies; we keep it flexible.
    // Most TikTok downloader APIs accept either query param or JSON body.
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

    const ms = Date.now() - startedAt;

    if (res.status < 200 || res.status >= 300) {
      logger.warn("rapidapi.tiktok.http_error", {
        requestId,
        status: res.status,
        ms,
      });
      return {
        ok: false,
        error: "TikTok downloader API error (HTTP " + res.status + "). Try again later.",
      };
    }

    const data = res.data;
    const videoUrl = findBestVideoUrl(data);

    const author =
      pick(data, ["author", "author.name", "author.unique_id", "data.author", "data.author.name", "data.author.unique_id", "uploader"]) ||
      "";
    const caption = pick(data, ["caption", "title", "desc", "description", "data.caption", "data.title", "data.desc", "data.description"]) || "";

    if (!videoUrl) {
      logger.warn("rapidapi.tiktok.no_video_url", {
        requestId,
        ms,
        keys: data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [],
      });
      return {
        ok: false,
        error: "I couldn't find a downloadable video URL from the API response.",
      };
    }

    logger.info("rapidapi.tiktok.success", {
      requestId,
      status: res.status,
      ms,
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
    const ms = Date.now() - startedAt;
    logger.error("rapidapi.tiktok.failure", {
      requestId,
      ms,
      err: logger.safeErr(err),
    });
    return { ok: false, error: "TikTok downloader API request failed. Try again later." };
  }
}
