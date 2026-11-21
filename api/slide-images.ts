import type { IncomingMessage, ServerResponse } from "node:http";

const SYSTEM_PIXABAY_KEYS_B64 = [
  "NTg3NDE5NDUtZmUyMzA0ZTg1ZTlmYzhkYzcwMDA2YTlkYg==", // مفتاح 1: 58741945-...
  "NTg3NDYxOTYtZDFjZWNiNTg1YjNmNjJlMzQ2ZTAyYWVjMQ==", // مفتاح 2: 58746196-...
  "NTg3NDYyMTAtNGE5NjQ4NGJmMGE1NDUzN2UxMWJiMzVhMg==", // مفتاح 3: 58746210-...
  "NTg3NDYyMjctNzUxY2UxYzBhZDQyZDE1ZmQxNzFmNDcwZg==", // مفتاح 4: 58746227-...
];

function decodeB64(s: string): string {
  try {
    return Buffer.from(s, "base64").toString("utf-8");
  } catch {
    return s;
  }
}

const PEOPLE_FILTER_REGEX =
  /\b(person|people|man|men|woman|women|human|humans|face|faces|portrait|portraits|selfie|selfies|smile|smiling|model|models|girl|girls|boy|boys|guy|guys|lady|ladies|child|children|kid|kids|worker|workers|crowd|crowds|gentleman|female|male|couple|couples|family|families|baby|babies|toddler|toddlers|teenager|teenagers|hand|hands|nurse|doctor|patient|student|students|teacher|teachers|employee|employees|pedestrian|pedestrians|citizen|citizens|avatar|headshot|profile)\b/i;

function hasPeople(text: string): boolean {
  return PEOPLE_FILTER_REGEX.test(text);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const rawQ = url.searchParams.get("q") || "";
  const orientation = url.searchParams.get("orientation") || "landscape";

  if (!rawQ.trim()) {
    res.end(JSON.stringify({ results: [] }));
    return;
  }

  const pixabayKeys = SYSTEM_PIXABAY_KEYS_B64.map(decodeB64);
  const cleanQ = rawQ.replace(/["']/g, "").slice(0, 50).trim();
  const safeQuery = `${cleanQ} -person -people -face -man -woman`.slice(0, 95);
  const orientationsToTry = orientation === "portrait" ? ["all", "vertical"] : ["horizontal", "all"];

  let results: any[] = [];

  for (const key of pixabayKeys) {
    if (results.length > 0) break;
    for (const pOrientation of orientationsToTry) {
      try {
        const apiUrl =
          `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(safeQuery)}` +
          `&image_type=photo&orientation=${pOrientation}&safesearch=true&per_page=12`;
        const pRes = await fetch(apiUrl);
        if (pRes.ok) {
          const pData: any = await pRes.json();
          const hits = (pData.hits || [])
            .filter((h: any) => !hasPeople(`${h.tags || ""} ${h.user || ""}`))
            .map((h: any) => ({
              id: `pixabay:${h.id}`,
              provider: "pixabay",
              src: h.largeImageURL,
              alt: h.tags || rawQ,
              credit: h.user ? `Image: ${h.user} / Pixabay` : "Pixabay",
            }));
          if (hits.length > 0) {
            results = hits;
            break;
          }
        } else if (pRes.status === 429) {
          break; // تدوير للمفتاح التالي
        }
      } catch (e) {
        break;
      }
    }
  }

  res.end(JSON.stringify({ results }));
}
