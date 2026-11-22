import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type DocInput = { text?: string; pdfBase64?: string; docxBase64?: string };

/** Ask Claude for JSON. Accepts plain text or a PDF. Retries once on bad JSON. */
export async function askJSON<T>(system: string, instruction: string, doc?: DocInput): Promise<T> {
  if (doc?.docxBase64) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(doc.docxBase64, "base64") });
    doc = { text: value };
  }
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (doc?.pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.pdfBase64 } });
  }
  if (doc?.text) content.push({ type: "text", text: `<document>\n${doc.text}\n</document>` });
  content.push({ type: "text", text: instruction + "\n\nCall the submit tool with the result object. Never use em dashes." });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await getClient().messages.create({
        model: MODEL,
        max_tokens: 16000,
        system,
        tools: [{ name: "submit", description: "Submit the result as a JSON object in the exact shape requested.", input_schema: { type: "object", additionalProperties: true } }],
        tool_choice: { type: "tool", name: "submit" },
        messages: [{ role: "user", content }],
      });
      const block = res.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
      if (!block) throw new Error("No result returned");
      return clean(block.input) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error("Could not read this document: " + String(lastErr));
}

function clean(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/\s*\u2014\s*/g, ", ").replace(/\u2013/g, "-");
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
  return v;
}

function extractJSON(t: string) {
  const s = t.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}
