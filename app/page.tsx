"use client";

import { useEffect, useMemo, useState } from "react";
import type { Agreement, CostItem, Invoice, Vendor } from "@/lib/types";
import { SAMPLES, BENCHMARKS } from "@/lib/samples";
import { checkInvoice, cliffInsight, cliffZones, costFor, fmtN, inr, round } from "@/lib/calc";

type Step = 1 | 2 | 3;
type SampleKey = keyof typeof SAMPLES;
const STORE = "invoiceguard.v1";

const EVENT_LABEL: Record<string, string> = {
  sent: "Billed when sent",
  delivered: "Billed when delivered",
  attempted: "Billed per attempt",
  per_call: "Billed per API call",
  per_success: "Billed per success",
  per_month: "Fixed per month",
  unclear: "Billing event unclear",
};

async function fileToDoc(f: File): Promise<{ text?: string; pdfBase64?: string }> {
  if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { pdfBase64: btoa(bin) };
  }
  return { text: await f.text() };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Request failed");
  return j as T;
}

function sampleQty(key: SampleKey, item: CostItem): number | undefined {
  const hay = `${item.name} ${item.category} ${item.unit}`;
  const isFixed = item.pricing.mode === "fixed" || item.billingEvent === "per_month";
  if (isFixed) return 1;
  for (const k of SAMPLES[key].usageByKeyword) {
    if (/platform|fee/i.test(k.match.source)) continue;
    if (k.match.test(hay)) return k.qty;
  }
  return undefined;
}

function rateText(c: CostItem) {
  const s = c.pricing.slabs;
  if (!s?.length) return "—";
  if (c.pricing.mode === "fixed") return `${inr(s[0].rate)} / period`;
  if (s.length === 1) return `${inr(s[0].rate)} / ${c.unit}`;
  return s.map((x) => `${fmtN(x.from)}${x.to ? "–" + fmtN(x.to) : "+"}: ${inr(x.rate)}`).join(" · ");
}

export default function Home() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ verdict: string; reasons: string[]; email: { subject: string; body: string } } | null>(null);
  const [sampleOf, setSampleOf] = useState<Record<string, SampleKey>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        setVendors(s.vendors || []);
        setSampleOf(s.sampleOf || {});
        setActiveId(s.vendors?.[0]?.id ?? null);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ vendors, sampleOf }));
    } catch {}
  }, [vendors, sampleOf]);

  const v = vendors.find((x) => x.id === activeId) || null;
  const update = (fn: (v: Vendor) => Vendor) => setVendors((all) => all.map((x) => (x.id === activeId ? fn(x) : x)));
  const updateItem = (id: string, patch: Partial<CostItem>) =>
    update((x) => ({ ...x, agreement: { ...x.agreement, costItems: x.agreement.costItems.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }));

  async function addAgreement(doc: { text?: string; pdfBase64?: string }, sample?: SampleKey) {
    setErr(null);
    setBusy("Reading agreement and extracting every cost…");
    try {
      const a = await post<Agreement>("/api/agreement", doc);
      a.costItems = (a.costItems || []).map((c) => ({ ...c, questions: c.questions || [], sourceOfTruth: "manual" }));
      const id = Math.random().toString(36).slice(2, 9);
      setVendors((all) => [{ id, agreement: a, status: "setup" }, ...all]);
      if (sample) setSampleOf((m) => ({ ...m, [id]: sample }));
      setActiveId(id);
      setStep(1);
      setVerdict(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function addInvoice(doc: { text?: string; pdfBase64?: string }) {
    if (!v) return;
    setErr(null);
    setBusy("Reading invoice and matching lines to the agreement…");
    try {
      const inv = await post<Invoice>("/api/invoice", { ...doc, costItems: v.agreement.costItems.map(({ id, name, unit }) => ({ id, name, unit })) });
      update((x) => ({ ...x, invoice: inv, status: "ready" }));
      setVerdict(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  const check = useMemo(() => (v?.invoice ? checkInvoice(v.invoice, v.agreement.costItems) : null), [v]);

  async function runDispute() {
    if (!v || !check) return;
    setBusy("Drafting the dispute with evidence…");
    try {
      const res = await post<typeof verdict>("/api/explain", {
        vendor: v.agreement.vendor,
        invoice: { no: v.invoice?.invoiceNo, date: v.invoice?.date },
        atRisk: check.atRisk,
        lines: check.lines,
        clauses: v.agreement.costItems.map((c) => ({ id: c.id, name: c.name, clause: c.clause, billingEvent: c.billingEvent, answers: c.questions.map((q) => `${q.text} → ${q.answer ?? "unanswered"}`) })),
      });
      setVerdict(res);
      update((x) => ({ ...x, status: "disputed" }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function fillSampleUsage() {
    if (!v) return;
    const key = sampleOf[v.id];
    if (!key) return;
    update((x) => ({
      ...x,
      agreement: {
        ...x.agreement,
        costItems: x.agreement.costItems.map((c) => ({
          ...c,
          actualQty: c.actualQty ?? sampleQty(key, c) ?? 0,
          owner: c.owner || (/(kyc|aadhaar|pan|face|video)/i.test(c.name + c.category) ? "Rohan (Onboarding PM)" : "Priya (Marketing Ops)"),
          sourceNote: c.sourceNote || (c.pricing.mode === "fixed" ? "Agreement — fixed fee" : "Vendor dashboard export, cross-checked with our delivery logs"),
        })),
      },
    }));
  }

  const items = v?.agreement.costItems || [];
  const openQs = items.flatMap((c) => c.questions).filter((q) => !q.answer).length;
  const setupDone = items.filter((c) => c.owner && c.actualQty !== undefined).length;
  const notStated = items.flatMap((c) => c.questions.filter((q) => q.answer && /not stated/i.test(q.answer)).map((q) => ({ item: c.name, q: q.text })));

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 text-[13px] text-zinc-900">
      {/* top bar */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded bg-emerald-600 text-[11px] font-bold text-white">IG</span>
          InvoiceGuard
        </div>
        <span className="hidden text-zinc-500 sm:inline">Know what you should pay — before you pay it.</span>
        <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">Demo · sample data is illustrative</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* vendor rail */}
        <aside className="flex shrink-0 flex-col gap-1 border-b border-zinc-200 bg-white p-2 md:w-60 md:border-b-0 md:border-r">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Vendors</div>
          <label className="cursor-pointer rounded border border-dashed border-zinc-300 px-2 py-1.5 text-center hover:bg-zinc-50">
            + Upload agreement (PDF / TXT)
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addAgreement(await fileToDoc(f)); e.target.value = ""; }} />
          </label>
          <div className="flex gap-1">
            {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
              <button key={k} disabled={!!busy} onClick={() => addAgreement({ text: SAMPLES[k].agreement }, k)} className="flex-1 rounded bg-emerald-600 px-1.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                Try {k === "messaging" ? "Messaging" : "KYC"}
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {vendors.map((x) => {
              const r = x.invoice ? checkInvoice(x.invoice, x.agreement.costItems).atRisk : 0;
              return (
                <button key={x.id} onClick={() => { setActiveId(x.id); setVerdict(null); }} className={`shrink-0 rounded px-2 py-1.5 text-left ${x.id === activeId ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
                  <div className="truncate font-medium">{x.agreement.vendor}</div>
                  <div className={`text-[11px] ${x.id === activeId ? "text-zinc-300" : "text-zinc-500"}`}>
                    {x.status === "approved" ? "✓ Approved" : x.status === "disputed" ? "Disputed" : r > 0 ? `${inr(r)} at risk` : `${x.agreement.costItems.length} cost items`}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-auto hidden space-y-0.5 text-[11px] text-zinc-400 md:block">
            <div>Coming soon: email inbox fetch · API integrations · Tally sync</div>
          </div>
        </aside>

        {/* workspace */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {busy && <div className="shrink-0 animate-pulse bg-emerald-50 px-3 py-1.5 text-emerald-800">⏳ {busy}</div>}
          {err && <div className="shrink-0 bg-red-50 px-3 py-1.5 text-red-700">{err} <button className="underline" onClick={() => setErr(null)}>dismiss</button></div>}

          {!v ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-zinc-500">
              <div className="max-w-md space-y-2">
                <div className="text-base font-semibold text-zinc-800">Upload a vendor agreement. We'll tell you exactly what you pay for.</div>
                <div>1 · Understand every cost &nbsp; 2 · Set who verifies it &nbsp; 3 · Approve invoices in a minute</div>
                <div>Tap <b>Try Messaging</b> or <b>Try KYC</b> to see it with a sample.</div>
              </div>
            </div>
          ) : (
            <>
              {/* vendor header + stepper */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-200 bg-white px-3 py-1.5">
                <div className="font-semibold">{v.agreement.vendor}</div>
                <div className="text-zinc-500">{v.agreement.service} · {v.agreement.period}</div>
                <div className="ml-auto flex overflow-hidden rounded border border-zinc-200">
                  {([
                    [1, `Understand${openQs ? ` (${openQs}?)` : " ✓"}`],
                    [2, `Source of truth ${setupDone}/${items.length}`],
                    [3, v.invoice ? (check && check.atRisk > 0 ? `Invoice · ${inr(check.atRisk)} at risk` : "Invoice ✓") : "Invoice"],
                  ] as [Step, string][]).map(([s, label]) => (
                    <button key={s} onClick={() => setStep(s)} className={`px-2.5 py-1 ${step === s ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50"}`}>
                      {s}. {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {step === 1 && (
                  <div className="space-y-2 p-3">
                    <p className="text-zinc-700">{v.agreement.summary}</p>
                    {(v.agreement.risks?.length > 0 || notStated.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {v.agreement.risks?.map((r, i) => <span key={i} className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-800">⚠ {r}</span>)}
                        {notStated.map((n, i) => <span key={"n" + i} className="rounded bg-red-50 px-1.5 py-0.5 text-red-800">Negotiate: {n.item} — not stated</span>)}
                      </div>
                    )}
                    <table className="w-full border-collapse bg-white">
                      <thead className="text-left text-[11px] uppercase text-zinc-500">
                        <tr className="border-b border-zinc-200">
                          <th className="px-2 py-1">Cost item</th>
                          <th className="px-2 py-1">When you are charged</th>
                          <th className="px-2 py-1">Rate</th>
                          <th className="hidden px-2 py-1 lg:table-cell">Agreement clause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((c) => {
                          const zones = cliffZones(c);
                          return (
                            <tr key={c.id} className="border-b border-zinc-100 align-top">
                              <td className="px-2 py-1.5">
                                <div className="font-medium">{c.name}</div>
                                <div className="text-[11px] text-zinc-500">{c.category} · per {c.unit}</div>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`mr-1 rounded px-1 py-0.5 text-[11px] ${c.billingEvent === "unclear" ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-700"}`}>{EVENT_LABEL[c.billingEvent] || c.billingEvent}</span>
                                <span className="text-zinc-700">{c.plainEnglish}</span>
                                {c.questions.map((q) => (
                                  <div key={q.id} className="mt-1 rounded bg-sky-50 p-1.5">
                                    <div className="text-sky-900">❓ {q.text}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {q.options.map((o) => (
                                        <button key={o} onClick={() => updateItem(c.id, { questions: c.questions.map((x) => (x.id === q.id ? { ...x, answer: o } : x)) })} className={`rounded border px-1.5 py-0.5 text-[12px] ${q.answer === o ? "border-sky-700 bg-sky-700 text-white" : "border-sky-200 bg-white hover:bg-sky-100"}`}>
                                          {o}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </td>
                              <td className="px-2 py-1.5">
                                <div>{rateText(c)}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {c.pricing.mode === "volume" ? "Volume: one rate on all units" : c.pricing.mode === "graduated" ? "Graduated: rate per band" : ""}
                                  {c.freeUnits ? ` · ${fmtN(c.freeUnits)} free` : ""}
                                  {c.minCommitment ? ` · min ${inr(c.minCommitment)}` : ""}
                                </div>
                                {zones.map((z, i) => (
                                  <div key={i} className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">
                                    Slab trap: between {fmtN(z.start)} and {fmtN(z.slabStart - 1)} units you pay more than at {fmtN(z.slabStart)}.
                                  </div>
                                ))}
                              </td>
                              <td className="hidden max-w-xs px-2 py-1.5 text-[12px] text-zinc-500 lg:table-cell">{c.clause}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <Compare items={items} />
                    <div className="flex justify-end">
                      <button onClick={() => setStep(2)} className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white">Next: who verifies each cost →</button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-zinc-700">For every cost, name one owner and the data you trust. Each month they confirm the real usage before anything is paid.</p>
                      {sampleOf[v.id] && <button onClick={fillSampleUsage} className="ml-auto rounded border border-emerald-600 px-2 py-1 text-emerald-700 hover:bg-emerald-50">Fill sample owners &amp; usage</button>}
                    </div>
                    <table className="w-full border-collapse bg-white">
                      <thead className="text-left text-[11px] uppercase text-zinc-500">
                        <tr className="border-b border-zinc-200">
                          <th className="px-2 py-1">Cost item</th>
                          <th className="px-2 py-1">Owner</th>
                          <th className="px-2 py-1">Source of truth</th>
                          <th className="px-2 py-1">Verified usage (this month)</th>
                          <th className="px-2 py-1 text-right">Should cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((c) => {
                          const q = c.actualQty;
                          const cl = q !== undefined ? cliffInsight(c, q) : null;
                          return (
                            <tr key={c.id} className="border-b border-zinc-100 align-top">
                              <td className="px-2 py-1.5 font-medium">{c.name}<div className="text-[11px] font-normal text-zinc-500">{EVENT_LABEL[c.billingEvent]}</div></td>
                              <td className="px-2 py-1.5"><input value={c.owner || ""} onChange={(e) => updateItem(c.id, { owner: e.target.value })} placeholder="Name / team" className="w-full rounded border border-zinc-200 px-1.5 py-1" /></td>
                              <td className="px-2 py-1.5">
                                <div className="flex gap-1">
                                  <button onClick={() => updateItem(c.id, { sourceOfTruth: "manual" })} className={`rounded px-1.5 py-0.5 ${c.sourceOfTruth !== "api" ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>Owner verifies</button>
                                  <button disabled title="Coming soon" className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-400">API · soon</button>
                                </div>
                                <input value={c.sourceNote || ""} onChange={(e) => updateItem(c.id, { sourceNote: e.target.value })} placeholder="e.g. vendor dashboard export" className="mt-1 w-full rounded border border-zinc-200 px-1.5 py-1 text-[12px]" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={q ?? ""} onChange={(e) => updateItem(c.id, { actualQty: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder={c.unit} className="w-32 rounded border border-zinc-200 px-1.5 py-1" />
                                {cl && <div className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">At {fmtN(q!)} you pay {inr(cl.cost)}. At {fmtN(cl.nextQty)} you'd pay {inr(cl.nextCost)} — {inr(cl.saving)} less. Renegotiate to graduated slabs.</div>}
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">{q !== undefined ? inr(costFor(c, q)) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-zinc-600">Expected this month: <b>{inr(round(items.reduce((s, c) => s + (c.actualQty !== undefined ? costFor(c, c.actualQty) : 0), 0)))}</b> + GST</span>
                      <button onClick={() => setStep(3)} className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white">Next: check invoice →</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded border border-dashed border-zinc-300 bg-white px-2 py-1 hover:bg-zinc-50">
                        Upload invoice (PDF / TXT)
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addInvoice(await fileToDoc(f)); e.target.value = ""; }} />
                      </label>
                      {sampleOf[v.id] && <button disabled={!!busy} onClick={() => addInvoice({ text: SAMPLES[sampleOf[v.id]].invoice })} className="rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Use sample invoice</button>}
                      <button disabled title="Coming soon" className="rounded bg-zinc-100 px-2 py-1 text-zinc-400">Fetch from email · soon</button>
                      {items.some((c) => c.actualQty === undefined) && <span className="text-amber-700">Tip: add verified usage in step 2 for a full check.</span>}
                    </div>

                    {v.invoice && check && (
                      <>
                        <div className="flex flex-wrap items-stretch gap-2">
                          <Stat label="Invoiced (pre-GST)" value={inr(v.invoice.subtotal)} />
                          <Stat label="Should be" value={inr(check.expectedSubtotal)} />
                          <Stat label="At risk" value={inr(check.atRisk)} tone={check.atRisk > 0 ? "bad" : "good"} />
                          <div className="ml-auto flex items-center gap-2">
                            {v.status === "approved" ? (
                              <span className="rounded bg-emerald-100 px-3 py-2 font-semibold text-emerald-800">✓ Approved for payment</span>
                            ) : check.atRisk > 0 ? (
                              <>
                                <button onClick={runDispute} disabled={!!busy} className="rounded bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">Dispute {inr(check.atRisk)}</button>
                                <button onClick={() => update((x) => ({ ...x, status: "approved" }))} className="rounded border border-zinc-300 px-3 py-2 hover:bg-zinc-50">Approve {inr(check.expectedSubtotal)}</button>
                              </>
                            ) : (
                              <button onClick={() => update((x) => ({ ...x, status: "approved" }))} className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white">Approve {inr(v.invoice.total)}</button>
                            )}
                          </div>
                        </div>
                        <table className="w-full border-collapse bg-white">
                          <thead className="text-left text-[11px] uppercase text-zinc-500">
                            <tr className="border-b border-zinc-200">
                              <th className="px-2 py-1">Invoice line</th>
                              <th className="px-2 py-1 text-right">Billed qty</th>
                              <th className="px-2 py-1 text-right">Verified qty</th>
                              <th className="px-2 py-1 text-right">Billed</th>
                              <th className="px-2 py-1 text-right">Should be</th>
                              <th className="px-2 py-1 text-right">Difference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {check.lines.map((l, i) => (
                              <tr key={i} className={`border-b border-zinc-100 align-top ${l.diff && l.diff > 0 ? "bg-red-50/50" : ""}`}>
                                <td className="px-2 py-1.5">
                                  <div className="font-medium">{l.description}</div>
                                  {l.flags.map((f, j) => <div key={j} className="text-[12px] text-red-700">• {f}</div>)}
                                </td>
                                <td className="px-2 py-1.5 text-right">{fmtN(l.invoicedQty)}</td>
                                <td className="px-2 py-1.5 text-right">{l.actualQty !== null ? fmtN(l.actualQty) : "—"}</td>
                                <td className="px-2 py-1.5 text-right">{inr(l.invoicedAmount)}</td>
                                <td className="px-2 py-1.5 text-right">{l.expectedAmount !== null ? inr(l.expectedAmount) : "—"}</td>
                                <td className={`px-2 py-1.5 text-right font-semibold ${l.diff && l.diff > 0 ? "text-red-700" : "text-emerald-700"}`}>{l.diff ? (l.diff > 0 ? "+" : "") + inr(l.diff) : "✓"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <MinCheck items={items} expected={check.expectedSubtotal} />
                      </>
                    )}

                    {verdict && (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded border border-zinc-200 bg-white p-2">
                          <div className="mb-1 font-semibold">Verdict: <span className={verdict.verdict === "Pay" ? "text-emerald-700" : "text-red-700"}>{verdict.verdict}</span></div>
                          <ul className="list-disc space-y-0.5 pl-4 text-zinc-700">{verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                        <div className="rounded border border-zinc-200 bg-white p-2">
                          <div className="mb-1 flex items-center font-semibold">Dispute email
                            <button onClick={() => navigator.clipboard?.writeText(`Subject: ${verdict.email.subject}\n\n${verdict.email.body}`)} className="ml-auto rounded border border-zinc-300 px-1.5 py-0.5 text-[12px] font-normal">Copy</button>
                          </div>
                          <div className="text-[12px] font-medium">Subject: {verdict.email.subject}</div>
                          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-sans text-[12px] text-zinc-700">{verdict.email.body}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className={`rounded border px-3 py-1.5 ${tone === "bad" ? "border-red-200 bg-red-50" : tone === "good" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
      <div className="text-[11px] uppercase text-zinc-500">{label}</div>
      <div className={`text-lg font-bold ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : ""}`}>{value}</div>
    </div>
  );
}

function MinCheck({ items, expected }: { items: CostItem[]; expected: number }) {
  const min = Math.max(0, ...items.map((c) => c.minCommitment ?? 0));
  if (!min || expected >= min) return null;
  return <div className="rounded bg-amber-50 px-2 py-1 text-amber-900">Minimum commitment {inr(min)}: usage-based charges are {inr(expected)}, so a shortfall of {inr(round(min - expected))} may be billed.</div>;
}

function Compare({ items }: { items: CostItem[] }) {
  const rows = items
    .map((c) => {
      if (c.pricing.mode === "fixed") return null;
      const b = BENCHMARKS.find((x) => x.match.test(`${c.name} ${c.category}`));
      if (!b || !c.pricing.slabs?.length) return null;
      const yours = c.pricing.slabs[0].rate;
      if (b.rate >= yours) return { c, b, yours, saving: 0 };
      const qty = c.actualQty;
      const saving = qty ? round(costFor(c, qty) - qty * b.rate) : null;
      return { c, b, yours, saving };
    })
    .filter(Boolean) as { c: CostItem; b: (typeof BENCHMARKS)[number]; yours: number; saving: number | null }[];
  if (!rows.length) return null;
  return (
    <div className="rounded border border-zinc-200 bg-white p-2">
      <div className="mb-1 flex items-center gap-2 font-semibold">Market comparison <span className="text-[11px] font-normal text-zinc-500">Illustrative rates from partner vendors. We never use your data to build benchmarks.</span></div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(({ c, b, yours, saving }) => (
          <div key={c.id} className="rounded bg-zinc-50 px-2 py-1">
            <span className="font-medium">{c.name}</span>: you {inr(yours)} · best {inr(b.rate)} ({b.vendor})
            {b.rate < yours ? <span className="ml-1 text-emerald-700">{saving ? `save ~${inr(saving)}/mo` : `${Math.round((1 - b.rate / yours) * 100)}% cheaper`}</span> : <span className="ml-1 text-zinc-500">you're at market</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
