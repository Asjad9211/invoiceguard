export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export type UsageRule = { costItemId: string; mode: "count" | "sum"; sumColumn?: string | null; filters: { column: string; op: "equals" | "in" | "not_in" | "contains"; values: string[] }[]; explanation: string };

export function validateRule(headers: string[], r: UsageRule): string | null {
  const has = (c?: string | null) => !!c && headers.some((h) => h.trim().toLowerCase() === c.trim().toLowerCase());
  for (const f of r.filters || []) if (!has(f.column)) return `column "${f.column}" is not in the file`;
  if (r.mode === "sum" && !has(r.sumColumn)) return `column "${r.sumColumn}" is not in the file`;
  return null;
}

export function distinctValues(headers: string[], rows: string[][], col: string, max = 12): string[] {
  const i = headers.findIndex((h) => h.trim().toLowerCase() === col.trim().toLowerCase());
  if (i < 0) return [];
  const seen = new Map<string, number>();
  for (const r of rows) { const v = (r[i] ?? "").trim(); seen.set(v, (seen.get(v) || 0) + 1); }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v, n]) => `${v || "(blank)"} (${n})`);
}

export function applyRule(headers: string[], rows: string[][], r: UsageRule): number {
  return applyRuleDetailed(headers, rows, r).total;
}

export function applyRuleDetailed(headers: string[], rows: string[][], r: UsageRule): { total: number; matched: number; invalid: number; blank: number } {
  const idx2 = (c: string) => headers.findIndex((h) => h.trim().toLowerCase() === c.trim().toLowerCase());
  let total = 0, matched = 0, invalid = 0, blank = 0;
  for (const row of rows) {
    if (r.filters.some((f) => (row[idx2(f.column)] ?? "").trim() === "")) { blank++; continue; }
    const ok = r.filters.every((f) => {
      const v = (row[idx2(f.column)] ?? "").trim().toLowerCase();
      const vals = f.values.map((x) => x.trim().toLowerCase());
      if (f.op === "equals") return v === vals[0];
      if (f.op === "in") return vals.includes(v);
      if (f.op === "not_in") return !vals.includes(v);
      return vals.some((x) => v.includes(x));
    });
    if (!ok) continue;
    if (r.mode === "sum" && r.sumColumn) {
      const raw = String(row[idx2(r.sumColumn)] ?? "").replace(/,/g, "").trim();
      const n = Number(raw);
      if (raw === "" || !isFinite(n)) { invalid++; continue; }
      total += n;
    } else total += 1;
    matched++;
  }
  return { total, matched, invalid, blank };
}

export function applyRuleOld(headers: string[], rows: string[][], r: UsageRule): number {
  const idx = (c: string) => headers.findIndex((h) => h.trim().toLowerCase() === c.trim().toLowerCase());
  const norm = (x: string) => (x ?? "").trim().toLowerCase();
  let total = 0;
  for (const row of rows) {
    const ok = r.filters.every((f) => {
      const v = norm(row[idx(f.column)]);
      const vals = f.values.map(norm);
      if (f.op === "equals") return v === vals[0];
      if (f.op === "in") return vals.includes(v);
      if (f.op === "not_in") return !vals.includes(v);
      return vals.some((x) => v.includes(x));
    });
    if (!ok) continue;
    if (r.mode === "sum" && r.sumColumn) total += Number(String(row[idx(r.sumColumn)]).replace(/,/g, "")) || 0;
    else total += 1;
  }
  return total;
}
