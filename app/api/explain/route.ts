import { guard } from "@/lib/guard";
import { askJSON, FAST_MODEL } from "@/lib/claude";

export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const body = await req.json();
    const data = await askJSON<{ verdict: "Pay" | "Hold" | "Dispute"; reasons: string[]; email: { subject: string; body: string } }>(
      "You help an Indian company's finance and operations team handle vendor invoice discrepancies. Firm, polite, factual. Plain Indian business English. Never use em dashes or en dashes.",
      `Here is the invoice check (all numbers computed by code, trust them) and the agreement context:
${JSON.stringify(body)}

Return JSON:
{ "verdict": "Pay"|"Hold"|"Dispute",
  "reasons": string[],   // max 4, each one line with ₹ amount and the clause/evidence
  "email": { "subject": string, "body": string } }  // dispute email to the vendor asking for a corrected invoice or credit note, citing clauses and evidence; sign off as "Accounts Payable"
Verdict: Pay if no money at risk; Dispute if overbilled; Hold if data missing. If pastDisputes exist, mention briefly what happened last time (e.g. a credit note was issued for a similar issue). Lines with status "unmatched" are not proven overbilling: ask the vendor to show the approval for them. Lines with status "pending" need usage confirmation.`,
      undefined,
      FAST_MODEL
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
