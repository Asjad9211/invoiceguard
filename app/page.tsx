import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";

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
  { n: "01", t: "Read the agreement", d: "Upload a vendor agreement, order form or rate card. We list every charge in it: the rate, the slabs, minimums, free units and the clause it comes from. If something is vague, like whether SMS is billed when sent or when delivered, we ask you.", icon: I.doc },
  { n: "02", t: "Decide who checks what", d: "For each charge, pick one person from your team and the report they trust, such as the vendor dashboard or your own logs. That person confirms the real usage each month.", icon: I.user },
  { n: "03", t: "Check the invoice", d: "Upload the invoice. We work out what you should pay from the agreement and the confirmed usage, line by line, and check the GST. You approve it, or send a dispute email we draft for you.", icon: I.receipt },
  { n: "04", t: "Know what to negotiate", d: "We point out what is worth asking the vendor to change: fixed fees, slab rules, minimum commitments, how failed calls are billed and rate locks.", icon: I.tag },
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
    <div className="bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" aria-label="InvoiceGuard home"><Logo /></Link>
          <nav className="hidden gap-5 text-sm text-slate md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#gst" className="hover:text-ink">GST</a>
            <a href="#teams" className="hover:text-ink">Teams</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/app" className="hidden rounded-md px-3 py-2 text-sm font-medium hover:bg-paper sm:block">Log in</Link>
            <Link href="/signup" className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink-2">Sign up free</Link>
          </div>
        </div>
      </header>

      <section className="grid-bg border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-12 md:py-20">
          <div className="md:col-span-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-slate">
              <span className="h-1.5 w-1.5 rounded-full bg-cobalt" /> For finance and ops teams in India
            </div>
            <h1 className="font-display text-[40px] font-semibold leading-[1.03] tracking-tight md:text-[58px]">
              Check every vendor bill<br /><span className="text-cobalt">before you pay it.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-slate">
              Upload your vendor agreement once. Each month, upload the invoice. InvoiceGuard shows you what you should have been charged, where the bill is off, and whether the GST is right.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-md bg-cobalt px-5 py-3 font-medium text-white hover:bg-[#2148e0]">
                Start free <Icon d={I.arrow} className="h-4 w-4" />
              </Link>
              <Link href="/app" className="rounded-md border border-ink/15 bg-white px-5 py-3 font-medium hover:border-ink/40">See it with a sample</Link>
            </div>
            <p className="mt-4 text-sm text-slate">Free for your first 3 vendors. No card needed.</p>
          </div>

          <div className="md:col-span-6">
            <div className="rounded-xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(11,18,32,.35)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
                <span className="font-medium">KYC vendor agreement</span>
                <span className="ml-auto rounded bg-cobalt-50 px-2 py-0.5 font-mono text-[11px] text-cobalt">READ BY INVOICEGUARD</span>
              </div>
              <div className="px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate">Charge found</div>
                <div className="mt-0.5 font-medium">Price per onboarding</div>
                <div className="text-[13px] text-slate">One price covers 15 steps: PAN OCR, Aadhaar OCR, video, face match and more</div>
              </div>
              <div className="border-t border-line bg-cobalt-50/60 px-4 py-3">
                <div className="text-[13px] font-medium">The agreement doesn't say:</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                  {["Billed when started or completed?", "Drop-offs billed in full?", "Retries counted again?"].map((q) => <span key={q} className="rounded-md border border-cobalt-100 bg-white px-2 py-1">{q}</span>)}
                </div>
              </div>
              <ul className="divide-y divide-line border-t border-line text-sm">
                {[
                  ["Invoice check", "Onboardings billed vs onboardings your team confirms"],
                  ["GST check", "Same state, so CGST + SGST expected"],
                  ["Worth negotiating", "Pay per step for journeys that drop off midway"],
                ].map(([a, b]) => (
                  <li key={a} className="flex items-start gap-3 px-4 py-2.5">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /></svg>
                    <div><div className="font-medium">{a}</div><div className="text-[12px] text-slate">{b}</div></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-4 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            ["The agreement is vague", "It says “per message processed”. Does that include failed messages? Most teams only find out when they argue about a bill."],
            ["Nobody owns the number", "Finance has the invoice. Marketing or product has the usage data. The bill often gets paid without anyone comparing the two."],
            ["Bundles hide the real cost", "Many vendors charge one price per journey. If a customer drops off halfway, you may still be paying for the whole journey."],
          ].map(([t, d]) => (
            <div key={t} className="py-7 md:px-6 md:first:pl-0">
              <div className="font-display text-lg font-semibold">{t}</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="How it works" t="Set up a vendor once. Check each invoice in a few minutes." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white p-6">
                <div className="flex items-center justify-between text-cobalt">
                  <Icon d={s.icon} className="h-6 w-6" />
                  <span className="font-mono text-xs text-slate">{s.n}</span>
                </div>
                <div className="mt-5 font-display text-lg font-semibold leading-snug">{s.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 rounded-xl bg-ink p-6 text-white md:grid-cols-3">
            <div className="font-display text-xl font-semibold">How the numbers are worked out</div>
            <p className="text-sm leading-relaxed text-white/75 md:col-span-2">
              We use Claude, an AI model, to read agreements and invoices. The amounts themselves, like slab maths, what you should pay and GST, are calculated by plain code. Every number links back to a clause or a usage figure, so you can check it yourself.
            </p>
          </div>
        </div>
      </section>

      <section id="gst" className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionHead k="GST" t="GST is checked on every invoice." />
            <p className="mt-4 text-[15px] leading-relaxed text-slate">Even when the amount is right, the wrong tax type or a missing GSTIN can cost you input tax credit. We tell you what to ask the vendor to fix.</p>
          </div>
          <div className="md:col-span-7">
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              {GST.map(([t, d]) => (
                <div key={t} className="flex gap-4 border-b border-line px-5 py-4 last:border-0">
                  <Icon d={I.check} className="mt-0.5 h-5 w-5 shrink-0 text-cobalt" />
                  <div>
                    <div className="font-medium">{t}</div>
                    <div className="text-sm text-slate">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="teams" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="Teams" t="Bring in the people who already have the numbers." />
          <div className="mt-10 grid gap-6 md:grid-cols-12">
            <ol className="space-y-4 md:col-span-4">
              {[
                ["Sign up your company", "Company name, GSTIN and your work email. You become the Admin."],
                ["Invite your team", "Add someone from finance to approve, and the people in marketing, product or IT who can see usage."],
                ["Give each vendor an owner", "The owner confirms usage each month. The approver then approves or disputes."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/15 font-mono text-xs">{i + 1}</span>
                  <div>
                    <div className="font-medium">{t}</div>
                    <div className="text-sm text-slate">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="overflow-x-auto rounded-xl border border-line md:col-span-8">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Role</th>
                    {PERMS.map((p) => <th key={p} className="px-3 py-3 text-center text-[12px] font-medium text-slate">{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r.r} className="border-t border-line">
                      <td className="px-4 py-3"><div className="font-medium">{r.r}</div><div className="text-[12px] text-slate">{r.d}</div></td>
                      {r.p.map((v, i) => <td key={i} className="px-3 py-3 text-center">{v ? <Icon d={I.check} className="mx-auto h-5 w-5 text-cobalt" /> : <span className="text-slate/40" aria-label="no">·</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="Pricing" t="Start free. Pay when you add more vendors." />
          <p className="mt-3 max-w-2xl text-[15px] text-slate">Most people on your team will log in once or twice a month, so extra users are cheap. Paid plans start with a free month.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: "Free", p: "$0", s: "forever", f: ["Up to 3 vendors", "Up to 3 users", "Unlimited invoices", "GST checks"], cta: "Start free" },
              { n: "Team", p: "$19", s: "/month", f: ["First month free", "Up to 15 vendors", "5 users included", "$2 per extra user a month", "$3 per extra vendor a month"], cta: "Try a month free", hi: true },
              { n: "Business", p: "Let's talk", s: "", f: ["Unlimited vendors and users", "Pull usage from vendor APIs", "Tally, Zoho or SAP export", "Single sign-on"], cta: "Contact us" },
            ].map((t) => (
              <div key={t.n} className={`flex flex-col rounded-xl border p-6 ${t.hi ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                <div className="font-display text-lg font-semibold">{t.n}</div>
                <div className="mt-3 flex items-baseline gap-1"><span className="font-display text-4xl font-semibold">{t.p}</span><span className={t.hi ? "text-white/60" : "text-slate"}>{t.s}</span></div>
                <ul className={`mt-5 flex-1 space-y-2 text-sm ${t.hi ? "text-white/80" : "text-slate"}`}>
                  {t.f.map((f) => <li key={f} className="flex gap-2"><Icon d={I.check} className={`h-4 w-4 shrink-0 ${t.hi ? "text-cobalt-100" : "text-cobalt"}`} />{f}</li>)}
                </ul>
                <Link href="/signup" className={`mt-6 rounded-md px-4 py-2.5 text-center text-sm font-medium ${t.hi ? "bg-cobalt text-white hover:bg-[#2148e0]" : "border border-ink/15 hover:border-ink/40"}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Try it on one of your agreements.</div>
            <p className="mt-2 text-white/70">Your documents are only used for your account.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/signup" className="rounded-md bg-cobalt px-5 py-3 font-medium hover:bg-[#2148e0]">Start free</Link>
            <Link href="/app" className="rounded-md border border-white/25 px-5 py-3 font-medium hover:border-white/60">See a sample</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2 text-white"><LogoMark size={22} /> InvoiceGuard</span>
          <span className="md:ml-auto">Made in Mumbai</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ k, t }: { k: string; t: string }) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] uppercase tracking-wider text-cobalt">{k}</div>
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight md:text-[40px]">{t}</h2>
    </div>
  );
}
