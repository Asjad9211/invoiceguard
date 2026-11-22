import type { CostItem, Slab, Invoice } from "./types";

/** Cost before tax for a quantity under a cost item's pricing. Deterministic — no AI. */
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
      for (const s of slabs) {
        const lo = Math.max(s.from - 1, 0);
        const hi = s.to ?? Infinity;
        if (q > lo) cost += (Math.min(q, hi) - lo) * s.rate;
      }
      break;
    }
  }
  if (item.minCommitment && cost < item.minCommitment) cost = item.minCommitment;
  return round(cost);
}

function findSlab(slabs: Slab[], q: number): Slab | undefined {
  return slabs.find((s) => q >= s.from && (s.to === null || q <= s.to));
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

export interface LineCheck {
  costItemId: string | null;
  description: string;
  invoicedQty: number;
  invoicedAmount: number;
  actualQty: number | null;
  expectedAmount: number | null;
  diff: number | null; // invoiced - expected
  flags: string[];
}

export function checkInvoice(invoice: Invoice, items: CostItem[]): { lines: LineCheck[]; expectedSubtotal: number; atRisk: number } {
  const lines: LineCheck[] = invoice.lines.map((l) => {
    const item = items.find((i) => i.id === l.costItemId);
    const flags: string[] = [];
    if (!item) {
      flags.push("Not in agreement — no matching cost item");
      return { costItemId: null, description: l.description, invoicedQty: l.quantity, invoicedAmount: l.amount, actualQty: null, expectedAmount: 0, diff: l.amount, flags };
    }
    const actual = item.actualQty ?? null;
    const qtyBasis = actual ?? l.quantity;
    const expected = costFor(item, qtyBasis);
    if (actual !== null && l.quantity !== actual) flags.push(`Billed ${fmtN(l.quantity)} units; source of truth shows ${fmtN(actual)}`);
    const expectedAtBilledQty = costFor(item, l.quantity);
    if (Math.abs(expectedAtBilledQty - l.amount) > 1) flags.push(`Rate mismatch: at agreed rates ${fmtN(l.quantity)} units = ₹${fmtN(expectedAtBilledQty)}, billed ₹${fmtN(l.amount)}`);
    return { costItemId: item.id, description: l.description, invoicedQty: l.quantity, invoicedAmount: l.amount, actualQty: actual, expectedAmount: expected, diff: round(l.amount - expected), flags };
  });
  const expectedSubtotal = round(lines.reduce((s, l) => s + (l.expectedAmount ?? 0), 0));
  const atRisk = round(lines.reduce((s, l) => s + Math.max(0, l.diff ?? 0), 0));
  return { lines, expectedSubtotal, atRisk };
}

export function fmtN(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
export function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
