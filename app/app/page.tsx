"use client";

import { useEffect, useMemo, useState } from "react";
import type { Agreement, CostItem, Invoice, Vendor } from "@/lib/types";
import { SAMPLES, BENCHMARKS } from "@/lib/samples";
import { checkInvoice, cliffInsight, cliffZones, costFor, fmtN, inr, round } from "@/lib/calc";
import { gstCheck } from "@/lib/gst";
import { DEMO_ORG, loadOrg, saveOrg, ROLE_INFO, type Org, type Role } from "@/lib/org";
import { Logo } from "@/components/Logo";
import Link from "next/link";

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
  if (!s?.length) return "-";
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
  const [org, setOrg] = useState<Org>(DEMO_ORG);
  const [teamOpen, setTeamOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    const o = loadOrg();
    if (o) setOrg(o);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome")) setWelcome(true);
  }, []);

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
  const gst = useMemo(() => (v?.invoice && check ? gstCheck(v.invoice, org.gstin, check.expectedSubtotal) : null), [v, check, org.gstin]);

  async function runDispute() {
    if (!v || !check) return;
    setBusy("Drafting the dispute with evidence…");
    try {
      const res = await post<typeof verdict>("/api/explain", {
        vendor: v.agreement.vendor,
        invoice: { no: v.invoice?.invoiceNo, date: v.invoice?.date },
        atRisk: check.atRisk,
        lines: check.lines,
        gstFindings: gst?.findings.filter((f) => f.level !== "ok"),
        gstChargedOnOverbilling: gst?.taxAtRisk,
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
          owner: c.owner || (/(kyc|aadhaar|pan|face|video)/i.test(c.name + c.category) ? (org.members[2]?.name || "Rohan (Onboarding PM)") : (org.members[1]?.name || "Priya (Marketing Ops)")),
          sourceNote: c.sourceNote || (c.pricing.mode === "fixed" ? "Fixed fee in the agreement" : "Vendor dashboard export, cross-checked with our delivery logs"),
        })),
      },
    }));
  }

  const items = v?.agreement.costItems || [];
  const openQs = items.flatMap((c) => c.questions).filter((q) => !q.answer).length;
  const setupDone = items.filter((c) => c.owner && c.actualQty !== undefined).length;
  const notStated = items.flatMap((c) => c.questions.filter((q) => q.answer && /not stated/i.test(q.answer)).map((q) => ({ item: c.name, q: q.text })));

  return (
    <div className="flex h-dvh flex-col bg-paper text-[14px] text-ink">
      {/* top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-3">
        <Link href="/" aria-label="Home"><Logo /></Link>
        
        <div className="ml-auto flex items-center gap-2">
          
          <button onClick={() => setTeamOpen(true)} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 hover:bg-paper">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-semibold text-white">{org.name.slice(0, 1)}</span>
            <span className="max-w-[140px] truncate font-medium">{org.name}</span>
            <span className="text-slate">· Team {org.members.length}</span>
          </button>
        </div>
      </header>
      {welcome && <div className="shrink-0 bg-cobalt-50 px-3 py-1.5 text-cobalt">Welcome, {org.members[0]?.name}! Your company is set up. Invite your team from the top right, then upload your first agreement. <button className="underline" onClick={() => setWelcome(false)}>Got it</button></div>}
      {teamOpen && <TeamPanel org={org} setOrg={(o) => { setOrg(o); saveOrg(o); }} onClose={() => setTeamOpen(false)} />}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* vendor rail */}
        <aside className="flex shrink-0 flex-col gap-1 border-b border-zinc-200 bg-white p-2 md:w-60 md:border-b-0 md:border-r">
          <div className="px-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-slate">Your vendors</div>
          <label className="cursor-pointer rounded border border-dashed border-zinc-300 px-2 py-1.5 text-center hover:bg-paper">
            + Upload agreement or any doc (PDF / TXT)
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addAgreement(await fileToDoc(f)); e.target.value = ""; }} />
          </label>
          <div className="flex gap-1">
            {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
              <button key={k} disabled={!!busy} onClick={() => addAgreement({ text: SAMPLES[k].agreement }, k)} className="flex-1 rounded bg-cobalt px-1.5 py-1 text-[12px] font-medium text-white hover:bg-[#2148e0] disabled:opacity-50">
                {k === "messaging" ? "Sample: SMS & email" : "Sample: KYC"}
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {vendors.map((x) => {
              const r = x.invoice ? checkInvoice(x.invoice, x.agreement.costItems).atRisk : 0;
              return (
                <button key={x.id} onClick={() => { setActiveId(x.id); setVerdict(null); }} className={`shrink-0 rounded px-2 py-1.5 text-left ${x.id === activeId ? "bg-ink text-white" : "hover:bg-zinc-100"}`}>
                  <div className="truncate font-medium">{x.agreement.vendor}</div>
                  <div className={`text-[11px] ${x.id === activeId ? "text-zinc-300" : "text-zinc-500"}`}>
                    {x.status === "approved" ? "✓ Approved" : x.status === "disputed" ? "Disputed" : r > 0 ? `${inr(r)} at risk` : `${x.agreement.costItems.length} cost items`}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-auto hidden space-y-0.5 text-[11px] text-zinc-400 md:block">
            <div>Coming soon: invoices from email, usage from vendor APIs, Tally export</div>
          </div>
        </aside>

        {/* workspace */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {busy && <div className="shrink-0 animate-pulse bg-cobalt-50 px-3 py-1.5 text-cobalt">⏳ {busy}</div>}
          {err && <div className="shrink-0 bg-red-50 px-3 py-1.5 text-red-700">{err} <button className="underline" onClick={() => setErr(null)}>dismiss</button></div>}

          {!v ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-zinc-500">
              <div className="max-w-md space-y-2">
                <div className="font-display text-xl font-semibold text-ink">Upload any vendor agreement, order form or rate card.</div>
                <div>Claude reads it, lists every cost, asks what's unclear and suggests what to negotiate.</div>
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
                <div className="ml-auto flex overflow-hidden rounded-lg border border-line bg-white p-0.5">
                  {([
                    [1, `Understand${openQs ? ` · ${openQs} to answer` : " ✓"}`],
                    [2, `Who checks ${setupDone}/${items.length}`],
                    [3, v.invoice ? (check && check.atRisk > 0 ? `Invoice · ${inr(check.atRisk)} at risk` : "Invoice ✓") : "Invoice"],
                  ] as [Step, string][]).map(([s, label]) => (
                    <button key={s} onClick={() => setStep(s)} className={`rounded-md px-3 py-1.5 font-medium ${step === s ? "bg-ink text-white" : "text-slate hover:bg-paper hover:text-ink"}`}>
                      {s} {label}
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
                        {notStated.map((n, i) => <span key={"n" + i} className="rounded bg-red-50 px-1.5 py-0.5 text-red-800">Not stated: {n.item}</span>)}
                      </div>
                    )}
                    {v.agreement.suggestions && v.agreement.suggestions.length > 0 && (
                      <div className="rounded border border-cobalt-100 bg-cobalt-50 p-2">
                        <div className="mb-0.5 font-semibold text-cobalt">Get these clarified in writing</div>
                        <ul className="list-disc space-y-0.5 pl-4 text-ink-2">{v.agreement.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                      </div>
                    )}
                    <table className="w-full border-collapse overflow-hidden rounded-lg bg-white ring-1 ring-line">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-slate bg-paper">
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
                                  <div key={q.id} className="mt-1 rounded-md bg-cobalt-50 p-2">
                                    <div className="text-ink">❓ {q.text}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {q.options.map((o) => (
                                        <button key={o} onClick={() => updateItem(c.id, { questions: c.questions.map((x) => (x.id === q.id ? { ...x, answer: o } : x)) })} className={`rounded-md border px-2 py-1 text-[13px] ${q.answer === o ? "border-cobalt bg-cobalt text-white" : "border-cobalt-100 bg-white hover:border-cobalt"}`}>
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
                    <Negotiate list={v.agreement.negotiate} />
                    {showCompare ? <Compare items={items} /> : (
                      <button onClick={() => setShowCompare(true)} className="rounded-lg border border-line bg-white px-3 py-2 font-medium hover:border-cobalt hover:text-cobalt">Compare my rates with the market</button>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => setStep(2)} className="rounded bg-ink px-3 py-1.5 font-medium text-white">Next: who verifies each cost →</button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-zinc-700">For every cost, name one owner and the data you trust. Each month they confirm the real usage before anything is paid.</p>
                      {sampleOf[v.id] && <button onClick={fillSampleUsage} className="ml-auto rounded border border-cobalt px-2 py-1 text-ok hover:bg-cobalt-50">Fill sample owners &amp; usage</button>}
                    </div>
                    <datalist id="members">{org.members.filter((m) => m.role !== "Viewer").map((m) => <option key={m.id} value={m.name} />)}</datalist>
                    <table className="w-full border-collapse overflow-hidden rounded-lg bg-white ring-1 ring-line">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-slate bg-paper">
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
                              <td className="px-2 py-1.5"><input list="members" value={c.owner || ""} onChange={(e) => updateItem(c.id, { owner: e.target.value })} placeholder="Pick a team member" className="w-full rounded border border-zinc-200 px-1.5 py-1" /></td>
                              <td className="px-2 py-1.5">
                                <div className="flex gap-1">
                                  <button onClick={() => updateItem(c.id, { sourceOfTruth: "manual" })} className={`rounded px-1.5 py-0.5 ${c.sourceOfTruth !== "api" ? "bg-ink text-white" : "bg-zinc-100"}`}>Owner verifies</button>
                                  <button disabled title="Coming soon" className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-400">API · soon</button>
                                </div>
                                <input value={c.sourceNote || ""} onChange={(e) => updateItem(c.id, { sourceNote: e.target.value })} placeholder="e.g. vendor dashboard export" className="mt-1 w-full rounded border border-zinc-200 px-1.5 py-1 text-[12px]" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={q ?? ""} onChange={(e) => updateItem(c.id, { actualQty: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder={c.unit} className="w-32 rounded border border-zinc-200 px-1.5 py-1" />
                                {cl && <div className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">At {fmtN(q!)} you pay {inr(cl.cost)}. At {fmtN(cl.nextQty)} you'd pay {inr(cl.nextCost)}, which is {inr(cl.saving)} less. Ask the vendor to switch to graduated slabs.</div>}
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">{q !== undefined ? inr(costFor(c, q)) : "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-zinc-600">Expected this month: <b>{inr(round(items.reduce((s, c) => s + (c.actualQty !== undefined ? costFor(c, c.actualQty) : 0), 0)))}</b> + GST</span>
                      <button onClick={() => setStep(3)} className="rounded bg-ink px-3 py-1.5 font-medium text-white">Next: check invoice →</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded border border-dashed border-zinc-300 bg-white px-2 py-1 hover:bg-paper">
                        Upload invoice (PDF / TXT)
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addInvoice(await fileToDoc(f)); e.target.value = ""; }} />
                      </label>
                      {sampleOf[v.id] && <button disabled={!!busy} onClick={() => addInvoice({ text: SAMPLES[sampleOf[v.id]].invoice })} className="rounded bg-cobalt px-2 py-1 font-medium text-white hover:bg-[#2148e0] disabled:opacity-50">Use sample invoice</button>}
                      <button disabled title="Coming soon" className="rounded bg-zinc-100 px-2 py-1 text-zinc-400">Fetch from email · soon</button>
                      {items.some((c) => c.actualQty === undefined) && <span className="text-amber-700">Tip: add verified usage in step 2 for a full check.</span>}
                    </div>

                    {v.invoice && check && (
                      <>
                        <div className="flex flex-wrap items-stretch gap-2">
                          <Stat label="Invoiced (pre-GST)" value={inr(v.invoice.subtotal)} />
                          <Stat label="Should be" value={inr(check.expectedSubtotal)} />
                          <Stat label="At risk (pre-GST)" value={inr(check.atRisk)} tone={check.atRisk > 0 ? "bad" : "good"} />
                          {gst && gst.taxAtRisk > 0 && <Stat label="+ GST on it" value={inr(gst.taxAtRisk)} tone="bad" />}
                          <div className="ml-auto flex items-center gap-2">
                            {v.status === "approved" ? (
                              <span className="rounded bg-ok-50 px-3 py-2 font-semibold text-cobalt">✓ Approved for payment</span>
                            ) : check.atRisk > 0 ? (
                              <>
                                <button onClick={runDispute} disabled={!!busy} className="rounded bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">Dispute {inr(check.atRisk)}</button>
                                <button onClick={() => update((x) => ({ ...x, status: "approved" }))} className="rounded border border-zinc-300 px-3 py-2 hover:bg-paper">Approve {inr(check.expectedSubtotal)}</button>
                              </>
                            ) : (
                              <button onClick={() => update((x) => ({ ...x, status: "approved" }))} className="rounded bg-cobalt px-3 py-2 font-semibold text-white">Approve {inr(v.invoice.total)}</button>
                            )}
                          </div>
                        </div>
                        <table className="w-full border-collapse overflow-hidden rounded-lg bg-white ring-1 ring-line">
                          <thead className="text-left text-[11px] uppercase tracking-wide text-slate bg-paper">
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
                                <td className="px-2 py-1.5 text-right">{l.actualQty !== null ? fmtN(l.actualQty) : "-"}</td>
                                <td className="px-2 py-1.5 text-right">{inr(l.invoicedAmount)}</td>
                                <td className="px-2 py-1.5 text-right">{l.expectedAmount !== null ? inr(l.expectedAmount) : "-"}</td>
                                <td className={`px-2 py-1.5 text-right font-semibold ${l.diff && l.diff > 0 ? "text-red-700" : "text-ok"}`}>{l.diff ? (l.diff > 0 ? "+" : "") + inr(l.diff) : "✓"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <MinCheck items={items} expected={check.expectedSubtotal} />
                        <GstPanel inv={v.invoice} buyer={org.gstin} base={check.expectedSubtotal} />
                      </>
                    )}

                    {verdict && (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded border border-zinc-200 bg-white p-2">
                          <div className="mb-1 font-semibold">Verdict: <span className={verdict.verdict === "Pay" ? "text-ok" : "text-red-700"}>{verdict.verdict}</span></div>
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
    <div className={`rounded border px-3 py-1.5 ${tone === "bad" ? "border-red-200 bg-red-50" : tone === "good" ? "border-cyan-200 bg-ok-50" : "border-zinc-200 bg-white"}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate bg-paper">{label}</div>
      <div className={`text-lg font-bold ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-ok" : ""}`}>{value}</div>
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
      <div className="mb-1 flex items-center gap-2 font-semibold">Market comparison <span className="text-[12px] font-normal text-slate">Rates from vendors on our network. Your data is never used for this.</span></div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(({ c, b, yours, saving }) => (
          <div key={c.id} className="rounded bg-paper px-2 py-1">
            <span className="font-medium">{c.name}</span>: you {inr(yours)} · best {inr(b.rate)} ({b.vendor})
            {b.rate < yours ? <span className="ml-1 text-ok">{saving ? `save ~${inr(saving)}/mo` : `${Math.round((1 - b.rate / yours) * 100)}% cheaper`}</span> : <span className="ml-1 text-zinc-500">you're at market</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GstPanel({ inv, buyer, base }: { inv: Invoice; buyer: string; base: number }) {
  const g = gstCheck(inv, buyer, base);
  const color = { ok: "text-ok", warn: "text-amber", risk: "text-risk" } as const;
  const mark = { ok: "✓", warn: "!", risk: "✕" } as const;
  return (
    <div className="rounded border border-line bg-white p-2">
      <div className="mb-1 flex items-center gap-2 font-semibold">GST check <span className="text-[11px] font-normal text-slate">On by default · computed by code</span></div>
      <ul className="grid gap-1 md:grid-cols-2">
        {g.findings.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span className={`font-mono font-bold ${color[f.level]}`}>{mark[f.level]}</span>
            <span><span className="font-medium">{f.title}</span> <span className="text-slate">{f.detail}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamPanel({ org, setOrg, onClose }: { org: Org; setOrg: (o: Org) => void; onClose: () => void }) {
  const [n, setN] = useState({ name: "", email: "", role: "Owner" as Role });
  const add = () => {
    if (!n.name || !/.+@.+/.test(n.email)) return;
    setOrg({ ...org, members: [...org.members, { id: Math.random().toString(36).slice(2, 8), ...n }] });
    setN({ name: "", email: "", role: "Owner" });
  };
  const included = org.plan === "Growth" ? 25 : 5;
  const extra = Math.max(0, org.members.length - included);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-auto bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <div>
            <div className="font-display text-lg font-semibold">{org.name}</div>
            <div className="text-slate">GSTIN {org.gstin || "not set"} · {org.plan} plan</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded px-2 py-1 text-slate hover:bg-paper" aria-label="Close">✕</button>
        </div>
        <div className="mt-3 rounded bg-paper px-2 py-1.5 text-slate">
          {org.members.length} of {included} users included{extra ? ` · ${extra} extra × $2/mo` : ""}
        </div>
        <ul className="mt-3 divide-y divide-line">
          {org.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-cobalt-50 text-[11px] font-semibold text-cobalt">{m.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.name}</div><div className="truncate text-[12px] text-slate">{m.email}</div></div>
              <select value={m.role} onChange={(e) => setOrg({ ...org, members: org.members.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Role } : x)) })} className="rounded border border-line px-1 py-1">
                {(Object.keys(ROLE_INFO) as Role[]).map((r) => <option key={r}>{r}</option>)}
              </select>
              {m.role !== "Admin" && <button onClick={() => setOrg({ ...org, members: org.members.filter((x) => x.id !== m.id) })} className="px-1 text-slate hover:text-risk" aria-label={`Remove ${m.name}`}>✕</button>}
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1.5 rounded border border-line p-2">
          <div className="font-medium">Invite a teammate</div>
          <input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="Name" className="w-full rounded border border-line px-2 py-1.5" />
          <input value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} placeholder="work@email.com" className="w-full rounded border border-line px-2 py-1.5" />
          <div className="flex gap-1.5">
            <select value={n.role} onChange={(e) => setN({ ...n, role: e.target.value as Role })} className="flex-1 rounded border border-line px-2 py-1.5">
              {(Object.keys(ROLE_INFO) as Role[]).map((r) => <option key={r}>{r}</option>)}
            </select>
            <button onClick={add} className="rounded bg-cobalt px-3 py-1.5 font-medium text-white">Send invite</button>
          </div>
          <div className="text-[11px] text-slate">Email invites are coming soon. For now, share the link with them.</div>
        </div>
        <div className="mt-3">
          <div className="mb-1 font-medium">Roles</div>
          {(Object.keys(ROLE_INFO) as Role[]).map((r) => <div key={r} className="text-slate"><span className="font-medium text-ink">{r}:</span> {ROLE_INFO[r]}</div>)}
        </div>
      </div>
    </div>
  );
}

function Negotiate({ list }: { list?: { type: string; item: string; ask: string; why: string }[] }) {
  if (!list?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="border-b border-line px-3 py-2 font-semibold">What you can negotiate</div>
      <div className="grid gap-px bg-line md:grid-cols-2">
        {list.map((n, i) => (
          <div key={i} className="bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-cobalt-50 px-1.5 py-0.5 font-mono text-[11px] text-cobalt">{n.type}</span>
              <span className="font-medium">{n.item}</span>
            </div>
            <div className="mt-1"><span className="text-slate">Ask for:</span> {n.ask}</div>
            <div className="text-[13px] text-slate">{n.why}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
