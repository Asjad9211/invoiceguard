"use client";
import { useEffect, useState } from "react";

const EX = [
  { tab: "KYC", doc: "KYC vendor agreement", charge: "Price per onboarding", detail: "One price covers 15 steps: PAN OCR, Aadhaar, video, face match and more", unclear: ["Billed when started or completed?", "Drop-offs billed in full?", "Retries counted again?"], checks: [["Invoice check", "Onboardings billed vs onboardings completed"], ["Watch for", "No journey-wise breakup on the invoice"], ["Negotiate", "Pay per step used when a customer drops off"]] },
  { tab: "SMS & WhatsApp", doc: "Messaging agreement", charge: "Per message, slab pricing", detail: "SMS slabs by monthly volume, WhatsApp by template category, plus a platform fee", unclear: ["Sent or delivered?", "Long SMS counted as 1 or 2?", "Slab on all units or per band?"], checks: [["Invoice check", "Billed count vs delivered count"], ["Watch for", "Utility messages billed at marketing rates"], ["Negotiate", "Graduated slabs instead of volume slabs"]] },
  { tab: "Payment gateway", doc: "Payment gateway agreement", charge: "MDR by payment mode", detail: "Different rates for UPI, cards, net banking and wallets, plus refund and chargeback fees", unclear: ["MDR on refunded amounts?", "Fee on failed transactions?", "When do rates change?"], checks: [["Invoice check", "MDR per mode vs your settlement report"], ["Watch for", "Fees on refunds and reversals"], ["Negotiate", "Zero MDR on UPI and capped card fees"]] },
  { tab: "Cloud", doc: "Cloud services order form", charge: "Committed spend + on-demand", detail: "A yearly commitment, credits that expire, and on-demand rates above the commitment", unclear: ["What if we under-use the commitment?", "Do credits roll over?", "Data transfer charges?"], checks: [["Invoice check", "Credits applied before charging"], ["Watch for", "Shortfall charged at year end"], ["Negotiate", "Roll unused commitment into next year"]] },
  { tab: "SaaS licences", doc: "Software subscription", charge: "Per seat, billed yearly", detail: "Seats are added automatically when someone new logs in", unclear: ["Can seats be reduced mid-term?", "Price increase at renewal?", "Inactive users billed?"], checks: [["Invoice check", "Seats billed vs seats actually used"], ["Watch for", "Auto-renewal with a price increase"], ["Negotiate", "True-down at renewal and a price cap"]] },
  { tab: "Telecom", doc: "Calling and numbers agreement", charge: "Per minute or per pulse", detail: "Rental for each virtual number, plus call charges by pulse", unclear: ["Billed per minute or per 15-second pulse?", "Rental for unused numbers?", "Minimum monthly usage?"], checks: [["Invoice check", "Minutes billed vs call logs"], ["Watch for", "Rentals for numbers no longer in use"], ["Negotiate", "Per-second billing and a lower minimum"]] },
  { tab: "Agency", doc: "Agency retainer", charge: "Monthly retainer + extra hours", detail: "A fixed retainer covers set deliverables; extra work billed per hour", unclear: ["What counts as extra work?", "Is there an hours cap?", "Who approves extra hours?"], checks: [["Invoice check", "Hours billed vs approved hours"], ["Watch for", "Out-of-scope work billed without approval"], ["Negotiate", "Written approval before any extra hours"]] },
  { tab: "Logistics", doc: "Courier agreement", charge: "Per shipment by weight slab", detail: "Rates by weight and zone, plus fuel surcharge, COD and return charges", unclear: ["Actual or volumetric weight?", "Fuel surcharge capped?", "Charges on returned orders?"], checks: [["Invoice check", "Weight billed vs weight shipped"], ["Watch for", "Return charges on failed deliveries"], ["Negotiate", "A cap on fuel surcharge changes"]] },
  { tab: "Credit bureau", doc: "Bureau data agreement", charge: "Per hit with monthly minimum", detail: "Charged per report pulled, with a minimum monthly billing", unclear: ["Charged for 'no record found'?", "Retries counted again?", "Minimum carried forward?"], checks: [["Invoice check", "Hits billed vs successful pulls"], ["Watch for", "Shortfall billed every month"], ["Negotiate", "No charge for failed or empty hits"]] },
  { tab: "Office & rentals", doc: "Lease and maintenance", charge: "Rent + maintenance + utilities", detail: "Rent with yearly escalation, maintenance per square foot, utilities at actuals", unclear: ["When does escalation apply?", "Common area charges split how?", "Utilities with markup?"], checks: [["Invoice check", "Escalation applied on the right date"], ["Watch for", "Maintenance on the wrong area"], ["Negotiate", "Cap on yearly escalation"]] },
];

export default function Examples() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const t = setInterval(() => setI((x) => (x + 1) % EX.length), 4500);
    return () => clearInterval(t);
  }, [hold]);
  const e = EX[i];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EX.map((x, k) => (
          <button key={x.tab} onClick={() => { setI(k); setHold(true); }} className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${k === i ? "bg-white text-ink" : "bg-white/5 text-white/70 ring-1 ring-white/15 hover:text-white"}`}>{x.tab}</button>
        ))}
      </div>
      <div key={i} className="glow fadeup overflow-hidden rounded-2xl border border-white/10 bg-white text-ink">
        <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5 text-sm"><span className="flex gap-1"><span className="h-2.5 w-2.5 rounded-full bg-coral" /><span className="h-2.5 w-2.5 rounded-full bg-sun" /><span className="h-2.5 w-2.5 rounded-full bg-teal" /></span>
          <span className="font-medium">{e.doc}</span>
          <span className="ml-auto rounded bg-cobalt-50 px-2 py-0.5 font-mono text-[11px] text-cobalt">READ BY INVOICEGUARD</span>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate">Charge found</div>
          <div className="mt-0.5 font-medium">{e.charge}</div>
          <div className="text-[13px] text-slate">{e.detail}</div>
        </div>
        <div className="border-t border-line bg-cobalt-50/60 px-4 py-3">
          <div className="text-[13px] font-medium">The agreement doesn&apos;t say:</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{e.unclear.map((q) => <span key={q} className="rounded-md border border-cobalt-100 bg-white px-2 py-1">{q}</span>)}</div>
        </div>
        <ul className="divide-y divide-line border-t border-line text-sm">
          {e.checks.map(([a, b], n) => (
            <li key={a} className="flex items-start gap-3 px-4 py-2.5">
              <svg viewBox="0 0 24 24" className={`mt-0.5 h-4 w-4 shrink-0 ${["text-cobalt", "text-coral", "text-teal"][n]}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /></svg>
              <div><div className="font-medium">{a}</div><div className="text-[12px] text-slate">{b}</div></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
