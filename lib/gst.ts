import type { Invoice } from "./types";
import { round, inr } from "./calc";

export const STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "36": "Telangana", "37": "Andhra Pradesh",
};

const RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export function isValidGstin(g?: string | null) {
  return !!g && RE.test(g.trim().toUpperCase());
}

export interface GstFinding { level: "ok" | "warn" | "risk"; title: string; detail: string }

/** Deterministic GST checks on an extracted invoice. expectedBase = verified pre-tax amount. */
export function gstCheck(inv: Invoice, buyerGstinFallback: string | undefined, overbilled: number): { findings: GstFinding[]; taxAtRisk: number } {
  const out: GstFinding[] = [];
  const sup = inv.supplierGstin?.toUpperCase().trim();
  const buy = (inv.buyerGstin || buyerGstinFallback || "").toUpperCase().trim();

  if (!sup) out.push({ level: "risk", title: "Supplier GSTIN missing", detail: "Ask the vendor to reissue it with their GSTIN. You cannot claim input tax credit without it." });
  else if (!isValidGstin(sup)) out.push({ level: "risk", title: "Supplier GSTIN looks invalid", detail: `${sup} does not match the 15-character GSTIN format.` });
  else out.push({ level: "ok", title: "Supplier GSTIN format looks right", detail: `${sup} · ${STATES[sup.slice(0, 2)] || "state " + sup.slice(0, 2)}. Not yet checked against the GST portal.` });

  if (!buy) out.push({ level: "warn", title: "Your GSTIN not on invoice", detail: "Input tax credit needs your GSTIN on the invoice. Add it to your company profile and ask the vendor to include it." });
  else if (!isValidGstin(buy)) out.push({ level: "risk", title: "Your GSTIN on invoice looks invalid", detail: buy });

  const lines = inv.taxLines || [];
  const types = new Set(lines.map((l) => l.type));
  const tax = inv.tax || lines.reduce((s, l) => s + l.amount, 0);
  const rate = lines.reduce((s, l) => s + (l.ratePct || 0), 0) || (inv.subtotal ? round((tax / inv.subtotal) * 100) : 0);

  if (sup && buy && isValidGstin(sup) && isValidGstin(buy)) {
    const inter = sup.slice(0, 2) !== buy.slice(0, 2);
    const route = `${STATES[sup.slice(0, 2)] || sup.slice(0, 2)} → ${STATES[buy.slice(0, 2)] || buy.slice(0, 2)}`;
    if (inter && (types.has("CGST") || types.has("SGST")))
      out.push({ level: "risk", title: "Wrong tax type: should be IGST", detail: `Inter-state supply (${route}) must charge IGST, not CGST + SGST. Credit for wrongly charged tax can be denied, so ask for a corrected invoice.` });
    else if (!inter && types.has("IGST"))
      out.push({ level: "risk", title: "Wrong tax type: should be CGST + SGST", detail: `Intra-state supply (${route}) must charge CGST + SGST, not IGST.` });
    else if (types.size)
      out.push({ level: "ok", title: `${inter ? "IGST" : "CGST + SGST"} correctly applied`, detail: `${inter ? "Inter" : "Intra"}-state supply · ${route}` });
    else out.push({ level: "warn", title: "Tax type not shown", detail: `Invoice shows GST without the split. For ${route} it should be ${inter ? "IGST" : "CGST + SGST"}.` });
  }

  if (rate && Math.abs(rate - 18) > 0.5) out.push({ level: "warn", title: `GST charged at ${rate}%`, detail: `${inv.sac ? "SAC " + inv.sac + ". " : ""}Many IT and digital services are taxed at 18%. Confirm the SAC code and rate with your tax team.` });
  else if (rate) out.push({ level: "ok", title: `GST charged at ${rate}%`, detail: `${inv.sac ? "SAC " + inv.sac + ". " : ""}Confirm the SAC code matches the service if unsure.` });

  if (inv.subtotal && tax && rate && Math.abs(tax - inv.subtotal * (rate / 100)) > 2) out.push({ level: "risk", title: "Tax doesn't add up", detail: `${rate}% of ${inr(inv.subtotal)} = ${inr(round(inv.subtotal * rate / 100))}, but the invoice shows ${inr(tax)}.` });

  const taxAtRisk = rate ? round(overbilled * rate / 100) : 0;
  if (taxAtRisk > 1) out.push({ level: "risk", title: `${inr(taxAtRisk)} of GST on the overbilled amount`, detail: "This comes back too if the vendor corrects the invoice." });

  if (!inv.invoiceNo || !inv.date) out.push({ level: "warn", title: "Invoice number or date missing", detail: "Both are mandatory on a tax invoice." });
  return { findings: out, taxAtRisk };
}
