import { askJSON } from "@/lib/claude";

export const maxDuration = 120;

// Claude writes the counting rule from the file's columns and sample rows. Code applies it to every row.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { headers: string[]; sample: string[][]; rowCount: number; costItems: { id: string; name: string; unit: string; billingEvent: string; includes?: string[]; answers?: string[] }[] };
    if (!body.headers?.length) return Response.json({ error: "No columns found in the file" }, { status: 400 });
    const data = await askJSON<{ rules: { costItemId: string; mode: "count" | "sum"; sumColumn?: string | null; filters: { column: string; op: "equals" | "in" | "not_in" | "contains"; values: string[] }[]; explanation: string }[]; notes: string[] }>(
      "You map vendor usage exports to billable charges. You never count rows yourself; you write precise filter rules that code will apply.",
      `A usage export has ${body.rowCount} rows. Columns: ${JSON.stringify(body.headers)}
Sample rows: ${JSON.stringify(body.sample)}
Billable charges from the agreement (with the billing event and any answers the user gave):
${JSON.stringify(body.costItems)}

For each charge this file can measure, return a rule: count rows (or sum a quantity column) that match all filters. Use exact column names and exact values seen in the sample. Respect the billing event: e.g. per completed onboarding means filter status = completed; per delivered message means delivered only.
Also return "notes": up to 3 plain observations, e.g. how many rows are drop-offs or failures that should not be billed.
Shape: { "rules": [{ "costItemId": string, "mode": "count"|"sum", "sumColumn": string|null, "filters": [{ "column": string, "op": "equals"|"in"|"not_in"|"contains", "values": string[] }], "explanation": string }], "notes": string[] }`
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
