import { askJSON, type DocInput } from "@/lib/claude";
import type { Agreement } from "@/lib/types";

export const maxDuration = 300;

const SYSTEM = `You are InvoiceGuard, an expert. You may receive ANY commercial document (MSA, order form, rate card, SOW, proposal, email). Treat it as the agreement. If it has no pricing at all, return costItems: [] and explain in summary what is missing. You are an expert in Indian vendor agreements for usage-based services (SMS, WhatsApp, email, OTP, KYC/identity APIs, payment, cloud, SaaS).
Your job: extract EVERY cost the customer may be charged, and surface what is ambiguous so the customer can verify invoices later.
Be precise. Never invent rates. If something is not stated, say so and ask.
Write in plain, simple English like a careful finance colleague. Short sentences. Never use em dashes or en dashes; use commas or full stops. No hype.`;

const INSTRUCTION = `Read the vendor agreement and return JSON with this exact shape:
{
  "vendor": string,
  "service": string,               // e.g. "SMS, WhatsApp and Email messaging"
  "period": string,                // billing cycle, e.g. "Monthly"
  "summary": string,               // 2 sentences, plain English, what you pay for
  "risks": string[],
  "suggestions": string[],         // up to 3 things to clarify with the vendor in writing, each one short line
  "negotiate": [{                  // up to 5 things worth negotiating, most valuable first
    "type": "Fixed fee"|"Unit rate"|"Slab rule"|"Minimum commitment"|"Billing rule"|"Contract term",
    "item": string,                // which charge, e.g. "Email platform fee ₹5,000/month"
    "ask": string,                 // what to ask for, concrete, e.g. "Waive it, or cap it at ₹2,000 once volume crosses 5 lakh emails"
    "why": string                  // one short line on why it matters to the customer
  }],               // up to 4 short risks for the customer (auto-renewal, lock-in, minimums, vague billing terms)
  "keyTerms": [{ "kind": "payment"|"dispute"|"penalty"|"free_period"|"renewal"|"billing_start"|"other", "label": string, "detail": string, "days": number|null }],
                                   // payment terms (days to pay), dispute window (days), late payment penalty/interest, free credit or free trial period, renewal/notice, when billing starts. Plain words.
  "invoiceDay": number|null,       // day of month the invoice is expected, e.g. 5 if "invoices raised at the start of each month"; null if not stated
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
    "recurring": "monthly"|"one_time"|"on_request",  // one-time setup fees and optional services are NOT monthly
    "includes": string[],          // if one price covers a bundle of APIs or steps (e.g. "per onboarding"), list them; else []
    "questions": [{ "id": string, "text": string, "options": string[] }]
  }]
}
Rules:
- "volume" = one rate applies to ALL units once a slab is reached. "graduated" = each slab rate applies only to units inside that slab. "flat" = single rate, one slab from 1 to null. "fixed" = fixed fee per period, one slab with rate = fee.
- If slab mode is not explicit, pick the most likely and add a question asking which mode applies.
- KYC / multi-step APIs: create ONE cost item per step (e.g. OTP, PAN, Aadhaar, face match, video KYC) so a user who drops off mid-journey is charged only for steps hit. Ask how drop-offs and failed calls are billed if not stated.
- Bundled pricing: if one price covers a whole journey (e.g. "price per onboarding" covering OCR, PAN, Aadhaar, video, face match), make ONE cost item, list the steps in "includes", and ask: (a) is an onboarding billed when started or only when completed, (b) are journeys abandoned midway billed in full, per step, or not at all, (c) are retries counted again. Suggest in "negotiate" to pay per step used for drop-offs, or only for completed onboardings.
- If a fee is struck through, marked waived, NA or optional in the document, say so in plainEnglish and do not treat it as a monthly charge.
- Messaging: always clarify sent vs delivered vs attempted, multi-part messages, failed/DND messages, DLT charges, if not explicit.
- Ask at most 2 questions per cost item, only where the agreement is genuinely unclear. Options must be short (max 5 words) and include "Not stated in agreement".
- Do NOT create a cost item for an overall minimum commitment across services, or for GST; mention an overall minimum in "risks".
- Rates in ₹ (convert paise: 14 paise = 0.14).`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DocInput;
    if (!body.text && !body.pdfBase64 && !body.docxBase64) return Response.json({ error: "No agreement provided" }, { status: 400 });
    const data = await askJSON<Agreement>(SYSTEM, INSTRUCTION, body);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
