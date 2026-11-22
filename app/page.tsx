import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import Examples from "@/components/Examples";

const I = {
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  check: "M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3",
  arrow: "M5 12h14M13 6l6 6-6 6",
};
function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const STEPS = [
  { n: "01", t: "Read the agreement", d: "Upload a vendor agreement, order form or rate card: PDF, Word, a scan or a photo. We list every charge, every financial liability, and run your own checklist on it. If something is vague, like whether drop-offs are billed, we ask you.", icon: I.doc },
  { n: "02", t: "Decide who checks what", d: "For each charge, pick one person and the data they trust: a report, a usage file or an API log. Upload a usage export and InvoiceGuard works out which rows are billable. For licences, note whether they're fully used, so patterns show up over time.", icon: I.user },
  { n: "03", t: "Check the invoice", d: "Upload the invoice. Picking it up from your email is coming soon. We work out what you should pay, check the GST, show payment and dispute deadlines, and draft the dispute. We remember how each dispute ended.", icon: I.receipt },
  { n: "04", t: "Know what to negotiate", d: "We point out what is worth asking the vendor to change: fixed fees, slab rules, minimum commitments, how failed calls are billed and rate locks.", icon: I.tag },
];


const CASES = [
  ["KYC and onboarding", "One price per onboarding that covers 15 steps. We ask whether drop-offs are billed and check started versus completed journeys."],
  ["SMS, WhatsApp and email", "Sent versus delivered, multi-part messages, template categories, DLT charges and the platform fee on top."],
  ["Payment gateway", "MDR by payment mode, refunds and chargeback fees, and settlement deductions against the rate card."],
  ["Cloud and hosting", "Reserved versus on-demand, committed spend, free credits that expire and egress charges."],
  ["SaaS licences", "Seats billed versus seats in use, auto-renewals, and price increases at renewal."],
  ["Telecom and calling", "Per-minute versus per-pulse billing, rentals for numbers you no longer use, and plan minimums."],
  ["Agencies and consultants", "Retainers, hours capped in the contract, and work billed outside the agreed scope."],
  ["Logistics and couriers", "Weight slabs, fuel surcharges, RTO charges and COD fees."],
  ["Data and credit bureaus", "Per-hit pricing, hits on failed lookups and minimum monthly billing."],
  ["Facilities and rentals", "Escalation clauses, maintenance charges and pass-through utilities."],
];

const GST = [
  ["GSTIN format", "We check the vendor's GSTIN and yours on every invoice."],
  ["IGST or CGST + SGST", "Different states means IGST. Same state means CGST + SGST. If the wrong one is charged, you may not get input tax credit."],
  ["Rate", "Most digital and IT services are taxed at 18%. We flag anything else so you can confirm the SAC code."],
  ["Maths", "We check that the tax adds up, and show how much GST you were charged on amounts that were overbilled."],
  ["Basic details", "Invoice number, date and your GSTIN need to be on the invoice to claim credit."],
];

const ROLES = [
  { r: "Admin", d: "Company settings, billing and users", p: [1, 1, 1, 1] },
  { r: "Approver", d: "Usually finance", p: [1, 0, 1, 1] },
  { r: "Owner", d: "The person who has the usage data", p: [1, 0, 1, 0] },
  { r: "Viewer", d: "Audit or leadership", p: [1, 0, 0, 0] },
];
const PERMS = ["View", "Add vendors", "Confirm usage", "Approve or dispute"];

export default function Landing() {
  return (
    <div className="lux min-h-dvh">
      <header className="sticky top-0 z-30 border-b lux-line bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5">
          <Link href="/" aria-label="InvoiceGuard home"><Logo dark /></Link>
          <nav className="hidden gap-7 text-[13px] lux-muted md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#use-cases" className="hover:text-white">Use cases</a>
            <a href="#gst" className="hover:text-white">GST</a>
            <a href="#teams" className="hover:text-white">Teams</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/app" className="hidden text-[13px] lux-muted hover:text-white sm:block">Log in</Link>
            <Link href="/signup" className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black hover:bg-white/90">Get started</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="spot relative">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-20 text-center md:pt-28">
          <div className="fadeup mx-auto mb-6 w-fit rounded-full border lux-line px-3.5 py-1 text-[12px] tracking-wide lux-muted">For finance and operations teams in India</div>
          <h1 className="fadeup font-serif text-[52px] leading-[0.98] tracking-tight md:text-[92px]">
            Every vendor bill,<br /><em className="text-gold">checked</em> before you pay.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed lux-muted">
            Upload the agreement once. Upload each invoice. See what you should have been charged, where the bill is off, and whether the GST is right.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-[15px] font-medium text-black hover:bg-white/90">Start free</Link>
            <Link href="/app" className="rounded-full border border-white/20 px-6 py-3 text-[15px] font-medium text-white hover:border-white/50">Upload an agreement <span aria-hidden>→</span></Link>
          </div>
          <p className="mt-5 text-[13px] lux-muted">Free for your first 3 vendors. No card needed.</p>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-24">
          <Examples />
        </div>
      </section>

      {/* problems */}
      <section className="border-t lux-line">
        <div className="mx-auto grid max-w-6xl gap-px px-5 py-24 md:grid-cols-3">
          {[
            ["The agreement is vague.", "It says “per message processed”. Does that include failed messages? Most teams only find out when they argue about a bill."],
            ["Nobody owns the number.", "Finance has the invoice. Marketing or product has the usage. The bill often gets paid without anyone comparing the two."],
            ["Bundles hide the cost.", "One price per journey means a customer who drops off halfway can still cost you the whole journey."],
          ].map(([t, d]) => (
            <div key={t} className="p-6">
              <div className="font-serif text-[30px] leading-tight">{t}</div>
              <p className="mt-3 text-[15px] leading-relaxed lux-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how */}
      <section id="how" className="border-t lux-line">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Head k="How it works" t="Set up a vendor once." em="Check every invoice in minutes." />
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="lux-card lift rounded-3xl p-8">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-gold">{s.n}</span>
                  <span className="h-px flex-1 bg-white/10" />
                  <Icon d={s.icon} className="h-5 w-5 text-white/60" />
                </div>
                <div className="mt-6 font-serif text-[30px] leading-tight">{s.t}</div>
                <p className="mt-3 text-[15px] leading-relaxed lux-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-3xl border lux-line p-8 md:flex md:items-center md:gap-10">
            <div className="font-serif text-[28px] leading-tight md:w-1/3">Reads like a person.<br /><em className="text-gold">Calculates like a machine.</em></div>
            <p className="mt-3 text-[15px] leading-relaxed lux-muted md:mt-0 md:flex-1">InvoiceGuard reads your agreements and invoices. Every amount, from slab maths to what you should pay and GST, is calculated by plain code and linked back to a clause or a usage figure, so you can check it yourself.</p>
          </div>
        </div>
      </section>

      {/* use cases */}
      <section id="use-cases" className="border-t lux-line">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Head k="Works with any agreement" t="If a vendor bills you against a contract," em="InvoiceGuard can read it." />
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CASES.map(([t, d]) => (
              <div key={t} className="lux-card lift rounded-2xl p-5">
                <div className="text-[15px] font-medium">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed lux-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GST */}
      <section id="gst" className="border-t lux-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2">
          <div>
            <Head k="GST" t="GST checked on" em="every invoice." />
            <p className="mt-5 text-[15px] leading-relaxed lux-muted">Even when the amount is right, the wrong tax type or a missing GSTIN can cost you input tax credit. We flag it and tell you what to ask the vendor to fix. These are checks to help your tax team, not a filing tool.</p>
          </div>
          <ul className="divide-y lux-line rounded-3xl border lux-line">
            {GST.map(([t, d]) => (
              <li key={t} className="flex gap-4 px-6 py-5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <div><div className="font-medium">{t}</div><div className="mt-0.5 text-[14px] lux-muted">{d}</div></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* teams */}
      <section id="teams" className="border-t lux-line">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Head k="Teams" t="Bring in the people" em="who already have the numbers." />
          <div className="mt-14 overflow-x-auto rounded-3xl border lux-line">
            <table className="w-full text-[14px]">
              <thead><tr className="border-b lux-line text-left"><th className="px-6 py-4 font-medium">Role</th>{PERMS.map((p) => <th key={p} className="px-4 py-4 text-center text-[12px] font-normal lux-muted">{p}</th>)}</tr></thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.r} className="border-b lux-line last:border-0">
                    <td className="px-6 py-4"><div className="font-medium">{r.r}</div><div className="text-[12px] lux-muted">{r.d}</div></td>
                    {r.p.map((v, i) => <td key={i} className="px-4 py-4 text-center">{v ? <span className="text-gold">●</span> : <span className="text-white/15">○</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t lux-line">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Head k="Pricing" t="Start free." em="Pay as you add vendors." />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { n: "Free", p: "₹0", s: "forever", f: ["Up to 3 vendors", "Up to 3 users", "Unlimited invoices", "GST checks and reminders"], cta: "Start free" },
              { n: "Team", p: "₹1,499", s: "a month", f: ["First month free", "Up to 15 vendors", "5 users included", "₹99 per extra user a month", "₹149 per extra vendor a month", "Usage file import"], cta: "Try a month free", hi: true },
              { n: "Business", p: "Let's talk", s: "", f: ["Unlimited vendors and users", "Usage from vendor APIs", "Tally, Zoho or SAP export", "Single sign-on"], cta: "Contact us" },
            ].map((t) => (
              <div key={t.n} className={`flex flex-col rounded-3xl p-8 ${t.hi ? "bg-[#f4f2ee] text-black" : "lux-card"}`}>
                <div className={`text-[13px] font-medium ${t.hi ? "text-black/60" : "lux-muted"}`}>{t.n}</div>
                <div className="mt-3 flex items-baseline gap-2"><span className="font-serif text-[52px] leading-none">{t.p}</span><span className={t.hi ? "text-black/50" : "lux-muted"}>{t.s}</span></div>
                <ul className={`mt-6 flex-1 space-y-2.5 text-[14px] ${t.hi ? "text-black/70" : "lux-muted"}`}>
                  {t.f.map((f) => <li key={f} className="flex gap-2.5"><span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${t.hi ? "bg-black" : "bg-gold"}`} />{f}</li>)}
                </ul>
                <Link href="/signup" className={`mt-8 rounded-full px-5 py-3 text-center text-[14px] font-medium ${t.hi ? "bg-black text-white" : "border border-white/20 hover:border-white/50"}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="spot border-t lux-line">
        <div className="mx-auto max-w-4xl px-5 py-28 text-center">
          <div className="font-serif text-[44px] leading-[1.02] md:text-[72px]">Try it on <em className="text-gold">one</em> agreement.</div>
          <p className="mt-4 lux-muted">Your documents are only used for your account.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-white px-6 py-3 font-medium text-black">Start free</Link>
            <Link href="/app" className="rounded-full border border-white/20 px-6 py-3 font-medium hover:border-white/50">Upload an agreement</Link>
          </div>
        </div>
      </section>

      <footer className="border-t lux-line">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-8 text-[13px] lux-muted">
          <LogoMark size={20} /> InvoiceGuard
          <span className="ml-auto">Made in Mumbai</span>
        </div>
      </footer>
    </div>
  );
}

function Head({ k, t, em }: { k: string; t: string; em: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[12px] uppercase tracking-[0.18em] text-gold">{k}</div>
      <h2 className="mt-4 font-serif text-[40px] leading-[1.02] md:text-[60px]">{t} <em className="lux-muted">{em}</em></h2>
    </div>
  );
}
