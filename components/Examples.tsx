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
      <div className="mb-5 flex flex-wrap justify-center gap-1.5">
        {EX.map((x, k) => (
          <button key={x.tab} onClick={() => { setI(k); setHold(true); }} className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${k === i ? "bg-white text-black" : "text-white/55 ring-1 ring-white/10 hover:text-white"}`}>{x.tab}</button>
        ))}
      </div>
      <div key={i} className="fadeup overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#161616] to-[#0b0b0b] text-left text-[#f4f2ee] shadow-[0_40px_120px_-40px_rgba(214,185,124,.35)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-3.5 text-sm"><span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /></span>
          <span className="font-medium">{e.doc}</span>
          <span className="ml-auto font-mono text-[10px] tracking-widest text-gold">READ BY INVOICEGUARD</span>
        </div>
        <div className="px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Charge found</div>
          <div className="mt-1 font-serif text-[28px] leading-tight">{e.charge}</div>
          <div className="mt-1 text-[14px] text-white/55">{e.detail}</div>
        </div>
        <div className="border-t border-white/10 px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">The agreement doesn&apos;t say</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{e.unclear.map((q) => <span key={q} className="rounded-full border border-gold/40 px-3 py-1 text-gold">{q}</span>)}</div>
        </div>
        <ul className="grid border-t border-white/10 text-sm md:grid-cols-3 md:divide-x md:divide-white/10">
          {e.checks.map(([a, b], n) => (
            <li key={a} className="px-6 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{a}</div><div className="mt-1 text-[14px]">{b}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
