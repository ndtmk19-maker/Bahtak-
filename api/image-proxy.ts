import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_HOSTS = [
  "pixabay.com",
  "cdn.pixabay.com",
  "images.unsplash.com",
  "images.pexels.com",
];

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const target = url.searchParams.get("url");

  if (!target || !target.startsWith("http")) {
    res.statusCode = 400;
    res.end("Bad target URL");
    return;
  }

  try {
    const parsed = new URL(target);
    const isAllowed = ALLOWED_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
    );
    if (!isAllowed) {
      res.statusCode = 403;
      res.end("Forbidden host");
      return;
    }

    const imgRes = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!imgRes.ok) {
      res.statusCode = imgRes.status;
      res.end("Failed to fetch image");
      return;
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.end(buffer);
  } catch (err: any) {
    res.statusCode = 500;
    res.end(err?.message || "Internal error");
  }
}
