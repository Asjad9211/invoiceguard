import type { Vendor } from "./types";

export function monthLabel(d = new Date()) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export interface Alert { level: "info" | "warn" | "risk"; vendorId: string; text: string }

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Reminders worked out from each vendor's agreement terms and its latest invoice. */
export function computeAlerts(vendors: Vendor[], today = new Date()): Alert[] {
  const out: Alert[] = [];
  for (const v of vendors) {
    const name = v.agreement.vendor;
    const inv = v.invoice;
    const invDate = inv?.date ? new Date(inv.date) : null;
    const sameMonth = invDate && invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
    const day = v.agreement.invoiceDay;
    if (!sameMonth) {
      if (day && today.getDate() > day + 2) out.push({ level: "warn", vendorId: v.id, text: `${name}: this month's invoice hasn't arrived. It was expected around the ${day}${day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}.` });
      else if (day) out.push({ level: "info", vendorId: v.id, text: `${name}: invoice expected around ${fmt(new Date(today.getFullYear(), today.getMonth(), day))}.` });
    }
    if (inv && invDate && v.status !== "approved") {
      for (const t of v.agreement.keyTerms || []) {
        if (!t.days) continue;
        const due = new Date(invDate.getTime() + t.days * 86400000);
        const left = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (t.kind === "dispute" && left >= 0 && left <= 7) out.push({ level: "risk", vendorId: v.id, text: `${name}: dispute window closes ${fmt(due)} (${left} day${left === 1 ? "" : "s"} left).` });
        if (t.kind === "payment") {
          if (left < 0) out.push({ level: "risk", vendorId: v.id, text: `${name}: invoice ${inv.invoiceNo} was due ${fmt(due)}. Check for late payment charges.` });
          else if (left <= 7) out.push({ level: "warn", vendorId: v.id, text: `${name}: invoice ${inv.invoiceNo} is due ${fmt(due)}.` });
        }
      }
    }
    const d = v.agreement.dates;
    if (d?.end) {
      const end = new Date(d.end);
      if (!isNaN(end.getTime())) {
        const left = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        if (d.noticeDays) {
          const by = new Date(end.getTime() - d.noticeDays * 86400000);
          const nl = Math.ceil((by.getTime() - today.getTime()) / 86400000);
          if (nl >= 0 && nl <= 30) out.push({ level: "risk", vendorId: v.id, text: `${name}: to leave or renegotiate, give notice by ${fmt(by)} (${nl} day${nl === 1 ? "" : "s"} left).` });
        }
        if (left >= 0 && left <= 60) out.push({ level: "warn", vendorId: v.id, text: `${name}: agreement ends ${fmt(end)}. Decide on renewal${d.escalation ? `; renewal terms: ${d.escalation}` : ""}.` });
        else if (left < 0 && left > -60) out.push({ level: "warn", vendorId: v.id, text: `${name}: agreement ended ${fmt(end)}.${d.depositRefund ? ` Deposit: ${d.depositRefund}` : ""}` });
      }
    }
    const pending = v.agreement.costItems.filter((c) => c.pricing.mode !== "fixed" && c.actualQty === undefined && c.owner);
    if (inv && v.status !== "approved" && pending.length) out.push({ level: "info", vendorId: v.id, text: `${name}: waiting for ${[...new Set(pending.map((c) => c.owner))].join(", ")} to confirm usage.` });
  }
  return out;
}
