import { guard } from "@/lib/guard";
import { askJSON, FAST_MODEL } from "@/lib/claude";

export const maxDuration = 60;

// Answers questions about one vendor using only its extracted agreement, invoice and check results.
export async function POST(req: Request) {
  const blocked = guard(req, 20);
  if (blocked) return blocked;
  try {
    const body = (await req.json()) as { question: string; language: string; context: unknown; history?: { q: string; a: string }[] };
    if (!body.question?.trim()) return Response.json({ error: "Ask a question" }, { status: 400 });
    const data = await askJSON<{ answer: string }>(
      "You are InvoiceGuard, a helpful assistant for an Indian finance or operations team. Answer only from the vendor data given. If the data does not say, say so plainly and suggest what to ask the vendor. Keep answers short (2 to 4 sentences), spoken-style, no markdown, no lists, no em dashes. Use rupee amounts as written. Never say you are Claude or an AI model.",
      `Vendor data (agreement, invoice, checks, statuses): ${JSON.stringify(body.context).slice(0, 60000)}
Earlier in this conversation: ${JSON.stringify((body.history || []).slice(-4))}
Question: ${body.question}
Reply in ${body.language}. If the language is not English, use simple everyday words in that language's own script, and keep amounts and company names as they are.
Return { "answer": string }.`,
      undefined,
      FAST_MODEL
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
