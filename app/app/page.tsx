"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Agreement, CostItem, Invoice, Vendor } from "@/lib/types";
import { checkInvoice, cliffInsight, cliffZones, costFor, fmtN, inr, round } from "@/lib/calc";
import { gstCheck } from "@/lib/gst";
import { parseCSV, applyRule, type UsageRule } from "@/lib/usage";
import { computeAlerts, monthLabel } from "@/lib/alerts";
import { DEMO_ORG, loadOrg, saveOrg, ROLE_INFO, type Org, type Role } from "@/lib/org";
import { Logo } from "@/components/Logo";
import Link from "next/link";

type Step = 1 | 2 | 3;
const STORE = "invoiceguard.v2";

const EVENT_LABEL: Record<string, string> = {
  sent: "Billed when sent",
  delivered: "Billed when delivered",
  attempted: "Billed per attempt",
  per_call: "Billed per API call",
  per_success: "Billed per success",
  per_month: "Fixed per month",
  unclear: "Billing event unclear",
};

async function fileToDoc(f: File): Promise<{ text?: string; pdfBase64?: string; docxBase64?: string }> {
  const name = f.name.toLowerCase();
  if (f.type === "application/pdf" || name.endsWith(".pdf") || name.endsWith(".docx")) {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return name.endsWith(".docx") ? { docxBase64: btoa(bin) } : { pdfBase64: btoa(bin) };
  }
  return { text: await f.text() };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await r.text();
  let j: { error?: string } & Record<string, unknown>;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error(r.status === 504 ? "This document took too long to read. Try again, or upload just the pricing pages." : "Something went wrong reading this document. Please try again.");
  }
  if (!r.ok || j.error) throw new Error(j.error || "Request failed");
  return j as unknown as T;
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
  const setVerdict = (_: null) => {};
  const [usageNotes, setUsageNotes] = useState<string[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
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
        setActiveId(s.vendors?.[0]?.id ?? null);
      }
    } catch {}
  }, []);
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) { loaded.current = true; return; }
    try {
      localStorage.setItem(STORE, JSON.stringify({ vendors }));
    } catch {}
  }, [vendors]);

  const v = vendors.find((x) => x.id === activeId) || null;
  const update = (fn: (v: Vendor) => Vendor) => setVendors((all) => all.map((x) => (x.id === activeId ? fn(x) : x)));
  const updateItem = (id: string, patch: Partial<CostItem>) =>
    update((x) => ({ ...x, agreement: { ...x.agreement, costItems: x.agreement.costItems.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }));

  async function addAgreement(doc: { text?: string; pdfBase64?: string }) {
    setErr(null);
    setBusy("Reading agreement and extracting every cost…");
    try {
      const a = await post<Agreement>("/api/agreement", doc);
      a.costItems = (a.costItems || []).map((c) => ({ ...c, questions: c.questions || [], sourceOfTruth: "manual" }));
      const id = Math.random().toString(36).slice(2, 9);
      setVendors((all) => [{ id, agreement: a, status: "setup" }, ...all]);
      setActiveId(id);
      setStep(1);
      setVerdict(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function importUsage(text: string) {
    if (!v) return;
    const rows = parseCSV(text);
    if (rows.length < 2) { setErr("That file has no rows."); return; }
    const [headers, ...data] = rows;
    setErr(null);
    setBusy("Claude is reading your usage file and working out how to count each charge…");
    try {
      const res = await post<{ rules: UsageRule[]; notes: string[] }>("/api/usage", {
        headers, sample: data.slice(0, 25), rowCount: data.length,
        costItems: v.agreement.costItems.filter((c) => c.pricing.mode !== "fixed").map((c) => ({ id: c.id, name: c.name, unit: c.unit, billingEvent: c.billingEvent, includes: c.includes, answers: c.questions.filter((q) => q.answer).map((q) => `${q.text} ${q.answer}`) })),
      });
      update((x) => ({ ...x, agreement: { ...x.agreement, costItems: x.agreement.costItems.map((c) => {
        const r = res.rules.find((r) => r.costItemId === c.id);
        return r ? { ...c, actualQty: applyRule(headers, data, r), usageRule: r.explanation, sourceNote: c.sourceNote || "Uploaded usage file" } : c;
      }) } }));
      setUsageNotes([`${fmtN(data.length)} rows read.`, ...(res.notes || [])]);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function saveMonth() {
    const m = monthLabel(new Date(Date.now()));
    update((x) => ({ ...x, agreement: { ...x.agreement, costItems: x.agreement.costItems.map((c) => ({
      ...c,
      history: [...(c.history || []).filter((h) => h.month !== m), { month: m, qty: c.pricing.mode === "fixed" ? undefined : c.actualQty, utilization: c.utilization, note: c.utilNote }],
    })) } }));
  }

  async function addInvoice(doc: { text?: string; pdfBase64?: string }) {
    if (!v) return;
    setErr(null);
    setBusy("Reading invoice and matching lines to the agreement…");
    try {
      const raw = await post<Invoice>("/api/invoice", { ...doc, costItems: v.agreement.costItems.map(({ id, name, unit }) => ({ id, name, unit })) });
      const num = (n: unknown) => Number(String(n ?? 0).replace(/[^0-9.-]/g, "")) || 0;
      const str = (t: unknown) => (t === null || t === undefined ? "" : String(t));
      const inv: Invoice = {
        vendor: str(raw.vendor), invoiceNo: str(raw.invoiceNo), date: str(raw.date),
        lines: (Array.isArray(raw.lines) ? raw.lines : []).map((l) => ({ description: str(l.description), costItemId: l.costItemId ? str(l.costItemId) : null, quantity: num(l.quantity), rate: num(l.rate), amount: num(l.amount) })),
        subtotal: num(raw.subtotal), tax: num(raw.tax), total: num(raw.total),
        supplierGstin: raw.supplierGstin ? str(raw.supplierGstin) : null, buyerGstin: raw.buyerGstin ? str(raw.buyerGstin) : null, sac: raw.sac ? str(raw.sac) : null,
        taxLines: (Array.isArray(raw.taxLines) ? raw.taxLines : []).map((t) => ({ type: (str(t.type).toUpperCase() as "IGST" | "CGST" | "SGST" | "GST"), ratePct: num(t.ratePct), amount: num(t.amount) })),
      };
      update((x) => ({ ...x, invoice: inv, status: "ready", verdict: undefined, history: x.invoice ? [...(x.history || []), { invoiceNo: x.invoice.invoiceNo, date: x.invoice.date, total: x.invoice.total, status: x.status }] : x.history }));
      setVerdict(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  const check = useMemo(() => (v?.invoice ? checkInvoice(v.invoice, v.agreement.costItems) : null), [v]);
  const missingUsage = check ? check.pending : 0;
  const [alerts, setAlerts] = useState<ReturnType<typeof computeAlerts>>([]);
  const [month, setMonth] = useState("");
  useEffect(() => {
    setAlerts(computeAlerts(vendors));
    setMonth(monthLabel());
  }, [vendors]);
  const dupInvoice = !!(v?.invoice && (v.history || []).some((h) => h.invoiceNo && h.invoiceNo === v.invoice!.invoiceNo));
  const gst = useMemo(() => (v?.invoice && check ? gstCheck(v.invoice, org.gstin, check.atRisk) : null), [v, check, org.gstin]);

  async function runDispute() {
    if (!v || !check) return;
    setBusy("Drafting the dispute with evidence…");
    try {
      const res = await post<Vendor["verdict"]>("/api/explain", {
        vendor: v.agreement.vendor,
        invoice: { no: v.invoice?.invoiceNo, date: v.invoice?.date },
        atRisk: check.atRisk,
        lines: check.lines,
        gstFindings: gst?.findings.filter((f) => f.level !== "ok"),
        gstChargedOnOverbilling: gst?.taxAtRisk,
        clauses: v.agreement.costItems.map((c) => ({ id: c.id, name: c.name, clause: c.clause, billingEvent: c.billingEvent, answers: c.questions.map((q) => `${q.text} → ${q.answer ?? "unanswered"}`) })),
      });
      update((x) => ({ ...x, status: "disputed", verdict: res || undefined }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
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
          
          <div className="relative">
            <button onClick={() => setBellOpen((b) => !b)} className="relative rounded-md border border-line p-1.5 hover:bg-paper" aria-label="Reminders">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" /></svg>
              {alerts.filter((a) => a.level !== "info").length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-risk px-1 text-[10px] font-semibold text-white">{alerts.filter((a) => a.level !== "info").length}</span>}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-40 mt-1 w-80 rounded-lg border border-line bg-white p-2 shadow-xl">
                <div className="px-1 pb-1 font-semibold">Reminders</div>
                {alerts.length === 0 ? <div className="px-1 py-2 text-slate">Nothing due. We'll remind you when an invoice is late, a payment is due or a dispute window is closing.</div> : alerts.map((a, i) => (
                  <button key={i} onClick={() => { setActiveId(a.vendorId); setBellOpen(false); }} className="flex w-full gap-2 rounded-md px-1 py-1.5 text-left hover:bg-paper">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.level === "risk" ? "bg-risk" : a.level === "warn" ? "bg-amber" : "bg-cobalt"}`} />
                    <span className="text-[13px]">{a.text}</span>
                  </button>
                ))}
                <div className="mt-1 border-t border-line px-1 pt-1.5 text-[11px] text-slate">Email and WhatsApp reminders are coming soon.</div>
              </div>
            )}
          </div>
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
            + Add vendor: upload agreement
            <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addAgreement(await fileToDoc(f)); e.target.value = ""; }} />
          </label>
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
                <div>PDF, Word or text. Your files are only used for your account.</div>
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
                    [3, v.invoice ? (check && check.atRisk > 0 ? `Invoice · ${inr(check.atRisk)} at risk` : missingUsage ? "Invoice · usage needed" : v.status === "approved" ? "Invoice ✓" : "Invoice") : "Invoice"],
                  ] as [Step, string][]).map(([s, label]) => (
                    <button key={s} onClick={() => setStep(s)} className={`rounded-md px-3 py-1.5 font-medium ${step === s ? "bg-ink text-white" : "text-slate hover:bg-paper hover:text-ink"}`}>
                      {s} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto"><Safe key={v.id + step + (v.invoice?.invoiceNo || "")}>
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
                                <div className="text-[11px] text-zinc-500">{c.category} · per {c.unit}{c.recurring === "one_time" ? " · one-time" : c.recurring === "on_request" ? " · only if used" : ""}</div>
                                {c.includes && c.includes.length > 0 && <details className="mt-0.5 text-[12px] text-slate"><summary className="cursor-pointer text-cobalt">Includes {c.includes.length} steps</summary><ul className="list-disc pl-4">{c.includes.map((x) => <li key={x}>{x}</li>)}</ul></details>}
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
                    {showCompare ? <Compare items={items} onQuote={(id, rate) => updateItem(id, { quoteRate: rate })} /> : (
                      <button onClick={() => setShowCompare(true)} className="rounded-lg border border-line bg-white px-3 py-2 font-medium hover:border-cobalt hover:text-cobalt">Compare with another vendor's quote</button>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => setStep(2)} className="rounded bg-ink px-3 py-1.5 font-medium text-white">Next: who verifies each cost →</button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        <div className="font-display text-[17px] font-semibold">Who checks what</div>
                        <p className="text-slate">One owner per charge, and the data they trust. Upload a usage export and Claude works out how to count it.</p>
                      </div>
                      <div className="ml-auto flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded-md bg-cobalt px-3 py-2 font-medium text-white hover:bg-[#2148e0]">
                          Import usage file (CSV)
                          <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importUsage(await f.text()); e.target.value = ""; }} />
                        </label>
                        <button onClick={saveMonth} className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:border-ink/40">Save {month} usage</button>
                      </div>
                    </div>
                    {usageNotes.length > 0 && <div className="rounded-lg border border-cobalt-100 bg-cobalt-50 px-3 py-2"><div className="font-medium text-cobalt">From your usage file</div><ul className="list-disc pl-4 text-ink-2">{usageNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
                    <datalist id="members">{org.members.filter((m) => m.role !== "Viewer").map((m) => <option key={m.id} value={m.name} />)}</datalist>
                    <div className="space-y-2">
                      {items.map((c) => {
                        const q = c.actualQty;
                        const cl = q !== undefined ? cliffInsight(c, q) : null;
                        const isFixed = c.pricing.mode === "fixed" || c.billingEvent === "per_month";
                        return (
                          <div key={c.id} className="grid gap-3 rounded-lg border border-line bg-white p-3 md:grid-cols-12">
                            <div className="md:col-span-3">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-[12px] text-slate">{EVENT_LABEL[c.billingEvent]} · {rateText(c)}</div>
                              {c.history && c.history.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">{c.history.slice(-4).map((h) => <span key={h.month} className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-slate">{h.month}: {h.qty !== undefined ? fmtN(h.qty) : ""}{h.utilization ? ` ${h.utilization}` : ""}</span>)}</div>
                              )}
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-[11px] font-medium uppercase tracking-wide text-slate">Owner</label>
                              <input list="members" value={c.owner || ""} onChange={(e) => updateItem(c.id, { owner: e.target.value })} placeholder="Pick a team member" className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5" />
                              <div className="mt-2 flex rounded-md bg-paper p-0.5 text-[13px]">
                                <button onClick={() => updateItem(c.id, { sourceOfTruth: "manual" })} className={`flex-1 rounded px-2 py-1 ${c.sourceOfTruth !== "api" ? "bg-white font-medium shadow-sm" : "text-slate"}`}>Report / file</button>
                                <button onClick={() => updateItem(c.id, { sourceOfTruth: "api" })} className={`flex-1 rounded px-2 py-1 ${c.sourceOfTruth === "api" ? "bg-white font-medium shadow-sm" : "text-slate"}`}>API</button>
                              </div>
                            </div>
                            <div className="md:col-span-3">
                              {c.sourceOfTruth === "api" ? (
                                <>
                                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate">API or system</label>
                                  <input value={c.sourceSystem || ""} onChange={(e) => updateItem(c.id, { sourceSystem: e.target.value })} placeholder="e.g. Signzy onboarding API logs" className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5" />
                                  <label className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate">Used in</label>
                                  <input value={c.usedIn || ""} onChange={(e) => updateItem(c.id, { usedIn: e.target.value })} placeholder="e.g. Investor onboarding, app + web" className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5" />
                                  <div className="mt-1 text-[11px] text-slate">Live API sync is being built. Until then the owner confirms the count.</div>
                                </>
                              ) : (
                                <>
                                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate">Where the number comes from</label>
                                  <input value={c.sourceNote || ""} onChange={(e) => updateItem(c.id, { sourceNote: e.target.value })} placeholder="e.g. vendor dashboard export" className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5" />
                                  <label className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate">Used in</label>
                                  <input value={c.usedIn || ""} onChange={(e) => updateItem(c.id, { usedIn: e.target.value })} placeholder="Which product or team uses this" className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5" />
                                </>
                              )}
                            </div>
                            <div className="md:col-span-3">
                              {isFixed ? (
                                <>
                                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate">Is it being used?</label>
                                  <div className="mt-0.5 flex gap-1">
                                    {([["full", "Fully"], ["partial", "Partly"], ["unused", "Not used"]] as const).map(([k, l]) => (
                                      <button key={k} onClick={() => updateItem(c.id, { utilization: k })} className={`flex-1 rounded-md border px-2 py-1.5 text-[13px] ${c.utilization === k ? (k === "unused" ? "border-risk bg-risk-50 text-risk" : "border-cobalt bg-cobalt-50 text-cobalt") : "border-line"}`}>{l}</button>
                                    ))}
                                  </div>
                                  <input value={c.utilNote || ""} onChange={(e) => updateItem(c.id, { utilNote: e.target.value })} placeholder="Note, e.g. only 3 of 10 seats active" className="mt-1.5 w-full rounded-md border border-line px-2 py-1.5 text-[13px]" />
                                  {(c.history || []).filter((h) => h.utilization === "unused" || h.utilization === "partial").length >= 2 && <div className="mt-1 text-[12px] text-amber">Not fully used for {(c.history || []).filter((h) => h.utilization !== "full").length} months. Worth renegotiating or cancelling.</div>}
                                </>
                              ) : (
                                <>
                                  <label className="text-[11px] font-medium uppercase tracking-wide text-slate">Confirmed usage this month</label>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <input type="number" value={q ?? ""} onChange={(e) => updateItem(c.id, { actualQty: e.target.value === "" ? undefined : Number(e.target.value), usageRule: undefined })} placeholder={c.unit} className="w-full rounded-md border border-line px-2 py-1.5" />
                                    <span className="tnum whitespace-nowrap font-semibold">{q !== undefined ? inr(costFor(c, q)) : ""}</span>
                                  </div>
                                  {c.usageRule && <div className="mt-1 text-[11px] text-slate">Counted from file: {c.usageRule}</div>}
                                  {cl && <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber">At {fmtN(q!)} you pay {inr(cl.cost)}. At {fmtN(cl.nextQty)} you'd pay {inr(cl.nextCost)}. Ask for graduated slabs.</div>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-slate">Expected this month <b className="tnum text-ink">{inr(round(items.filter((c) => c.recurring !== "one_time" && c.recurring !== "on_request").reduce((s, c) => s + (c.pricing.mode === "fixed" ? costFor(c, 1) : c.actualQty !== undefined ? costFor(c, c.actualQty) : 0), 0)))}</b> + GST</span>
                      <button onClick={() => setStep(3)} className="rounded-md bg-ink px-3 py-2 font-medium text-white">Check the invoice</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-md bg-cobalt px-3 py-2 font-medium text-white hover:bg-[#2148e0]">
                        {v.invoice ? "Upload next invoice" : "Upload invoice"}
                        <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) addInvoice(await fileToDoc(f)); e.target.value = ""; }} />
                      </label>
                      <span className="text-slate">PDF, Word or text. Invoices from email are coming soon.</span>
                    </div>

                    {v.invoice && check && (
                      <>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate">
                          <span className="font-medium text-ink">Invoice {v.invoice.invoiceNo}</span>
                          <span>{v.invoice.date}</span>
                          {dupInvoice && <span className="rounded bg-risk-50 px-1.5 py-0.5 text-risk">Same invoice number was already checked</span>}
                        </div>
                        <TermsStrip terms={v.agreement.keyTerms} invoiceDate={v.invoice.date} />
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                          <Stat label="Billed, before GST" value={inr(v.invoice.subtotal)} />
                          <Stat label="Confirmed by you" value={inr(check.expectedSubtotal)} />
                          <Stat label="Overbilled" value={inr(check.atRisk)} tone={check.atRisk > 0 ? "bad" : "good"} sub={gst && gst.taxAtRisk > 0 ? `+ ${inr(gst.taxAtRisk)} GST` : undefined} />
                          <Stat label="Not in agreement" value={inr(check.unmatched)} tone={check.unmatched > 0 ? "warn" : undefined} sub={check.unmatched > 0 ? "Review before paying" : undefined} />
                          <Stat label="Waiting for usage" value={`${check.pending} line${check.pending === 1 ? "" : "s"}`} tone={check.pending > 0 ? "warn" : undefined} />
                        </div>
                        <div className="overflow-hidden rounded-lg border border-line bg-white">
                          <table className="w-full border-collapse">
                            <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-slate">
                              <tr>
                                <th className="px-3 py-2">Charge</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Billed qty</th>
                                <th className="px-3 py-2 text-right">Confirmed</th>
                                <th className="px-3 py-2 text-right">Billed</th>
                                <th className="px-3 py-2 text-right">Should be</th>
                                <th className="px-3 py-2 text-right">Difference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {check.lines.map((l, i) => {
                                const item = items.find((c) => c.id === l.costItemId);
                                const cl = item ? cliffInsight(item, l.invoicedQty) : null;
                                return (
                                  <tr key={i} className="border-t border-line align-top">
                                    <td className="px-3 py-2">
                                      <div className="font-medium">{l.description}</div>
                                      {l.flags.map((f, j) => <div key={j} className="text-[12px] text-slate">{f}</div>)}
                                      {cl && <div className="text-[12px] text-amber">Slab: {fmtN(l.invoicedQty)} units cost {inr(cl.cost)}. At {fmtN(cl.nextQty)} it would be {inr(cl.nextCost)}.</div>}
                                    </td>
                                    <td className="px-3 py-2"><StatusPill s={l.status} /></td>
                                    <td className="tnum px-3 py-2 text-right">{fmtN(l.invoicedQty)}</td>
                                    <td className="tnum px-3 py-2 text-right">{l.actualQty !== null ? fmtN(l.actualQty) : "-"}</td>
                                    <td className="tnum px-3 py-2 text-right">{inr(l.invoicedAmount)}</td>
                                    <td className="tnum px-3 py-2 text-right">{l.expectedAmount !== null ? inr(l.expectedAmount) : "-"}</td>
                                    <td className={`tnum px-3 py-2 text-right font-semibold ${l.status === "discrepancy" && (l.diff ?? 0) > 0 ? "text-risk" : "text-slate"}`}>{l.diff !== null && l.diff !== 0 ? (l.diff > 0 ? "+" : "") + inr(l.diff) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <GstPanel inv={v.invoice} buyer={org.gstin} overbilled={check.atRisk} />
                        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-line bg-white p-3">
                          {v.status === "approved" ? (
                            <span className="rounded-md bg-ok-50 px-3 py-2 font-semibold text-ok">Approved for payment</span>
                          ) : (
                            <>
                              <span className="mr-auto text-slate">
                                {check.atRisk > 0 ? "Some charges don't match the agreement or your usage." : check.pending > 0 ? "Rates match. Confirm usage before approving." : check.unmatched > 0 ? "Some charges aren't in the agreement. Check if they were approved separately." : "Everything matches the agreement and your usage."}
                              </span>
                              {check.pending > 0 && <button onClick={() => setStep(2)} className="rounded-md border border-line px-3 py-2 font-medium hover:border-ink/40">Confirm usage</button>}
                              {(check.atRisk > 0 || check.unmatched > 0) && <button onClick={runDispute} disabled={!!busy} className="rounded-md bg-risk px-3 py-2 font-semibold text-white disabled:opacity-50">Draft dispute email</button>}
                              <button disabled={check.pending > 0} onClick={() => update((x) => ({ ...x, status: "approved" }))} className={`rounded-md px-3 py-2 font-semibold ${check.atRisk > 0 || check.unmatched > 0 ? "border border-line" : "bg-cobalt text-white"} disabled:opacity-40`}>
                                Approve {inr(check.atRisk > 0 ? check.expectedSubtotal : v.invoice.subtotal)} + GST
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {v.verdict && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-line bg-white p-3">
                          <div className="mb-1 font-semibold">Recommendation: <span className={v.verdict.verdict === "Pay" ? "text-ok" : "text-risk"}>{v.verdict.verdict}</span></div>
                          <ul className="list-disc space-y-0.5 pl-4 text-ink-2">{v.verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                        <div className="rounded-lg border border-line bg-white p-3">
                          <div className="mb-1 flex items-center font-semibold">Dispute email
                            <button onClick={() => navigator.clipboard?.writeText(`Subject: ${v.verdict!.email.subject}\n\n${v.verdict!.email.body}`)} className="ml-auto rounded-md border border-line px-2 py-0.5 text-[12px] font-normal">Copy</button>
                          </div>
                          <div className="text-[13px] font-medium">Subject: {v.verdict.email.subject}</div>
                          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-[13px] text-ink-2">{v.verdict.email.body}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Safe></div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

class Safe extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() { return this.state.err ? <div className="m-4 rounded-lg bg-risk-50 p-3 text-risk">Something in this view failed to display ({this.state.err}). Try uploading the file again.</div> : this.props.children; }
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "bad" | "warn"; sub?: string }) {
  const t = tone === "bad" ? "border-risk/30 bg-risk-50" : tone === "warn" ? "border-amber/30 bg-amber-50" : tone === "good" ? "border-ok/30 bg-ok-50" : "border-line bg-white";
  const c = tone === "bad" ? "text-risk" : tone === "warn" ? "text-amber" : tone === "good" ? "text-ok" : "text-ink";
  return (
    <div className={`rounded-lg border px-3 py-2 ${t}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate">{label}</div>
      <div className={`tnum font-display text-xl font-semibold ${c}`}>{value}</div>
      {sub && <div className={`text-[12px] ${c}`}>{sub}</div>}
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const m: Record<string, [string, string]> = {
    verified: ["Matches", "bg-ok-50 text-ok"],
    fixed: ["Fixed fee OK", "bg-ok-50 text-ok"],
    discrepancy: ["Doesn't match", "bg-risk-50 text-risk"],
    pending: ["Waiting for usage", "bg-amber-50 text-amber"],
    unmatched: ["Not in agreement", "bg-amber-50 text-amber"],
  };
  const [t, c] = m[s] || [s, "bg-paper"];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${c}`}>{t}</span>;
}

function TermsStrip({ terms, invoiceDate }: { terms?: Agreement["keyTerms"]; invoiceDate?: string }) {
  if (!terms?.length) return null;
  const d = invoiceDate ? new Date(invoiceDate) : null;
  const plus = (n?: number | null) => (d && n ? new Date(d.getTime() + n * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null);
  const show = terms.filter((t) => ["payment", "dispute", "penalty", "free_period", "billing_start"].includes(t.kind));
  if (!show.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {show.map((t, i) => (
        <div key={i} className={`rounded-lg border px-3 py-1.5 text-[13px] ${t.kind === "penalty" ? "border-risk/30 bg-risk-50" : "border-line bg-white"}`}>
          <span className="font-medium">{t.label}</span>
          {(t.kind === "payment" || t.kind === "dispute") && plus(t.days) ? <span className="text-slate">: by {plus(t.days)}</span> : <span className="text-slate">: {t.detail}</span>}
        </div>
      ))}
    </div>
  );
}


function Compare({ items, onQuote }: { items: CostItem[]; onQuote: (id: string, rate: number | undefined) => void }) {
  const rows = items.filter((c) => c.pricing.mode !== "fixed" && c.pricing.slabs?.length && c.recurring !== "one_time");
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="font-semibold">Compare with another quote</div>
      <div className="mb-2 text-[13px] text-slate">Enter a rate another vendor has quoted you. We'll show the monthly difference using your confirmed usage.</div>
      <div className="space-y-1.5">
        {rows.map((c) => {
          const yours = c.pricing.slabs[0].rate;
          const q = c.quoteRate;
          const qty = c.actualQty;
          const diff = q !== undefined && qty ? round(costFor(c, qty) - qty * q) : null;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-40 font-medium">{c.name}</span>
              <span className="text-slate">you pay {inr(yours)}</span>
              <input type="number" step="0.01" value={q ?? ""} onChange={(e) => onQuote(c.id, e.target.value === "" ? undefined : Number(e.target.value))} placeholder="Other quote ₹" className="w-32 rounded border border-line px-2 py-1" />
              {q !== undefined && (diff !== null ? <span className={diff > 0 ? "text-ok" : "text-slate"}>{diff > 0 ? `You'd save ${inr(diff)} a month` : "No saving at your usage"}</span> : <span className="text-slate">Add usage in step 2 to see the monthly difference</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GstPanel({ inv, buyer, overbilled }: { inv: Invoice; buyer: string; overbilled: number }) {
  const g = gstCheck(inv, buyer, overbilled);
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
  const included = org.plan === "Free" ? 3 : 5;
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
          {org.members.length} of {included} users included{extra ? ` · ${extra} extra × ₹99 a month` : ""}
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
