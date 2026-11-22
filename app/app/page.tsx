"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Agreement, CostItem, Invoice, Vendor, PointStatus } from "@/lib/types";
import { checkInvoice, cliffInsight, cliffZones, costFor, fmtN, inr, round, slabIssue } from "@/lib/calc";
import { gstCheck } from "@/lib/gst";
import { parseCSV, applyRule, validateRule, distinctValues, type UsageRule } from "@/lib/usage";
import { computeAlerts, monthLabel } from "@/lib/alerts";
import { DEMO_ORG, DEFAULT_CHECKLIST, loadOrg, saveOrg, ROLE_INFO, type Org, type Role } from "@/lib/org";
import { Logo } from "@/components/Logo";
import { fileToDoc, type Doc } from "@/lib/files";
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


async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await r.text();
  let j: { error?: string } & Record<string, unknown>;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error(r.status === 504 ? "This document took too long to read. Try again, or upload just the pricing pages." : r.status === 413 ? "This file is too large to send. Try a smaller PDF or just the pricing pages." : `Something went wrong reading this document (error ${r.status}). Please try again.`);
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
  const [usageNotes, setUsageNotes] = useState<string[]>([]);
  const [stage, setStage] = useState("");
  const [checklist, setChecklist] = useState<string[]>(DEFAULT_CHECKLIST);
  useEffect(() => { try { const c = localStorage.getItem("invoiceguard.checklist"); if (c) setChecklist(JSON.parse(c)); } catch {} }, []);
  const saveChecklist = (c: string[]) => { setChecklist(c); try { localStorage.setItem("invoiceguard.checklist", JSON.stringify(c)); } catch {} };
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

  async function addAgreement(doc: Doc) {
    setErr(null);
    setBusy("Reading agreement and extracting every cost…");
    try {
      const a = await post<Agreement>("/api/agreement", { ...doc, checklist });
      a.costItems = (a.costItems || []).map((c) => ({ ...c, questions: c.questions || [], sourceOfTruth: "manual" }));
      const id = Math.random().toString(36).slice(2, 9);
      setVendors((all) => [{ id, agreement: a, status: "setup" }, ...all]);
      setActiveId(id);
      setStep(1);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function importUsage(text: string, fileName = "usage file") {
    if (!v) return;
    const rows = parseCSV(text);
    if (rows.length < 2) { setErr("That file has no rows."); return; }
    const [headers, ...data] = rows;
    setErr(null);
    setBusy("Reading your usage file and working out how to count each charge…");
    try {
      const res = await post<{ rules: UsageRule[]; notes: string[] }>("/api/usage", {
        headers, sample: data.slice(0, 25), rowCount: data.length,
        distinct: Object.fromEntries(headers.map((h) => [h, distinctValues(headers, data, h)]).filter(([, v]) => (v as string[]).length > 0 && (v as string[]).length < 12)),
        costItems: v.agreement.costItems.filter((c) => c.pricing.mode !== "fixed").map((c) => ({ id: c.id, name: c.name, unit: c.unit, billingEvent: c.billingEvent, includes: c.includes, answers: c.questions.filter((q) => q.answer).map((q) => `${q.text} ${q.answer}`) })),
      });
      update((x) => ({ ...x, agreement: { ...x.agreement, costItems: x.agreement.costItems.map((c) => {
        const r = res.rules.find((r) => r.costItemId === c.id);
        if (!r) return c;
        const bad = validateRule(headers, r);
        if (bad) return { ...c, usageRule: `Not counted: ${bad}. Enter the number manually.` };
        const n = applyRule(headers, data, r);
        const where = r.filters.map((f) => `${f.column} ${f.op.replace("_", " ")} ${f.values.join("/")}`).join(", ");
        return { ...c, actualQty: n, usageRule: `${fmtN(n)} of ${fmtN(data.length)} rows${where ? ` where ${where}` : ""} (${fileName}, imported ${new Date().toLocaleDateString("en-IN")}). ${r.explanation} Check and edit if needed.`, sourceNote: c.sourceNote || "Uploaded usage file" };
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

  async function replaceAgreement(doc: Doc) {
    if (!v) return;
    setErr(null);
    setBusy("Reading the final agreement and carrying over your settings…");
    try {
      const a = await post<Agreement>("/api/agreement", { ...doc, checklist });
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      a.costItems = (a.costItems || []).map((c) => {
        const old = v.agreement.costItems.find((o) => norm(o.name) === norm(c.name) || o.id === c.id);
        return { ...c, questions: c.questions || [], sourceOfTruth: old?.sourceOfTruth || "manual", owner: old?.owner, sourceNote: old?.sourceNote, sourceSystem: old?.sourceSystem, usedIn: old?.usedIn, history: old?.history, utilization: old?.utilization, utilNote: old?.utilNote };
      });
      const today = new Date().toLocaleDateString("en-IN");
      update((x) => ({ ...x, agreement: a, pointState: {}, agreementVersions: [...(x.agreementVersions || [{ label: "First upload", date: "" }]), { label: "Final agreed version", date: today }] }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function addInvoice(doc: Doc) {
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
      update((x) => ({ ...x, invoice: inv, status: "ready", verdict: undefined, history: x.invoice ? [...(x.history || []), { invoiceNo: x.invoice.invoiceNo, date: x.invoice.date, total: x.invoice.total, status: x.status, gstin: x.invoice.supplierGstin }] : x.history }));
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
  const dupInvoice = !!(v?.invoice && (v.history || []).some((h) => (h.invoiceNo && h.invoiceNo === v.invoice!.invoiceNo) || (h.total === v.invoice!.total && h.date === v.invoice!.date && (h.gstin || "") === (v.invoice!.supplierGstin || ""))));
  const gst = useMemo(() => (v?.invoice && check ? gstCheck(v.invoice, org.gstin, check.atRisk) : null), [v, check, org.gstin]);




  const items = v?.agreement.costItems || [];
  const openQs = items.flatMap((c) => c.questions).filter((q) => !q.answer).length;
  const setupDone = items.filter((c) => c.owner && c.actualQty !== undefined).length;
  const notStated = items.flatMap((c) => c.questions.filter((q) => q.answer && /not stated/i.test(q.answer)).map((q) => ({ item: c.name, q: q.text })));

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4efe6] text-[14px] text-ink md:h-dvh">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
        <Link href="/" aria-label="Home"><Logo /></Link>
        
        <div className="ml-auto flex items-center gap-2">
          
          <div className="relative">
            <button onClick={() => setBellOpen((b) => !b)} className="relative rounded-md border border-line p-1.5 hover:bg-paper" aria-label="Reminders">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" /></svg>
              {alerts.filter((a) => a.level !== "info").length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-risk px-1 text-[10px] font-semibold text-white">{alerts.filter((a) => a.level !== "info").length}</span>}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-40 mt-1 w-80 rounded-2xl border border-line bg-white p-2 shadow-xl">
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
            <span className="hidden max-w-[140px] truncate font-medium sm:inline">{org.name}</span>
            <span className="text-slate">· Team {org.members.length}</span>
          </button>
        </div>
      </header>
      {welcome && <div className="shrink-0 bg-cobalt-50 px-3 py-1.5 text-cobalt">Welcome, {org.members[0]?.name}! Your company is set up. Invite your team from the top right, then upload your first agreement. <button className="underline" onClick={() => setWelcome(false)}>Got it</button></div>}
      {teamOpen && <TeamPanel org={org} setOrg={(o) => { setOrg(o); saveOrg(o); }} onClose={() => setTeamOpen(false)} />}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* vendor rail */}
        <aside className="flex shrink-0 flex-col gap-1 bg-[#17140f] p-3 text-white md:w-64">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-3 py-2.5 font-medium text-black hover:bg-white/90">
            <span className="text-lg leading-none">+</span> Add vendor
            <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setStage(f.name); addAgreement(await fileToDoc(f)); } catch (x) { setErr(String(x)); } }} />
          </label>
          <div className="px-1 pb-1 text-center text-[11px] text-white/50">Agreement as PDF, Word, scan or photo</div>
          <button onClick={() => setActiveId(null)} className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium ${activeId === null ? "bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" /></svg> Dashboard
          </button>
          <div className="mt-3 px-2.5 text-[11px] font-medium uppercase tracking-wider text-white/40">Vendors · {vendors.length}</div>
          <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {vendors.map((x) => {
              const ch = x.invoice ? checkInvoice(x.invoice, x.agreement.costItems) : null;
              const dot = x.status === "approved" ? "bg-ok" : x.status === "disputed" || (ch && ch.atRisk > 0) ? "bg-risk" : ch && ch.pending ? "bg-amber" : "bg-white/30";
              const sub = x.status === "approved" ? "Approved" : x.status === "disputed" ? "Disputed" : ch && ch.atRisk > 0 ? `${inr(ch.atRisk)} overbilled` : ch && ch.pending ? "Waiting for usage" : x.invoice ? "To review" : `${x.agreement.costItems.length} charges · no invoice`;
              return (
                <button key={x.id} onClick={() => setActiveId(x.id)} className={`flex shrink-0 items-start gap-2 rounded-lg px-2.5 py-2 text-left ${x.id === activeId ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="min-w-0"><span className="block truncate font-medium">{x.agreement.vendor}</span><span className="block text-[12px] text-white/55">{sub}</span></span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto hidden rounded-lg border border-white/10 p-2.5 text-[12px] text-white/55 md:block">
            <div className="mb-1 font-medium text-white/80">Coming soon</div>
            Invoices picked up from your email · usage from vendor APIs · Tally export
          </div>
        </aside>

        {/* workspace */}
        <main className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
          {busy && <Reading label={busy} file={stage} />}
          {err && <div className="shrink-0 bg-red-50 px-3 py-1.5 text-red-700">{err} <button className="underline" onClick={() => setErr(null)}>dismiss</button></div>}

          {!v ? (
            <Dashboard vendors={vendors} open={(id) => { setActiveId(id); setStep(3); }} setDispute={(vid, idx, status) => setVendors((all) => all.map((x) => x.id === vid ? { ...x, disputes: (x.disputes || []).map((d, k) => k === idx ? { ...d, status } : d) } : x))} remove={(id) => setVendors((all) => all.filter((x) => x.id !== id))} />
          ) : (
            <>
              {/* vendor header + stepper */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-200 bg-white px-3 py-1.5">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-black font-serif text-sm font-bold text-white">{v.agreement.vendor.slice(0, 1)}</span><span className="font-serif text-[24px] leading-none">{v.agreement.vendor}</span></div>
                <div className="text-zinc-500">{v.agreement.service} · {v.agreement.period}</div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-paper px-2 py-0.5 text-slate">{(v.agreementVersions || []).length > 1 ? `Using: ${v.agreementVersions![v.agreementVersions!.length - 1].label} (${v.agreementVersions![v.agreementVersions!.length - 1].date})` : "Using: first upload"}</span>
                  <label className="cursor-pointer font-medium text-cobalt hover:underline">Upload final agreed agreement
                    <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setStage(f.name); replaceAgreement(await fileToDoc(f)); } catch (x) { setErr(String(x)); } }} />
                  </label>
                </div>
                <div className="ml-auto flex overflow-hidden rounded-2xl border border-line bg-white p-0.5">
                  {([
                    [1, `Understand${openQs ? ` · ${openQs} to answer` : " ✓"}`],
                    [2, `Who checks ${setupDone}/${items.length}`],
                    [3, v.invoice ? (check && check.atRisk > 0 ? `Invoice · ${inr(check.atRisk)} at risk` : missingUsage ? "Invoice · usage needed" : v.status === "approved" ? "Invoice ✓" : "Invoice") : "Invoice"],
                  ] as [Step, string][]).map(([s, label]) => (
                    <button key={s} onClick={() => setStep(s)} className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${step === s ? "bg-black text-white" : "text-slate hover:bg-paper hover:text-ink"}`}>
                      {s} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto"><Safe key={v.id + step + (v.invoice?.invoiceNo || "")}>
                {step === 1 && (
                  <div className="space-y-4 p-5">
                    <div className="rounded-2xl border border-line bg-white p-5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate">In plain words</div>
                      <p className="mt-1.5 max-w-4xl font-serif text-[21px] leading-snug text-ink">{v.agreement.summary}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {[
                          [String(items.length), "charges found"],
                          [String((v.agreement.liabilities || []).filter((l) => l.severity === "high").length), "high liabilities"],
                          [String(openQs), "questions to answer"],
                          [String((v.agreement.checklist || []).filter((c) => c.status !== "found").length), "checklist gaps"],
                        ].map(([n, l]) => (
                          <div key={l} className="rounded-xl bg-paper px-3 py-2"><div className="font-serif text-[28px] leading-none">{n}</div><div className="mt-1 text-[12px] text-slate">{l}</div></div>
                        ))}
                      </div>
                    </div>
                    {(v.agreement.risks?.length > 0 || notStated.length > 0) && (
                      <div className="rounded-2xl border border-line bg-white">
                        <div className="border-b border-line px-4 py-2.5 font-semibold">Watch out for</div>
                        <ul className="grid gap-px bg-line md:grid-cols-2">
                          {v.agreement.risks?.map((r, i) => <li key={i} className="flex gap-2.5 bg-white px-4 py-3 text-[13px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />{r}</li>)}
                          {notStated.map((n, i) => <li key={"n" + i} className="flex gap-2.5 bg-white px-4 py-3 text-[13px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sun" />You marked “{n.q}” as not stated for {n.item}.</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="px-1 pt-1 font-serif text-[22px]">Charges</div>
                    <table className="w-full border-collapse overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-slate bg-paper">
                        <tr className="border-b border-zinc-200">
                          <th className="px-3 py-2">Cost item</th>
                          <th className="px-3 py-2">When you are charged</th>
                          <th className="px-3 py-2">Rate</th>
                          <th className="hidden px-3 py-2 lg:table-cell">Agreement clause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((c) => {
                          const zones = cliffZones(c);
                          return (
                            <tr key={c.id} className="border-b border-zinc-100 align-top">
                              <td className="px-3 py-3">
                                <div className="font-medium">{c.name}</div>
                                <div className="text-[11px] text-zinc-500">{c.category} · per {c.unit}{c.recurring === "one_time" ? " · one-time" : c.recurring === "on_request" ? " · only if used" : ""}</div>
                                {c.includes && c.includes.length > 0 && <details className="mt-0.5 text-[12px] text-slate"><summary className="cursor-pointer text-cobalt">Includes {c.includes.length} steps</summary><ul className="list-disc pl-4">{c.includes.map((x) => <li key={x}>{x}</li>)}</ul></details>}
                              </td>
                              <td className="px-3 py-3">
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
                              <td className="px-3 py-3">
                                <div>{rateText(c)}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {c.pricing.mode === "volume" ? "Volume: one rate on all units" : c.pricing.mode === "graduated" ? "Graduated: rate per band" : ""}
                                  {c.freeUnits ? ` · ${fmtN(c.freeUnits)} free` : ""}
                                  {c.minCommitment ? ` · min ${inr(c.minCommitment)}` : ""}
                                </div>
                                {slabIssue(c) && <div className="mt-1 rounded bg-risk-50 px-1.5 py-0.5 text-[11px] text-risk">Slab table needs checking: {slabIssue(c)}</div>}
                                {zones.map((z, i) => (
                                  <div key={i} className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">
                                    Slab trap: between {fmtN(z.start)} and {fmtN(z.slabStart - 1)} units you pay more than at {fmtN(z.slabStart)}.
                                  </div>
                                ))}
                              </td>
                              <td className="hidden max-w-xs px-3 py-3 text-[12px] text-zinc-500 lg:table-cell">{c.clause}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <Liabilities list={v.agreement.liabilities} />
                    <Checklist result={v.agreement.checklist} list={checklist} save={saveChecklist} />
                    <Negotiate list={v.agreement.negotiate} />
                    <AgreementEmail a={v.agreement} state={v.pointState || {}} company={org.name} setState={(k, val) => update((x) => ({ ...x, pointState: { ...(x.pointState || {}), [k]: val } }))} />
                    {showCompare ? <Compare items={items} onQuote={(id, rate) => updateItem(id, { quoteRate: rate })} /> : (
                      <button onClick={() => setShowCompare(true)} className="rounded-2xl border border-line bg-white px-3 py-2 font-medium hover:border-cobalt hover:text-cobalt">Compare with another vendor's quote</button>
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
                        <div className="font-serif text-[26px] leading-none">Who checks what</div>
                        <p className="text-slate">One owner per charge, and the data they trust. Upload a usage export and we work out how to count it.</p>
                      </div>
                      <div className="ml-auto flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded-md bg-black px-4 py-2 font-medium text-white hover:bg-black/85">
                          Import usage file (CSV or Excel)
                          <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={async (e) => {
                            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                            try {
                              if (/\.xlsx?$/i.test(f.name)) {
                                const XLSX = await import("xlsx");
                                const wb = XLSX.read(await f.arrayBuffer());
                                importUsage(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]), f.name);
                              } else importUsage(await f.text(), f.name);
                            } catch (x) { setErr("Couldn't read that file: " + String(x)); }
                          }} />
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
                          <div key={c.id} className="grid gap-3 rounded-2xl border border-line bg-white p-3 md:grid-cols-12">
                            <div className="md:col-span-3">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-[12px] text-slate">{EVENT_LABEL[c.billingEvent]} · {rateText(c)}</div>
                              {c.history && c.history.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">{c.history.slice(-4).map((h) => <span key={h.month} className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-slate">{h.month}: {h.qty !== undefined ? fmtN(h.qty) : ""}{h.utilization ? ` ${h.utilization}` : ""}</span>)}</div>
                              )}
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-[11px] font-medium uppercase tracking-wide text-slate">Owner</label>
                              <select value={c.owner || ""} onChange={(e) => { if (e.target.value === "__invite") { setTeamOpen(true); return; } updateItem(c.id, { owner: e.target.value }); }} className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5">
                                <option value="">Choose owner…</option>
                                {org.members.filter((m) => m.role !== "Viewer").map((m) => <option key={m.id} value={m.name}>{m.name}{m.id === "u1" ? " (you)" : ""}</option>)}
                                <option value="__invite">+ Invite a teammate…</option>
                              </select>
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
                      <label className="cursor-pointer rounded-md bg-black px-4 py-2 font-medium text-white hover:bg-black/85">
                        {v.invoice ? "Upload next invoice" : "Upload invoice"}
                        <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setStage(f.name); addInvoice(await fileToDoc(f)); } catch (x) { setErr(String(x)); } }} />
                      </label>
                      <span className="text-slate">PDF, Word or text. Invoices from email are coming soon.</span>
                    </div>

                    {v.invoice && check && (
                      <>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate">
                          <span className="font-medium text-ink">Invoice {v.invoice.invoiceNo}</span>
                          <span>{v.invoice.date}</span>
                          {dupInvoice && <span className="rounded bg-risk-50 px-1.5 py-0.5 text-risk">Possible duplicate: same number, or same vendor, date and amount as an earlier invoice</span>}
                        </div>
                        {(v.disputes || []).filter((d) => d.invoiceNo !== v.invoice!.invoiceNo).length > 0 && (
                          <div className="rounded-2xl border border-line bg-white px-3 py-2 text-[13px]"><span className="font-medium">Past disputes with this vendor: </span>{(v.disputes || []).filter((d) => d.invoiceNo !== v.invoice!.invoiceNo).map((d) => `${d.invoiceNo} (${inr(d.amount)}, ${DISPUTE_LABEL[d.status]})`).join(" · ")}</div>
                        )}
                        <TermsStrip terms={v.agreement.keyTerms} invoiceDate={v.invoice.date} />
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                          <Stat label="Billed, before GST" value={inr(v.invoice.subtotal)} />
                          <Stat label="Confirmed by you" value={inr(check.expectedSubtotal)} />
                          <Stat label="Overbilled" value={inr(check.atRisk)} tone={check.atRisk > 0 ? "bad" : "good"} sub={gst && gst.taxAtRisk > 0 ? `+ ${inr(gst.taxAtRisk)} GST` : undefined} />
                          <Stat label="Not in agreement" value={inr(check.unmatched)} tone={check.unmatched > 0 ? "warn" : undefined} sub={check.unmatched > 0 ? "Review before paying" : undefined} />
                          <Stat label="Waiting for usage" value={`${check.pending} line${check.pending === 1 ? "" : "s"}`} tone={check.pending > 0 ? "warn" : undefined} />
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
                                    <td className="tnum px-3 py-2 text-right">
                                      {item && item.pricing.mode !== "fixed" && item.billingEvent !== "per_month" ? (
                                        <div className="flex flex-col items-end gap-1">
                                          <input type="number" value={item.actualQty ?? ""} onChange={(e) => updateItem(item.id, { actualQty: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Enter" className="w-24 rounded-md border border-line px-2 py-1 text-right" />
                                          {item.actualQty === undefined && <button onClick={() => updateItem(item.id, { actualQty: l.invoicedQty, sourceNote: item.sourceNote || "Confirmed same as invoice" })} className="text-[11px] font-medium text-cobalt">Same as billed</button>}
                                        </div>
                                      ) : l.actualQty !== null ? fmtN(l.actualQty) : "-"}
                                    </td>
                                    <td className="tnum px-3 py-2 text-right">{inr(l.invoicedAmount)}</td>
                                    <td className="tnum px-3 py-2 text-right">{l.expectedAmount !== null ? inr(l.expectedAmount) : "-"}</td>
                                    <td className={`tnum px-3 py-2 text-right font-semibold ${l.status === "discrepancy" && (l.diff ?? 0) > 0 ? "text-risk" : "text-slate"}`}>{l.diff !== null && l.diff !== 0 ? (l.diff > 0 ? "+" : "") + inr(l.diff) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {v.agreement.agreementMinimum && check.expectedSubtotal < v.agreement.agreementMinimum && check.pending === 0 ? <div className="rounded-lg border border-line border-l-4 border-l-sun bg-white px-3 py-2 text-[13px]">The agreement has a minimum of {inr(v.agreement.agreementMinimum)} a month. Confirmed charges are {inr(check.expectedSubtotal)}, so a shortfall of {inr(round(v.agreement.agreementMinimum - check.expectedSubtotal))} may be billed.</div> : null}
                        <GstPanel inv={v.invoice} buyer={org.gstin} overbilled={check.atRisk} />
                        <Issues
                          issues={buildIssues(check.lines, gst?.findings || [], dupInvoice)}
                          state={v.issueState || {}}
                          setState={(k, val) => update((x) => ({ ...x, issueState: { ...(x.issueState || {}), [k]: val } }))}
                          vendor={v.agreement.vendor}
                          invoice={v.invoice}
                          company={org.name}
                          past={(v.disputes || []).filter((d) => d.invoiceNo !== v.invoice!.invoiceNo)}
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-line bg-white p-3">
                          {v.status === "approved" ? (
                            <span className="rounded-md bg-ok-50 px-3 py-2 font-semibold text-ok">Approved for payment</span>
                          ) : (
                            <>
                              <span className="mr-auto text-slate">
                                {check.atRisk > 0 ? "Some charges don't match the agreement or your usage." : check.pending > 0 ? "Rates match. Enter the confirmed usage in the table above to approve." : check.unmatched > 0 ? "Some charges aren't in the agreement. Check if they were approved separately." : "Everything matches the agreement and your usage."}
                              </span>
                              
                              {(check.atRisk > 0 || check.unmatched > 0) && <button onClick={() => update((x) => ({ ...x, status: "disputed", disputes: [...(x.disputes || []).filter((d) => d.invoiceNo !== (x.invoice?.invoiceNo || "")), { invoiceNo: x.invoice?.invoiceNo || "", date: x.invoice?.date || "", amount: check.atRisk + check.unmatched, status: "open" }] }))} className="rounded-md bg-risk px-3 py-2 font-semibold text-white">Mark as disputed</button>}
                              <button disabled={check.pending > 0} onClick={() => update((x) => ({ ...x, status: "approved" }))} className={`rounded-md px-3 py-2 font-semibold ${check.atRisk > 0 || check.unmatched > 0 ? "border border-line" : "bg-black text-white"} disabled:opacity-40`}>
                                Approve {inr(check.atRisk > 0 ? check.expectedSubtotal : v.invoice.subtotal)} + GST
                              </button>
                            </>
                          )}
                        </div>
                      </>
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
  const t = tone === "bad" ? "border-l-coral bg-white" : tone === "warn" ? "border-l-sun bg-white" : tone === "good" ? "border-l-teal bg-white" : "border-l-black bg-white";
  const c = tone === "bad" ? "text-risk" : tone === "warn" ? "text-amber" : tone === "good" ? "text-ok" : "text-ink";
  return (
    <div className={`fadeup rounded-xl border border-line border-l-4 px-3.5 py-2.5 shadow-sm ${t}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate">{label}</div>
      <div className={`tnum font-serif text-[28px] leading-tight ${c}`}>{value}</div>
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
    <div className="rounded-2xl border border-line bg-white p-3">
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
            <input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} className="w-full rounded-md border border-transparent px-1 font-serif text-[22px] hover:border-line focus:border-cobalt" aria-label="Company name" />
            <div className="mt-1 flex items-center gap-2 px-1 text-slate">GSTIN <input value={org.gstin} onChange={(e) => setOrg({ ...org, gstin: e.target.value.toUpperCase() })} placeholder="Add for GST checks" maxLength={15} className="w-44 rounded-md border border-line px-2 py-0.5 font-mono text-[13px] text-ink" /> · {org.plan} plan</div>
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
    <div className="rounded-2xl border border-line bg-white">
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

const DISPUTE_LABEL: Record<string, string> = { open: "open", credit_note: "credit note received", corrected: "invoice corrected", rejected: "vendor rejected", paid_anyway: "paid anyway" };

function Reading({ label, file }: { label: string; file: string }) {
  const steps = label.toLowerCase().includes("invoice")
    ? ["Reading the invoice", "Matching each line to the agreement", "Checking GST details", "Working out what you should pay"]
    : label.toLowerCase().includes("usage")
    ? ["Looking at your columns", "Working out which rows are billable", "Counting every row"]
    : ["Reading the whole document", "Finding every charge and slab", "Checking when you get billed", "Listing financial liabilities", "Running your checklist", "Writing questions and negotiation points"];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 9000); return () => clearInterval(t); }, [steps.length]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-cobalt-100 border-t-cobalt" />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">{label.replace(/…$/, "")}</div>
            {file && <div className="truncate text-[13px] text-slate">{file}</div>}
          </div>
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s, k) => (
            <li key={s} className={`flex items-center gap-2 text-[14px] transition-opacity ${k > i ? "opacity-40" : ""}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${k < i ? "bg-black text-white" : k === i ? "border-2 border-cobalt" : "border border-line"}`}>{k < i ? "✓" : ""}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-4 h-1 overflow-hidden rounded bg-paper"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded bg-cobalt" /></div>
        <div className="mt-3 text-[12px] text-slate">Long agreements can take up to 2 minutes. We read every page, including tables and annexures.</div>
      </div>
    </div>
  );
}

function Liabilities({ list }: { list?: Agreement["liabilities"] }) {
  if (!list?.length) return null;
  const c = { high: "bg-risk-50 text-risk", medium: "bg-amber-50 text-amber", low: "bg-paper text-slate" } as const;
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-3 py-2 font-semibold">Financial liabilities in this agreement</div>
      <ul className="divide-y divide-line">
        {list.map((l, i) => (
          <li key={i} className="flex gap-3 px-3 py-2">
            <span className={`h-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${c[l.severity] || c.low}`}>{l.severity}</span>
            <div><div className="font-medium">{l.label}{l.amount ? <span className="ml-2 font-mono text-[13px] text-ink-2">{l.amount}</span> : null}</div><div className="text-[13px] text-slate">{l.detail}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Checklist({ result, list, save }: { result?: Agreement["checklist"]; list: string[]; save: (c: string[]) => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(list.join("\n"));
  const mark = { found: ["✓", "text-ok"], missing: ["✕", "text-risk"], unclear: ["?", "text-amber"] } as const;
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-center border-b border-line px-3 py-2">
        <span className="font-semibold">Your agreement checklist</span>
        <button onClick={() => { setDraft(list.join("\n")); setEdit(!edit); }} className="ml-auto text-[13px] font-medium text-cobalt">{edit ? "Cancel" : "Edit checklist"}</button>
      </div>
      {edit ? (
        <div className="p-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="w-full rounded-md border border-line p-2 text-[13px]" />
          <div className="mt-2 flex items-center gap-2"><button onClick={() => { save(draft.split("\n").map((x) => x.trim()).filter(Boolean)); setEdit(false); }} className="rounded-md bg-ink px-3 py-1.5 font-medium text-white">Save checklist</button><span className="text-[12px] text-slate">One check per line. Used for every agreement you upload from now on.</span></div>
        </div>
      ) : result?.length ? (
        <ul className="grid gap-px bg-line md:grid-cols-2">
          {result.map((r, i) => (
            <li key={i} className="flex gap-2 bg-white px-3 py-2">
              <span className={`font-mono font-bold ${(mark[r.status] || mark.unclear)[1]}`}>{(mark[r.status] || mark.unclear)[0]}</span>
              <div><div className="text-[13px] font-medium">{r.item}</div><div className="text-[12px] text-slate">{r.detail}</div></div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-3 py-2 text-[13px] text-slate">{list.length} checks will run on the next agreement you upload.</div>
      )}
    </div>
  );
}

function Dashboard({ vendors, open, setDispute, remove }: { vendors: Vendor[]; open: (id: string) => void; setDispute: (vid: string, idx: number, s: NonNullable<Vendor["disputes"]>[number]["status"]) => void; remove: (id: string) => void }) {
  if (!vendors.length) return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md space-y-2 text-slate">
        <div className="font-serif text-[40px] leading-none text-ink">Add your first vendor</div>
        <div>Upload a vendor agreement, order form or rate card: PDF, Word, a scan or a photo. We read it, list every charge and liability, and run your checklist.</div>
      </div>
    </div>
  );
  const rows = vendors.map((v) => {
    const c = v.invoice ? checkInvoice(v.invoice, v.agreement.costItems) : null;
    return { v, c };
  });
  const billed = rows.reduce((s, r) => s + (r.v.invoice?.total || 0), 0);
  const over = rows.reduce((s, r) => s + (r.c?.atRisk || 0), 0);
  const openDisputes = vendors.flatMap((v) => v.disputes || []).filter((d) => d.status === "open");
  const recovered = vendors.flatMap((v) => v.disputes || []).filter((d) => d.status === "credit_note" || d.status === "corrected").reduce((s, d) => s + d.amount, 0);
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
      <div className="font-serif text-[32px] leading-none">All vendors</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Vendors" value={String(vendors.length)} />
        <Stat label="Latest invoices, incl. GST" value={inr(round(billed))} />
        <Stat label="Overbilled found" value={inr(round(over))} tone={over > 0 ? "bad" : undefined} />
        <Stat label="Recovered" value={inr(round(recovered))} tone={recovered > 0 ? "good" : undefined} sub={openDisputes.length ? `${openDisputes.length} dispute${openDisputes.length > 1 ? "s" : ""} open` : undefined} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left">
          <thead className="bg-paper text-[11px] uppercase tracking-wide text-slate"><tr><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Latest invoice</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Dispute</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {rows.map(({ v, c }) => {
              const dIdx = (v.disputes || []).length - 1;
              const d = dIdx >= 0 ? v.disputes![dIdx] : null;
              const status = v.status === "approved" ? ["Approved", "bg-ok-50 text-ok"] : v.status === "disputed" ? ["Disputed", "bg-risk-50 text-risk"] : !v.invoice ? ["No invoice yet", "bg-paper text-slate"] : c && c.pending ? ["Waiting for usage", "bg-amber-50 text-amber"] : ["To review", "bg-cobalt-50 text-cobalt"];
              return (
                <tr key={v.id} className="border-t border-line align-middle">
                  <td className="px-3 py-2"><button onClick={() => open(v.id)} className="font-medium hover:text-cobalt">{v.agreement.vendor}</button><div className="text-[12px] text-slate">{v.agreement.costItems.length} charges</div></td>
                  <td className="px-3 py-2 text-[13px]">{v.invoice ? <>{v.invoice.invoiceNo}<div className="text-slate">{v.invoice.date}</div></> : "-"}</td>
                  <td className="tnum px-3 py-2 text-right">{v.invoice ? inr(v.invoice.total) : "-"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${status[1]}`}>{status[0]}</span></td>
                  <td className="px-3 py-2">
                    {d ? (
                      <select value={d.status} onChange={(e) => setDispute(v.id, dIdx, e.target.value as typeof d.status)} className="rounded-md border border-line px-2 py-1 text-[13px]">
                        {Object.entries(DISPUTE_LABEL).map(([k, l]) => <option key={k} value={k}>{inr(d.amount)}: {l}</option>)}
                      </select>
                    ) : <span className="text-slate">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><RemoveBtn onConfirm={() => remove(v.id)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[12px] text-slate">Dispute outcomes are remembered. The next dispute email for that vendor mentions what happened last time.</div>
    </div>
  );
}

type Issue = { key: string; title: string; detail: string; amount?: number };
function buildIssues(lines: ReturnType<typeof checkInvoice>["lines"], gst: { level: string; title: string; detail: string }[], dup: boolean): Issue[] {
  const out: Issue[] = [];
  for (const l of lines) {
    if (l.status === "discrepancy") out.push({ key: "d:" + l.description, title: `${l.description}: overbilled by ${inr(l.diff ?? 0)}`, detail: l.flags.join(" "), amount: l.diff ?? 0 });
    if (l.status === "unmatched") out.push({ key: "u:" + l.description, title: `${l.description}: ${inr(l.invoicedAmount)} not in the agreement`, detail: "Please share the written approval for this charge, or remove it.", amount: l.invoicedAmount });
    for (const f of l.flags) if (f.startsWith("One price covers")) out.push({ key: "b:" + l.description, title: `${l.description}: no journey-wise breakup`, detail: "Please share a report of journeys started, completed and dropped for this billing period, so we can match the billed count." });
  }
  for (const g of gst) if (g.level !== "ok") out.push({ key: "g:" + g.title, title: `GST: ${g.title}`, detail: g.detail });
  if (dup) out.push({ key: "dup", title: "This invoice number was already received", detail: "Please confirm this is not a duplicate." });
  return out;
}

const STATES: [PointStatus, string][] = [["open", "Open"], ["discussed", "Discussed"], ["keep", "Keep as it is"], ["ignored", "Ignore"], ["resolved", "Resolved"]];
const STATE_STYLE: Record<PointStatus, string> = { open: "border-line bg-white", discussed: "border-cobalt/40 bg-cobalt-50 text-cobalt", keep: "border-line bg-paper text-slate", ignored: "border-line bg-paper text-slate", resolved: "border-ok/40 bg-ok-50 text-ok" };
function StateSelect({ value, onChange }: { value: PointStatus; onChange: (v: PointStatus) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as PointStatus)} className={`h-fit rounded-full border px-2.5 py-1 text-[12px] font-medium ${STATE_STYLE[value]}`}>
      {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

function EmailBox({ to, subject, body }: { to: string; subject: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="mb-1 flex items-center gap-2 font-semibold">Email to {to}
        <button onClick={() => { navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto rounded-full border border-line px-3 py-1 text-[12px] font-normal">{copied ? "Copied" : "Copy"}</button>
        <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className="rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white">Open in email</a>
      </div>
      <div className="text-[13px] font-medium">Subject: {subject}</div>
      <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-[13px] text-ink-2">{body}</pre>
    </div>
  );
}

function Issues({ issues, state, setState, vendor, invoice, company, past }: { issues: Issue[]; state: Record<string, PointStatus>; setState: (k: string, v: PointStatus) => void; vendor: string; invoice: Invoice; company: string; past: NonNullable<Vendor["disputes"]> }) {
  if (!issues.length) return null;
  const open = issues.filter((i) => (state[i.key] || "open") === "open");
  const total = open.reduce((s, i) => s + Math.max(0, i.amount || 0), 0);
  const subject = `Invoice ${invoice.invoiceNo}${invoice.date ? " dated " + invoice.date : ""}: ${open.length} point${open.length === 1 ? "" : "s"} to clarify`;
  const body = `Dear ${vendor} team,

We have reviewed invoice ${invoice.invoiceNo}${invoice.date ? " dated " + invoice.date : ""} against our agreement and usage records. Before we process payment, please help us with the following:

${open.map((i, n) => `${n + 1}. ${i.title}\n   ${i.detail}`).join("\n\n")}
${total > 0 ? `\nThe amount in question is ${inr(round(total))} before GST. Please share a corrected invoice or a credit note.\n` : ""}${past.length ? `\nFor reference, we raised similar points on invoice ${past[past.length - 1].invoiceNo} earlier.\n` : ""}
Regards,
Accounts Payable
${company}`;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white">
        <div className="flex items-center border-b border-line px-3 py-2"><span className="font-semibold">Issues found</span><span className="ml-2 rounded-full bg-paper px-2 text-[12px] text-slate">{open.length} open of {issues.length}</span></div>
        <ul className="divide-y divide-line">
          {issues.map((i) => {
            const st = state[i.key] || "open";
            return (
              <li key={i.key} className={`flex gap-2 px-3 py-2 ${st === "ignored" || st === "resolved" ? "opacity-55" : ""}`}>
                <div className="min-w-0 flex-1"><div className="font-medium">{i.title}</div><div className="text-[12px] text-slate">{i.detail}</div></div>
                <StateSelect value={st} onChange={(val) => setState(i.key, val)} />
              </li>
            );
          })}
        </ul>
      </div>
      {open.length > 0 ? <EmailBox to={vendor} subject={subject} body={body} /> : <div className="rounded-xl border border-line bg-white p-3 text-slate">No open issues left. Only issues marked Open go into the email.</div>}
    </div>
  );
}

function AgreementEmail({ a, state, setState, company }: { a: Agreement; state: Record<string, PointStatus>; setState: (k: string, v: PointStatus) => void; company: string }) {
  const points: { key: string; kind: "Clarify" | "Change"; text: string }[] = [];
  for (const c of a.costItems) for (const q of c.questions) if (!q.answer || /not stated/i.test(q.answer)) points.push({ key: "q:" + c.id + q.id, kind: "Clarify", text: `${c.name}: ${q.text}` });
  for (const x of a.suggestions || []) points.push({ key: "s:" + x.slice(0, 40), kind: "Clarify", text: x });
  for (const x of a.checklist || []) if (x.status !== "found") points.push({ key: "c:" + x.item, kind: "Clarify", text: `${x.item}: ${x.detail}` });
  for (const n of a.negotiate || []) points.push({ key: "n:" + n.item, kind: "Change", text: `${n.item}: ${n.ask}` });
  if (!points.length) return null;
  const open = points.filter((p) => (state[p.key] || "open") === "open");
  const cl = open.filter((p) => p.kind === "Clarify");
  const ch = open.filter((p) => p.kind === "Change");
  const subject = `${a.vendor} agreement: points to clarify${ch.length ? " and proposed changes" : ""}`;
  const body = `Dear ${a.vendor} team,

We have gone through the agreement for ${a.service}. Before we proceed, we would like to close a few points.
${cl.length ? `\nPlease clarify in writing:\n${cl.map((p, i) => `${i + 1}. ${p.text}`).join("\n")}\n` : ""}${ch.length ? `\nWe would like to propose these changes:\n${ch.map((p, i) => `${i + 1}. ${p.text}`).join("\n")}\n` : ""}
Please share your response, and a revised draft where needed, so we can finalise.

Regards,
${company}`;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white">
        <div className="flex items-center border-b border-line px-3 py-2"><span className="font-semibold">Points to raise with the vendor</span><span className="ml-2 rounded-full bg-paper px-2 text-[12px] text-slate">{open.length} open of {points.length}</span></div>
        <ul className="max-h-[480px] divide-y divide-line overflow-auto">
          {points.map((p) => {
            const st = state[p.key] || "open";
            return (
              <li key={p.key} className={`flex gap-2 px-3 py-2 ${st === "ignored" || st === "resolved" || st === "keep" ? "opacity-55" : ""}`}>
                <span className={`h-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${p.kind === "Change" ? "bg-sun-50 text-amber" : "bg-cobalt-50 text-cobalt"}`}>{p.kind}</span>
                <div className="min-w-0 flex-1 text-[13px]">{p.text}</div>
                <StateSelect value={st} onChange={(val) => setState(p.key, val)} />
              </li>
            );
          })}
        </ul>
      </div>
      {open.length ? <EmailBox to={a.vendor} subject={subject} body={body} /> : <div className="rounded-xl border border-line bg-white p-3 text-slate">All points are handled. Once the vendor sends the final version, use "Upload final agreed agreement" at the top. Invoices will be checked against it.</div>}
    </div>
  );
}

function RemoveBtn({ onConfirm }: { onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <span className="whitespace-nowrap text-[13px]"><button onClick={onConfirm} className="font-medium text-risk">Yes, remove</button> · <button onClick={() => setSure(false)} className="text-slate">Cancel</button></span>
  ) : <button onClick={() => setSure(true)} className="text-[13px] text-slate hover:text-risk">Remove</button>;
}
