// Illustrative sample documents for demo. Not real vendor records.

export const SAMPLES = {
  messaging: {
    label: "Messaging vendor (SMS · WhatsApp · Email)",
    agreement: `MASTER SERVICES AGREEMENT — MESSAGING SERVICES
Between: Acme Finserv Pvt Ltd ("Customer") and PingWave Communications Pvt Ltd ("Provider")
Effective: 1 April 2026. Term: 24 months, auto-renews for 12 months unless terminated with 90 days' notice.

Schedule A — Commercials (all prices exclusive of GST @18%)

A.1 Transactional SMS (DLT-registered, 160 characters per message part)
Charges are levied per message processed by the Provider's platform.
Slab pricing for monthly volume:
  1 – 1,00,000 messages: ₹0.18 per message
  1,00,001 – 5,00,000 messages: ₹0.15 per message
  Above 5,00,000 messages: ₹0.13 per message
The applicable slab rate shall apply to the entire monthly volume.
DLT scrubbing charges are included in the above rates.

A.2 WhatsApp Business messages
Utility template messages: Meta conversation charge ₹0.145 + Provider platform fee ₹0.05 = ₹0.195 per delivered message.
Marketing template messages: ₹0.88 per delivered message (inclusive of Provider fee).
Authentication template messages: ₹0.145 per delivered message.

A.3 Email (transactional)
Per email: 1 – 5,00,000 emails per month: ₹0.025 per email; above 5,00,000: ₹0.02 per email. The applicable slab rate applies to all emails in the month.
Email platform fee: ₹5,000 per month (fixed).

A.4 Minimum commitment: Customer commits to a minimum monthly billing of ₹25,000 across all services. Any shortfall shall be invoiced.

A.5 No other charges shall be levied without prior written approval of the Customer.

Clause 7 — Invoicing: Provider will invoice monthly in arrears with usage reports. Customer may dispute any invoice within 15 days with supporting evidence.`,
    invoice: `TAX INVOICE
PingWave Communications Pvt Ltd · GSTIN 27AABCP1234Q1Z5
Invoice No: PW/2026-27/1184   Date: 01-Nov-2026   Period: October 2026
Bill to: Acme Finserv Pvt Ltd · GSTIN 29AABCA1234F1Z5 (Karnataka)
SAC: 998422

Line items:
1. Transactional SMS — 4,20,000 messages @ ₹0.15 = ₹63,000.00
2. WhatsApp Utility messages — 12,000 @ ₹0.88 = ₹10,560.00
3. WhatsApp Authentication messages — 20,000 @ ₹0.145 = ₹2,900.00
4. Transactional Email — 4,60,000 @ ₹0.025 = ₹11,500.00
5. Email platform fee — 1 month @ ₹5,000 = ₹5,000.00
6. Platform support charges — 1 @ ₹3,000 = ₹3,000.00

Subtotal: ₹95,960.00
IGST @18%: ₹17,272.80
Total payable: ₹1,13,232.80`,
    usageByKeyword: [
      { match: /platform|fee/i, qty: 1 },
      { match: /sms/i, qty: 370000 },
      { match: /utility/i, qty: 12000 },
      { match: /auth/i, qty: 20000 },
      { match: /marketing/i, qty: 0 },
      { match: /e-?mail/i, qty: 460000 },
    ],
  },
  kyc: {
    label: "KYC vendor (per-step APIs)",
    agreement: `SERVICE AGREEMENT — DIGITAL KYC APIs
Between: Acme Finserv Pvt Ltd ("Client") and VerifyFast Technologies Pvt Ltd ("Vendor")
Effective 1 June 2026, 12 months.

Pricing (exclusive of GST @18%), billed monthly:
1. Aadhaar OTP eKYC — ₹3.00 per API call.
2. PAN verification — ₹2.00 per successful verification.
3. Face match / liveness — ₹1.50 per API call.
4. Video KYC (V-CIP) — ₹40.00 per session.
5. Monthly platform & dashboard fee — ₹7,500 per month.

Each API is billed independently. A customer journey that is abandoned midway shall be billed only for the APIs invoked.
Volume discounts: none in this term.
Vendor shall provide a monthly usage report with session-level status.`,
    invoice: `TAX INVOICE
VerifyFast Technologies Pvt Ltd · GSTIN 07AAFCV5678K1Z2 (Delhi)
Invoice No: VF-1029   Date: 02-Nov-2026   Period: October 2026
Bill to: Acme Finserv Pvt Ltd · GSTIN 29AABCA1234F1Z5
SAC: 998319

1. Aadhaar OTP eKYC — 5,000 calls @ ₹3.00 = ₹15,000
2. PAN verification — 5,000 @ ₹2.00 = ₹10,000
3. Face match / liveness — 3,600 @ ₹1.50 = ₹5,400
4. Video KYC sessions — 5,000 @ ₹40.00 = ₹2,00,000
5. Platform & dashboard fee — 1 month = ₹7,500

Subtotal: ₹2,37,900
CGST @9%: ₹21,411
SGST @9%: ₹21,411
Total: ₹2,80,722`,
    usageByKeyword: [
      { match: /otp|aadhaar/i, qty: 5000 },
      { match: /pan/i, qty: 4200 },
      { match: /face|liveness/i, qty: 3600 },
      { match: /video|v-cip|vkyc/i, qty: 2800 },
      { match: /platform|dashboard/i, qty: 1 },
    ],
  },
};

// Illustrative market benchmarks (₹ per unit, pre-GST). Seeded for demo — not your data.
export const BENCHMARKS: { match: RegExp; label: string; rate: number; vendor: string }[] = [
  { match: /sms/i, label: "Transactional SMS", rate: 0.12, vendor: "Vendor A (verified partner)" },
  { match: /utility/i, label: "WhatsApp utility", rate: 0.165, vendor: "Vendor B (verified partner)" },
  { match: /email/i, label: "Transactional email", rate: 0.018, vendor: "Vendor C (verified partner)" },
  { match: /video|v-cip/i, label: "Video KYC session", rate: 32, vendor: "Vendor D (verified partner)" },
  { match: /aadhaar|otp/i, label: "Aadhaar OTP eKYC", rate: 2.5, vendor: "Vendor D (verified partner)" },
];
