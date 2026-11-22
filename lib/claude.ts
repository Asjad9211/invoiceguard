import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type DocInput = { text?: string; pdfBase64?: string };

/** Ask Claude for JSON. Accepts plain text or a PDF. Retries once on bad JSON. */
export async function askJSON<T>(system: string, instruction: string, doc?: DocInput): Promise<T> {
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (doc?.pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.pdfBase64 } });
  }
  if (doc?.text) content.push({ type: "text", text: `<document>\n${doc.text}\n</document>` });
  content.push({ type: "text", text: instruction + "\n\nReturn ONLY valid JSON. No markdown fences, no commentary." });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    try {
      return JSON.parse(extractJSON(text).replace(/\s*\u2014\s*/g, ", ").replace(/\u2013/g, "-")) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error("Claude returned invalid JSON: " + String(lastErr));
}

function extractJSON(t: string) {
  const s = t.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}
