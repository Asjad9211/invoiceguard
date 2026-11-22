# InvoiceGuard

**Know what you should pay — before you pay it.**
Built at TPF Product (Un)Conference Builders Day, Bengaluru, 22 Nov 2026 · Request for Builders **#60 — Catch Vendor Overbilling Before You Pay**.

## The problem
Indian fintechs, NBFCs and AMCs pay usage-based vendors (SMS, WhatsApp, email, KYC APIs) every month. The agreement is signed once and never re-read. Nobody is sure whether billing is per message sent or delivered, or whether a KYC journey abandoned halfway is charged in full. When the invoice arrives, finance asks "is this right?" and no one owns the answer.

## What it does (one screen)
1. **Understand** — upload the agreement. Claude extracts every cost item (unit, billing event, slab mode, minimums, clause) and asks short tap-questions where terms are unclear. Bundled prices (e.g. one price per onboarding) are split into the steps they cover, and volume-slab traps are flagged.
2. **Source of truth** — each cost item gets an owner and the data they trust; the owner enters verified monthly usage.
3. **Invoice** — upload the invoice. Claude maps lines to the agreement; **code** computes what you should pay. Approve, or Dispute with a drafted email citing clauses and evidence.
4. **Negotiate** - what is worth asking the vendor to change, and a comparison against another quote you enter.

## How AI is used
- Claude: reads agreements and invoices (PDF or text) into structured JSON, writes clarifying questions, drafts verdict and dispute email.
- Code: every number — slab maths (volume vs graduated), cliffs, expected amount, money at risk. Deterministic and auditable.

## What's mocked
- Accounts, sign-up and team invites are saved in the browser only (no server-side accounts yet). Invite emails are not sent.
- Market comparison uses a quote the user enters; there is no benchmark database yet.
- Coming soon: email inbox fetch, API integrations for usage, Tally export, approval routing.

## Tools
Claude (Claude Code + Claude API, `claude-sonnet-5-5`), Next.js, TypeScript, Tailwind, Vercel.

## Run
```
npm install
ANTHROPIC_API_KEY=... npm run dev
```
