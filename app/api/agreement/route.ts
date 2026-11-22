import { askJSON, type DocInput } from "@/lib/claude";
import type { Agreement } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You are InvoiceGuard, an expert in Indian vendor agreements for usage-based services (SMS, WhatsApp, email, OTP, KYC/identity APIs, payment, cloud, SaaS).
Your job: extract EVERY cost the customer may be charged, and surface what is ambiguous so the customer can verify invoices later.
Be precise. Never invent rates. If something is not stated, say so and ask.`;

const INSTRUCTION = `Read the vendor agreement and return JSON with this exact shape:
{
  "vendor": string,
  "service": string,               // e.g. "SMS, WhatsApp and Email messaging"
  "period": string,                // billing cycle, e.g. "Monthly"
  "summary": string,               // 2 sentences, plain English, what you pay for
  "risks": string[],               // up to 4 short risks for the customer (auto-renewal, lock-in, minimums, vague billing terms)
  "costItems": [{
    "id": string,                  // short slug, e.g. "sms_txn"
    "name": string,                // e.g. "Transactional SMS"
    "category": string,            // SMS | WhatsApp | Email | KYC step | Platform fee | Other
    "unit": string,                // what one unit is, e.g. "delivered SMS (160 chars)"
    "billingEvent": "sent"|"delivered"|"attempted"|"per_call"|"per_success"|"per_month"|"unclear",
    "plainEnglish": string,        // one line: when exactly you get charged
    "pricing": { "mode": "flat"|"volume"|"graduated"|"fixed",
                 "slabs": [{ "from": number, "to": number|null, "rate": number }] },
    "minCommitment": number|null,  // ₹ per billing period minimum for this item
    "freeUnits": number|null,
    "taxPct": number|null,
    "clause": string,              // clause number + short quote
    "questions": [{ "id": string, "text": string, "options": string[] }]
  }]
}
Rules:
- "volume" = one rate applies to ALL units once a slab is reached. "graduated" = each slab rate applies only to units inside that slab. "flat" = single rate, one slab from 1 to null. "fixed" = fixed fee per period, one slab with rate = fee.
- If slab mode is not explicit, pick the most likely and add a question asking which mode applies.
- KYC / multi-step APIs: create ONE cost item per step (e.g. OTP, PAN, Aadhaar, face match, video KYC) so a user who drops off mid-journey is charged only for steps hit. Ask how drop-offs and failed calls are billed if not stated.
- Messaging: always clarify sent vs delivered vs attempted, multi-part messages, failed/DND messages, DLT charges, if not explicit.
- Ask at most 2 questions per cost item, only where the agreement is genuinely unclear. Options must be short (max 5 words) and include "Not stated in agreement".
- Do NOT create a cost item for an overall minimum commitment across services, or for GST; mention an overall minimum in "risks".
- Rates in ₹ (convert paise: 14 paise = 0.14).`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DocInput;
    if (!body.text && !body.pdfBase64) return Response.json({ error: "No agreement provided" }, { status: 400 });
    const data = await askJSON<Agreement>(SYSTEM, INSTRUCTION, body);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
