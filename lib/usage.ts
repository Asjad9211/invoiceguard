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

export function applyRule(headers: string[], rows: string[][], r: UsageRule): number {
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
