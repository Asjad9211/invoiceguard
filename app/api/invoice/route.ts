import { askJSON, type DocInput } from "@/lib/claude";
import type { Invoice } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DocInput & { costItems: { id: string; name: string; unit: string }[] };
    if (!body.text && !body.pdfBase64 && !body.docxBase64) return Response.json({ error: "No invoice provided" }, { status: 400 });
    const items = (body.costItems || []).map((c) => `${c.id}: ${c.name} (${c.unit})`).join("\n");
    const data = await askJSON<Invoice>(
      "You extract vendor invoices precisely. Never invent numbers.",
      `Extract this invoice. Map each line to one of the agreement's cost items by id, or null if no match.
Cost items:
${items}

Return JSON: { "vendor": string, "invoiceNo": string, "date": string,
"lines": [{ "description": string, "costItemId": string|null, "quantity": number, "rate": number, "amount": number }],
"subtotal": number, "tax": number, "total": number,
"supplierGstin": string|null, "buyerGstin": string|null, "sac": string|null,
"taxLines": [{ "type": "IGST"|"CGST"|"SGST"|"GST", "ratePct": number, "amount": number }] }
Use "GST" type only if the invoice does not split the tax.
Amounts in ₹ before tax per line.`,
      body
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
