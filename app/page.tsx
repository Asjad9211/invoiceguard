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


const CASES: [string, string, string[]][] = [
  ["KYC and onboarding", "Per onboarding, per step", ["Started vs completed", "Drop-offs billed?", "Step-wise breakup"]],
  ["SMS, WhatsApp, email", "Per message, by slab", ["Sent vs delivered", "Template category", "DLT and platform fees"]],
  ["Payment gateway", "MDR by payment mode", ["Rate per mode", "Fees on refunds", "Chargeback charges"]],
  ["Cloud and hosting", "Commitment + usage", ["Unused commitment", "Credits applied", "Data transfer"]],
  ["SaaS licences", "Per seat, yearly", ["Seats used vs billed", "Auto-renewal", "Price increase"]],
  ["Telecom and calling", "Per minute or pulse", ["Pulse vs minute", "Idle number rentals", "Plan minimums"]],
  ["Agencies", "Retainer + hours", ["Hours cap", "Out-of-scope work", "Approvals"]],
  ["Logistics", "Weight slabs + surcharges", ["Actual vs volumetric", "Fuel surcharge", "Return charges"]],
  ["Credit bureaus", "Per hit + minimum", ["Failed hits", "Retries", "Monthly minimum"]],
  ["Rent and facilities", "Rent + maintenance", ["Yearly increase", "Area billed", "Deposit terms"]],
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
      <header className="sticky top-0 z-30 border-b lux-line bg-[#f4efe6]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5">
          <Link href="/" aria-label="InvoiceGuard home"><Logo /></Link>
          <nav className="hidden gap-7 text-[13px] lux-muted md:flex">
            <a href="#how" className="hover:text-[#17140f]">How it works</a>
            <a href="#use-cases" className="hover:text-[#17140f]">Use cases</a>
            <a href="#gst" className="hover:text-[#17140f]">GST</a>
            <a href="#personal" className="hover:text-[#17140f]">For you</a>
            <a href="#teams" className="hover:text-[#17140f]">Teams</a>
            <a href="#pricing" className="hover:text-[#17140f]">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/app" className="hidden text-[13px] lux-muted hover:text-[#17140f] sm:block">Log in</Link>
            <Link href="/signup" className="rounded-full bg-gold px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#1c3bb8]">Get started</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="spot relative">
        <div className="mx-auto max-w-6xl px-5 pb-5 pt-6 text-center md:pt-8">
          <h1 className="fadeup font-serif text-[32px] leading-[1.05] tracking-tight md:text-[46px]">
            Every vendor bill, <em className="text-gold">checked</em> before you pay.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed lux-muted">
            Upload the agreement once, then each invoice. See what you should have been charged, where the bill is off, and whether the GST is right.
          </p>
        </div>
        <div id="demo" className="mx-auto max-w-4xl px-5 pb-10">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
            <a href="#try" className="rounded-full bg-gold px-7 py-3.5 text-[16px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(36,72,216,.7)] hover:bg-[#1c3bb8]">Try the actual product →</a>
            <Link href="/app" className="rounded-full border border-[#17140f]/25 px-6 py-3.5 text-[15px] font-medium hover:border-[#17140f]">Upload your own agreement</Link>
          </div>
          <div className="overflow-hidden rounded-2xl border lux-line bg-white p-2 shadow-[0_30px_70px_-35px_rgba(14,26,70,.45)] md:p-3">
            <video src="/demo.mp4" poster="/demo-poster.jpg" controls playsInline preload="metadata" className="block aspect-video w-full rounded-xl bg-[#f4efe6]" />
          </div>
          <p className="mt-3 text-center text-[13px] lux-muted">1-minute demo, sound on · No login · Free for your first 3 vendors</p>
        </div>
        <div id="try" className="mx-auto max-w-2xl scroll-mt-20 px-5 pb-12">
            <div className="flex flex-col rounded-2xl border-2 border-gold bg-white p-5 text-left shadow-[0_20px_50px_-30px_rgba(36,72,216,.5)]">
              <div className="flex items-center gap-3">
                                <div>
                  <div className="text-[19px] font-semibold">Try the real product</div>
                  <div className="text-[13px] lux-muted">No login. Takes about 2 minutes.</div>
                </div>
              </div>
              <div className="mt-4 text-[13px] font-semibold uppercase tracking-wide lux-muted">Download the sample files</div>
              <div className="mt-2 grid gap-2">
                <a href="/samples/nimbus-kyc-agreement.pdf" download className="flex items-center justify-between rounded-xl border lux-line px-4 py-2.5 hover:border-gold"><span><b className="text-[14px]">Agreement</b> <span className="text-[13px] lux-muted">· Nimbus KYC, PDF</span></span><span className="text-gold">↓</span></a>
                <a href="/samples/nimbus-kyc-invoice-oct-2026.pdf" download className="flex items-center justify-between rounded-xl border lux-line px-4 py-2.5 hover:border-gold"><span><b className="text-[14px]">Invoice</b> <span className="text-[13px] lux-muted">· October, 1,200 onboardings billed</span></span><span className="text-gold">↓</span></a>
                <a href="/samples/nimbus-usage-oct-2026.csv" download className="flex items-center justify-between rounded-xl border lux-line px-4 py-2.5 hover:border-gold"><span><b className="text-[14px]">Usage report</b> <span className="text-[13px] lux-muted">· CSV, 1,140 actually completed</span></span><span className="text-gold">↓</span></a>
              </div>
              <ol className="mt-4 space-y-1.5 text-[14px]">
                <li><b>1.</b> Open the app, tap <b>Add vendor</b>, upload the agreement.</li>
                <li><b>2.</b> In <b>Invoice</b>, upload the invoice.</li>
                <li><b>3.</b> Import the usage report in <b>Who checks</b>, or type 1,140 as confirmed.</li>
              </ol>
              <p className="mt-3 rounded-lg bg-[#2448d8]/[.07] px-3 py-2 text-[13px]">Or upload <b>your own</b> agreement and invoice. PDF, Word, scan or photo.</p>
              <Link href="/app" className="mt-4 rounded-full bg-gold px-5 py-3 text-center text-[15px] font-medium text-white hover:bg-[#1c3bb8]">Open the app →</Link>
            </div>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-14">
          <Examples />
        </div>
      </section>

      {/* problems */}
      <section className="border-t lux-line">
        <div className="mx-auto grid max-w-6xl gap-px px-5 py-14 md:grid-cols-3">
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
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Head k="How it works" t="Set up a vendor once." em="Check every invoice in minutes." />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="lux-card lift rounded-3xl p-8">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-gold">{s.n}</span>
                  <span className="h-px flex-1 bg-[#17140f]/10" />
                  <Icon d={s.icon} className="h-5 w-5 text-[#17140f]/50" />
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
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Head k="Works with any agreement" t="If a vendor bills you against a contract," em="InvoiceGuard can read it." />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map(([t, how, checks], i) => (
              <div key={t} className="lux-card lift rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-[13px] font-semibold text-gold">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0"><div className="text-[17px] font-semibold leading-tight">{t}</div><div className="text-[13px] lux-muted">{how}</div></div>
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider lux-muted">What we check</div>
                <ul className="mt-2 space-y-2">
                  {checks.map((x) => <li key={x} className="flex items-start gap-2.5 text-[15px]"><svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>{x}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="personal" className="border-t lux-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2 md:items-center">
          <div>
            <Head k="For yourself" t="Your rent agreement," em="and every bill you sign up for." />
            <p className="mt-4 text-[15px] leading-relaxed lux-muted">Upload a rent agreement, a broadband plan, an insurance policy or a school fee letter. We tell you what you pay, when it goes up, when to give notice, and how your deposit comes back. Free for up to 3 agreements.</p>
            <Link href="/signup?for=me" className="mt-6 inline-block rounded-full bg-gold px-6 py-3 font-medium text-white hover:bg-[#1c3bb8]">Start for myself</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Rent goes up", "Reminder before the increase, and a check that it matches the agreed %"], ["Notice period", "The last date to give notice, so you don't pay an extra month"], ["Deposit", "What can be deducted and when it must be returned"], ["Renewal", "An alert before your 11 months end"]].map(([t, d]) => (
              <div key={t} className="lux-card rounded-2xl p-4"><div className="font-medium">{t}</div><div className="mt-1 text-[13px] lux-muted">{d}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* GST */}
      <section id="gst" className="border-t lux-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-2">
          <div>
            <Head k="GST" t="GST checked on" em="every invoice." />
            <p className="mt-5 text-[15px] leading-relaxed lux-muted">Even when the amount is right, the wrong tax type or a missing GSTIN can cost you input tax credit. We flag it and tell you what to ask the vendor to fix. These are checks to help your tax team, not a filing tool.</p>
          </div>
          <ul className="divide-y divide-[#17140f]/10 rounded-3xl border lux-line bg-[#fffdf9]">
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
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Head k="Teams" t="Bring in the people" em="who already have the numbers." />
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.r} className="lux-card rounded-2xl p-5">
                <div className="text-[16px] font-semibold">{r.r}</div>
                <div className="text-[13px] lux-muted">{r.d}</div>
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  {PERMS.map((p, i) => <li key={p} className={`flex items-center gap-2 ${r.p[i] ? "" : "lux-muted line-through decoration-[#17140f]/30"}`}><span className={`h-1.5 w-1.5 rounded-full ${r.p[i] ? "bg-gold" : "bg-[#17140f]/20"}`} />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t lux-line">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Head k="Pricing" t="Start free." em="Pay as you add vendors." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { n: "Free", p: "₹0", s: "forever", f: ["Up to 3 vendors", "Up to 3 users", "Unlimited invoices", "GST checks and reminders"], cta: "Start free" },
              { n: "Team", p: "₹1,499", s: "a month", f: ["First month free", "Up to 15 vendors", "5 users included", "₹99 per extra user a month", "₹149 per extra vendor a month", "Usage file import"], cta: "Try a month free", hi: true },
              { n: "Business", p: "Let's talk", s: "", f: ["Unlimited vendors and users", "Usage from vendor APIs", "Tally, Zoho or SAP export", "Single sign-on"], cta: "Contact us" },
            ].map((t) => (
              <div key={t.n} className={`flex flex-col rounded-3xl p-8 ${t.hi ? "bg-[#0e1a46] text-white" : "lux-card"}`}>
                <div className={`text-[13px] font-medium ${t.hi ? "text-[#f4efe6]/60" : "lux-muted"}`}>{t.n}</div>
                <div className="mt-3 flex items-baseline gap-2"><span className="font-serif text-[52px] leading-none">{t.p}</span><span className={t.hi ? "text-[#f4efe6]/50" : "lux-muted"}>{t.s}</span></div>
                <ul className={`mt-6 flex-1 space-y-2.5 text-[14px] ${t.hi ? "text-[#f4efe6]/75" : "lux-muted"}`}>
                  {t.f.map((f) => <li key={f} className="flex gap-2.5"><span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${t.hi ? "bg-gold" : "bg-gold"}`} />{f}</li>)}
                </ul>
                <Link href="/signup" className={`mt-8 rounded-full px-5 py-3 text-center text-[14px] font-medium ${t.hi ? "bg-white text-[#0e1a46]" : "border border-[#17140f]/20 hover:border-[#17140f]/60"}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="spot border-t lux-line">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <div className="font-serif text-[44px] leading-[1.02] md:text-[72px]">Try it on <em className="text-gold">one</em> agreement.</div>
          <p className="mt-4 lux-muted">Your documents are only used for your account.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-gold px-6 py-3 font-medium text-white">Start free</Link>
            <Link href="/app" className="rounded-full border border-[#17140f]/25 px-6 py-3 font-medium hover:border-[#17140f]">Upload an agreement</Link>
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
