# InvoiceGuard

**Every vendor bill, checked before you pay.**
Built at TPF Product (Un)Conference Builders Day, Bengaluru, 22 Nov 2026 · Request for Builders **#60, Catch Vendor Overbilling Before You Pay**.

## Try it (no login)
Live: **https://invoiceguard-ruby.vercel.app**
- **See how it works**: a 1-minute product video on the home page.
- **Try with sample vendor**: in the app, one tap loads a made-up KYC vendor (Nimbus KYC) and runs the real flow: AI reads the agreement, then the invoice, then counts the usage report. Expected result: 1,200 onboardings billed, 1,140 completed, **₹1,320 overbilled** plus ₹237.60 GST on it, and the ₹50,000 monthly minimum flagged.
- Sample files to upload yourself: [agreement](public/samples/nimbus-kyc-agreement.pdf), [invoice](public/samples/nimbus-kyc-invoice-oct-2026.pdf), [usage CSV](public/samples/nimbus-usage-oct-2026.csv). Nimbus KYC and Acme Fintech are fictional.
- Or upload your own agreement and invoice (PDF, Word, scan or photo).

## Problem
Finance and operations teams in India pay usage-based vendors every month: KYC, SMS/WhatsApp/email, payment gateways, cloud, SaaS. The agreement is signed once and rarely re-read. Nobody is sure whether billing is per message sent or delivered, or whether an abandoned KYC journey is billed in full. When the invoice arrives, finance has the bill and another team has the usage, and the two are rarely compared.

## What works today
1. **Understand the agreement** (PDF, Word, scans, photos): every charge, slab rule, billing event, minimums, one-time vs monthly fees, bundled steps, financial liabilities, a company-editable checklist, questions where terms are unclear, negotiation points, and a ready email to the vendor with points to clarify and changes to request. Each point can be marked Open, Discussed, Keep as it is, Ignore or Resolved. A final agreed version can replace the draft and keeps all settings.
2. **Who checks what**: one owner per charge, source (report/file or API), where it is used, utilisation notes for licences and fixed fees with monthly history. Usage files (CSV/Excel): AI proposes a counting rule from the columns and all distinct values; code validates the columns and counts every row; the rule is shown with file name and date.
3. **Invoice check**: lines mapped to the agreement and combined per charge; statuses Matches / Doesn't match / Waiting for usage / Not in agreement / Fixed fee OK; rate mismatch kept separate from unverified quantity; approval blocked until usage is confirmed; journey-wise breakup flag for bundled prices; slab table validation; credit notes; agreement-level minimum; duplicate check (number, or GSTIN + date + amount); GST checks (format, IGST vs CGST+SGST, tax arithmetic, GST on overbilled amount); payment and dispute deadlines from the agreement; issues list with statuses and a ready dispute email.
4. **Ask by voice**: questions about a vendor answered from its own agreement and invoice, spoken back in 8 Indian languages (ElevenLabs, browser voice as fallback).
5. **For myself mode**: rent and personal agreements with deposit, notice and end-date reminders.
6. **Dashboard and reminders**: all vendors, latest invoice, status, overbilled and recovered amounts, dispute outcomes remembered for next time; reminders for late invoices, payment due dates and closing dispute windows.

AI reads documents and proposes rules. Every amount is calculated by code.

## What's not built yet (labelled "Coming soon" in the app and video)
- Usage pulled straight from vendor APIs (today: usage report CSV/Excel or typed by the owner).
- Accounts, sign-up, team and invites are stored in the browser only. No server database or login yet, so roles are not enforced on the server.
- Invoices from email, live usage from vendor APIs, Tally/Zoho/SAP export, email/WhatsApp reminders.
- GSTIN is format-checked only, not verified on the GST portal. GST rate checks support the tax team; they are not tax advice.
- The comparison uses a quote the user enters; there is no benchmark database.

## Tools
Claude Code and the Claude API (Sonnet 5.5 for documents, Haiku 5.5 for short text and voice answers), ElevenLabs for speech, Next.js, TypeScript, Tailwind, Vercel. AI routes have a same-site check, size cap and per-IP rate limit.

## Run
```
npm install
ANTHROPIC_API_KEY=... npm run dev
```
