// Light protection for the AI routes: same-site requests only, a body size cap, and a per-IP rate limit.
const hits = new Map<string, number[]>();

export function guard(req: Request, limitPerMin = 12): Response | null {
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";
  if (origin && host && !origin.endsWith("//" + host)) return Response.json({ error: "Not allowed" }, { status: 403 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 4_400_000) return Response.json({ error: "This file is too large. Try a smaller file or just the pricing pages." }, { status: 413 });
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (list.length >= limitPerMin) return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  list.push(now);
  hits.set(ip, list);
  return null;
}
