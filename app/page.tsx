import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";

const I = {
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  check: "M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  scale: "M12 3v18M5 7h14M7 7l-4 8a4 4 0 0 0 8 0zM17 7l-4 8a4 4 0 0 0 8 0z",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
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
  { n: "01", t: "Understand the agreement", d: "Upload any vendor agreement — PDF or text. Claude extracts every chargeable item: unit, rate, slabs, minimums, free tiers, and the exact clause. Vague terms become one-tap questions: sent or delivered? Per KYC step or per completed KYC?", icon: I.doc },
  { n: "02", t: "Assign a source of truth", d: "Each cost gets one owner and one source they trust — a vendor dashboard export, your own logs, or an API (soon). No more “who checked this bill?”.", icon: I.user },
  { n: "03", t: "Verify every invoice", d: "Upload or forward the invoice. Code — not AI — recomputes what you should pay from the agreement and verified usage, line by line, including GST. Approve in one click or dispute with a drafted email.", icon: I.receipt },
  { n: "04", t: "Pay less next time", d: "Spot volume-slab traps, unused minimum commitments and above-market rates. See what verified partner vendors charge — benchmarks never use your data.", icon: I.scale },
];

const GST = [
  ["GSTIN validity", "15-character format and checksum structure for supplier and buyer"],
  ["IGST vs CGST + SGST", "State codes decide: inter-state must be IGST, intra-state must be CGST + SGST — wrong type blocks your input tax credit"],
  ["Rate check", "Expected 18% on most digital services (SAC 9984/9983); flags 5%/12%/28% surprises"],
  ["Tax on the right base", "GST recomputed on the verified amount, so overbilling isn't taxed twice"],
  ["ITC readiness", "Buyer GSTIN present and correct, invoice number and date present — so you can claim credit"],
];

const ROLES = [
  { r: "Admin", d: "Manages company, billing and users", p: [1, 1, 1, 1, 1] },
  { r: "Approver", d: "Approves or disputes invoices", p: [1, 0, 1, 1, 1] },
  { r: "Owner", d: "Verifies usage for assigned vendors", p: [1, 0, 1, 0, 1] },
  { r: "Viewer", d: "Finance / audit read-only", p: [1, 0, 0, 0, 0] },
];
const PERMS = ["View", "Add vendors", "Verify usage", "Approve / dispute", "Comment"];

export default function Landing() {
  return (
    <div className="bg-white text-ink">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" aria-label="InvoiceGuard home"><Logo /></Link>
          <nav className="hidden gap-5 text-sm text-slate md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#gst" className="hover:text-ink">GST checks</a>
            <a href="#teams" className="hover:text-ink">Teams & roles</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/app" className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-paper sm:block">Open demo</Link>
            <Link href="/signup" className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink-2">Start free</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="grid-bg border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-12 md:py-20">
          <div className="md:col-span-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-slate">
              <span className="h-1.5 w-1.5 rounded-full bg-cobalt" /> Vendor bill verification · India
            </div>
            <h1 className="font-display text-[40px] font-semibold leading-[1.02] tracking-tight md:text-[60px]">
              Know what you<br />should pay —<br /><span className="text-cobalt">before you pay it.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-slate">
              InvoiceGuard reads your vendor agreements, makes every cost unambiguous, assigns who verifies it, and checks each invoice — usage, slabs and GST — before money leaves your account.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-md bg-cobalt px-5 py-3 font-medium text-white hover:bg-[#2148e0]">
                Create your company <Icon d={I.arrow} className="h-4 w-4" />
              </Link>
              <Link href="/app" className="rounded-md border border-ink/15 bg-white px-5 py-3 font-medium hover:border-ink/40">Try with a sample agreement</Link>
            </div>
            <p className="mt-4 font-mono text-[11px] text-slate">No card · Built for SMS, WhatsApp, email, KYC, payment & cloud vendors</p>
          </div>

          {/* product preview */}
          <div className="md:col-span-6">
            <div className="rounded-xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(11,18,32,.35)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
                <span className="font-medium">PingWave Communications</span>
                <span className="text-slate">· Oct 2026 invoice</span>
                <span className="ml-auto rounded bg-risk-50 px-2 py-0.5 font-mono text-[11px] text-risk">DISPUTE</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                {[["Invoiced", "₹95,960"], ["Should be", "₹77,240"], ["At risk", "₹18,720"]].map(([k, v], i) => (
                  <div key={k} className="px-4 py-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-slate">{k}</div>
                    <div className={`tnum font-display text-2xl font-semibold ${i === 2 ? "text-risk" : ""}`}>{v}</div>
                  </div>
                ))}
              </div>
              <ul className="divide-y divide-line text-sm">
                {[
                  ["Transactional SMS", "Billed 4,20,000 · verified 3,70,000", "+₹7,500"],
                  ["WhatsApp utility", "Billed at marketing rate ₹0.88 vs ₹0.195", "+₹8,220"],
                  ["Platform support", "Not in agreement — clause A.5", "+₹3,000"],
                  ["GST", "IGST 18% correct · inter-state 27 → 29", "✓"],
                ].map(([a, b, c]) => (
                  <li key={a} className="flex items-start gap-3 px-4 py-2.5">
                    <div className="flex-1">
                      <div className="font-medium">{a}</div>
                      <div className="text-[12px] text-slate">{b}</div>
                    </div>
                    <div className={`tnum font-mono text-[13px] ${c === "✓" ? "text-ok" : "text-risk"}`}>{c}</div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 border-t border-line p-3">
                <span className="flex-1 rounded-md bg-risk px-3 py-2 text-center text-sm font-medium text-white">Dispute ₹18,720</span>
                <span className="flex-1 rounded-md border border-line px-3 py-2 text-center text-sm">Approve ₹77,240</span>
              </div>
            </div>
            <p className="mt-2 text-right font-mono text-[10px] text-slate">Illustrative data</p>
          </div>
        </div>
      </section>

      {/* problem strip */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-4 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            ["Signed once, never re-read", "Agreements say “per message processed”. Is that sent or delivered? Nobody knows when the bill arrives."],
            ["No one owns the number", "Finance asks “is this right?”. Marketing has the dashboard. The invoice gets paid anyway."],
            ["Slabs quietly cost more", "Under volume pricing, 9,500 calls at ₹1 cost more than 10,001 calls at ₹0.90."],
          ].map(([t, d]) => (
            <div key={t} className="py-7 md:px-6 first:md:pl-0">
              <div className="font-display text-lg font-semibold">{t}</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how */}
      <section id="how" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="How it works" t="Four steps. Two of them happen once." />
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
            <div className="md:col-span-1">
              <div className="font-mono text-[11px] uppercase tracking-wider text-cobalt-100">Why it's trustworthy</div>
              <div className="mt-2 font-display text-xl font-semibold">AI reads. Code calculates.</div>
            </div>
            <p className="text-sm leading-relaxed text-white/75 md:col-span-2">
              Claude interprets messy agreements and invoices into structured rules. Every rupee you see — slab maths, expected amount, GST, money at risk — is computed by deterministic code and linked back to the clause and the usage row it came from. You can explain every number to your CFO or auditor.
            </p>
          </div>
        </div>
      </section>

      {/* GST */}
      <section id="gst" className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionHead k="GST checks — on by default" t="Every invoice is GST-checked before it reaches approval." />
            <p className="mt-4 text-[15px] leading-relaxed text-slate">A wrong tax type or a missing GSTIN means lost input tax credit — real money even when the base amount is right. InvoiceGuard flags it and tells you exactly what to ask the vendor to fix.</p>
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
            <p className="mt-2 font-mono text-[11px] text-slate">Coming soon: GSTR-2B match to confirm the vendor actually filed.</p>
          </div>
        </div>
      </section>

      {/* teams */}
      <section id="teams" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="Teams & roles" t="Sign up your company in a minute. Invite the people who already own the data." />
          <div className="mt-10 grid gap-6 md:grid-cols-12">
            <ol className="space-y-4 md:col-span-4">
              {[
                ["Create your company", "Company name, GSTIN and your work email. You become the Admin."],
                ["Invite your team", "Add approvers from finance, and owners from marketing, product or IT. Each sees only what they need."],
                ["Assign vendors", "Owners get a nudge when an invoice needs their verified number. Approvers get one button."],
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
                    {PERMS.map((p) => <th key={p} className="px-3 py-3 text-center font-mono text-[11px] font-normal uppercase tracking-wide text-slate">{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r.r} className="border-t border-line">
                      <td className="px-4 py-3"><div className="font-medium">{r.r}</div><div className="text-[12px] text-slate">{r.d}</div></td>
                      {r.p.map((v, i) => <td key={i} className="px-3 py-3 text-center">{v ? <span className="text-cobalt" aria-label="allowed">●</span> : <span className="text-line" aria-label="not allowed">○</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHead k="Pricing" t="Pay for the vendors you protect — not for people who log in twice a month." />
          <p className="mt-3 max-w-2xl text-[15px] text-slate">Approvers and owners use InvoiceGuard a few minutes a month, so seats are cheap. Value grows with the number of vendor relationships you verify, so that's what the plans scale on.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: "Team", p: "$19", s: "/month", f: ["5 users included", "10 vendors", "Unlimited invoices", "GST checks", "+$2 / extra user / month", "+$3 / extra vendor / month"], cta: "Start free for 14 days", hi: false },
              { n: "Growth", p: "$79", s: "/month", f: ["25 users included", "50 vendors", "Email inbox intake", "Approval routing", "+$1.50 / extra user", "Market benchmarks"], cta: "Start free for 14 days", hi: true },
              { n: "Enterprise", p: "Custom", s: "", f: ["Unlimited users & vendors", "API usage integrations", "Tally / SAP / Zoho sync", "SSO & audit log", "GSTR-2B reconciliation", "Dedicated onboarding"], cta: "Talk to us", hi: false },
            ].map((t) => (
              <div key={t.n} className={`flex flex-col rounded-xl border p-6 ${t.hi ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg font-semibold">{t.n}</div>
                  {t.hi && <span className="rounded-full bg-cobalt px-2 py-0.5 font-mono text-[10px] uppercase">Most teams</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1"><span className="font-display text-4xl font-semibold">{t.p}</span><span className={t.hi ? "text-white/60" : "text-slate"}>{t.s}</span></div>
                <ul className={`mt-5 flex-1 space-y-2 text-sm ${t.hi ? "text-white/80" : "text-slate"}`}>
                  {t.f.map((f) => <li key={f} className="flex gap-2"><Icon d={I.check} className={`h-4 w-4 shrink-0 ${t.hi ? "text-cobalt-100" : "text-cobalt"}`} />{f}</li>)}
                </ul>
                <Link href="/signup" className={`mt-6 rounded-md px-4 py-2.5 text-center text-sm font-medium ${t.hi ? "bg-cobalt text-white hover:bg-[#2148e0]" : "border border-ink/15 hover:border-ink/40"}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-dashed border-ink/20 bg-white p-5 md:flex-row md:items-center">
            <Icon d={I.shield} className="h-6 w-6 shrink-0 text-cobalt" />
            <div className="text-sm"><b>Savings guarantee.</b> <span className="text-slate">If InvoiceGuard doesn't flag at least 3× your subscription in billing issues within 90 days, we refund you.</span></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Upload one agreement. See what you've been missing.</div>
            <p className="mt-2 text-white/70">Takes under a minute. Your documents are only used to analyse your account.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app" className="rounded-md bg-cobalt px-5 py-3 font-medium hover:bg-[#2148e0]">Analyse an agreement</Link>
            <Link href="/signup" className="rounded-md border border-white/25 px-5 py-3 font-medium hover:border-white/60">Create company</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2 text-white"><LogoMark size={22} /> InvoiceGuard</span>
          <span className="md:ml-4">Built at TPF Builders Day 2026 · RFB #60</span>
          <span className="md:ml-auto font-mono text-[11px]">Demo build · sample data is illustrative</span>
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
