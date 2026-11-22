import type { CostItem, Slab, Invoice } from "./types";

/** Cost before tax for a quantity under a cost item's pricing. Deterministic, no AI. */
export function costFor(item: CostItem, qty: number): number {
  const free = item.freeUnits ?? 0;
  const q = Math.max(0, qty - free);
  const slabs = [...item.pricing.slabs].sort((a, b) => a.from - b.from);
  if (slabs.length === 0) return 0;
  let cost = 0;
  switch (item.pricing.mode) {
    case "fixed":
      cost = slabs[0].rate;
      break;
    case "flat":
      cost = q * slabs[0].rate;
      break;
    case "volume": {
      const s = findSlab(slabs, q) ?? slabs[slabs.length - 1];
      cost = q * s.rate;
      break;
    }
    case "graduated": {
      // band i covers (previous band's upper bound, this band's upper bound]; works for 0- or 1-indexed slabs
      slabs.forEach((s, i) => {
        const lo = i === 0 ? 0 : (slabs[i - 1].to ?? s.from - 1);
        const hi = s.to ?? Infinity;
        if (q > lo) cost += (Math.min(q, hi) - lo) * s.rate;
      });
      break;
    }
  }
  if (item.minCommitment && cost < item.minCommitment) cost = item.minCommitment;
  return round(cost);
}

function findSlab(slabs: Slab[], q: number): Slab | undefined {
  return slabs.find((s) => q >= s.from && (s.to === null || q <= s.to));
}

/** Returns a problem with the slab table, or null if ranges are continuous and non-overlapping. */
export function slabIssue(item: CostItem): string | null {
  const s = [...(item.pricing.slabs || [])].sort((a, b) => a.from - b.from);
  if (item.pricing.mode !== "volume" && item.pricing.mode !== "graduated") return null;
  for (let i = 1; i < s.length; i++) {
    const prevTo = s[i - 1].to;
    if (prevTo === null) return "A slab with no upper limit is followed by another slab";
    if (s[i].from > prevTo + 1) return `Gap between ${prevTo} and ${s[i].from}`;
    if (s[i].from < prevTo) return `Slabs overlap around ${s[i].from}`;
  }
  return null;
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}

export interface CliffInsight {
  qty: number;
  cost: number;
  nextQty: number;
  nextCost: number;
  saving: number;
}

/** Volume-pricing cliff: is buying up to the next slab cheaper than current usage? */
export function cliffInsight(item: CostItem, qty: number): CliffInsight | null {
  if (item.pricing.mode !== "volume") return null;
  const free = item.freeUnits ?? 0;
  const slabs = [...item.pricing.slabs].sort((a, b) => a.from - b.from);
  const cost = costFor(item, qty);
  for (const s of slabs) {
    const nextQty = s.from + free;
    if (nextQty > qty) {
      const nextCost = costFor(item, nextQty);
      if (nextCost < cost) return { qty, cost, nextQty, nextCost, saving: round(cost - nextCost) };
      return null;
    }
  }
  return null;
}

/** Break-even below a volume slab: from this qty up to the slab, you overpay. */
export function cliffZones(item: CostItem): { start: number; slabStart: number; rate: number }[] {
  if (item.pricing.mode !== "volume") return [];
  const slabs = [...item.pricing.slabs].sort((a, b) => a.from - b.from);
  const out: { start: number; slabStart: number; rate: number }[] = [];
  for (let i = 1; i < slabs.length; i++) {
    const prev = slabs[i - 1];
    const s = slabs[i];
    const atSlab = s.from * s.rate;
    const start = Math.floor(atSlab / prev.rate) + 1;
    if (start < s.from) out.push({ start, slabStart: s.from, rate: s.rate });
  }
  return out;
}

export type LineStatus = "verified" | "discrepancy" | "pending" | "unmatched" | "fixed";

export interface LineCheck {
  costItemId: string | null;
  description: string;
  invoicedQty: number;
  invoicedAmount: number;
  actualQty: number | null;
  expectedAmount: number | null; // null when usage is not confirmed yet
  diff: number | null; // invoiced - expected (only when we can say)
  status: LineStatus;
  flags: string[];
}

/** One row per cost item (lines for the same item are combined, so slabs, free units and minimums apply once). */
export function checkInvoice(invoice: Invoice, items: CostItem[]) {
  const groups = new Map<string, { item: CostItem; qty: number; amount: number; desc: string[] }>();
  const rows: LineCheck[] = [];
  for (const l of invoice.lines || []) {
    const item = items.find((i) => i.id === l.costItemId);
    if (!item && (l.amount || 0) < 0) {
      rows.push({ costItemId: null, description: l.description, invoicedQty: l.quantity, invoicedAmount: l.amount, actualQty: null, expectedAmount: l.amount, diff: 0, status: "fixed", flags: ["Credit or adjustment applied by the vendor"] });
      continue;
    }
    if (!item) {
      rows.push({ costItemId: null, description: l.description, invoicedQty: l.quantity, invoicedAmount: l.amount, actualQty: null, expectedAmount: null, diff: null, status: "unmatched", flags: ["Not found in the agreement. Check if it was approved separately before paying."] });
      continue;
    }
    const g = groups.get(item.id) || { item, qty: 0, amount: 0, desc: [] };
    g.qty += l.quantity || 0;
    g.amount += l.amount || 0;
    g.desc.push(l.description);
    groups.set(item.id, g);
  }
  for (const { item, qty, amount, desc } of groups.values()) {
    const flags: string[] = [];
    const si = slabIssue(item);
    if (si) flags.push(`Slab table needs checking (${si}). Confirm the slabs in step 1 before relying on this amount.`);
    const atBilledQty = costFor(item, qty);
    const rateGap = round(amount - atBilledQty);
    if (Math.abs(rateGap) > 1) flags.push(`Rate mismatch: at agreed rates ${fmtN(qty)} units = ${inr(atBilledQty)}, billed ${inr(round(amount))}`);
    if ((item.includes?.length ?? 0) > 1 && desc.length === 1) flags.push(`One price covers ${item.includes!.length} steps, but the invoice has no journey-wise breakup (started, completed, dropped). Ask the vendor for it before paying.`);
    const fixed = item.pricing.mode === "fixed" || item.billingEvent === "per_month";
    const actual = fixed ? null : item.actualQty ?? null;
    let expected: number | null;
    let status: LineStatus;
    if (fixed) {
      expected = atBilledQty;
      status = Math.abs(rateGap) > 1 ? "discrepancy" : "fixed";
    } else if (actual === null) {
      expected = null;
      status = Math.abs(rateGap) > 1 ? "discrepancy" : "pending";
      flags.push(`Quantity not verified yet: ${fmtN(qty)} units claimed by the vendor. Waiting for the owner to confirm usage.`);
    } else {
      expected = costFor(item, actual);
      if (qty !== actual) flags.push(`Billed ${fmtN(qty)} units, confirmed usage is ${fmtN(actual)}`);
      status = Math.abs(amount - expected) > 1 ? "discrepancy" : "verified";
    }
    const diff = expected !== null ? round(amount - expected) : Math.abs(rateGap) > 1 ? rateGap : null;
    rows.push({ costItemId: item.id, description: desc.length > 1 ? `${item.name} (${desc.length} lines combined)` : desc[0], invoicedQty: qty, invoicedAmount: round(amount), actualQty: actual, expectedAmount: expected, diff, status, flags });
  }
  const atRisk = round(rows.filter((r) => r.status === "discrepancy").reduce((s, r) => s + Math.max(0, r.diff ?? 0), 0));
  const unmatched = round(rows.filter((r) => r.status === "unmatched").reduce((s, r) => s + r.invoicedAmount, 0));
  const pending = rows.filter((r) => r.flags.some((f) => f.startsWith("Quantity not verified"))).length;
  const confirmedExpected = round(rows.reduce((s, r) => s + (r.expectedAmount ?? 0), 0));
  return { lines: rows, atRisk, unmatched, pending, expectedSubtotal: confirmedExpected };
}

export function fmtN(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
export function inr(n: number) {
  const d = Math.abs(n) < 1 ? 3 : 2;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(2, d) });
}
