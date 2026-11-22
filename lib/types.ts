export type BillingEvent =
  | "sent"
  | "delivered"
  | "attempted"
  | "per_call"
  | "per_success"
  | "per_month"
  | "unclear";

export type PricingMode = "flat" | "volume" | "graduated" | "fixed";

export interface Slab {
  from: number;
  to: number | null; // null = no upper limit
  rate: number; // ₹ per unit (or ₹ per month for fixed)
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  answer?: string;
}

export interface CostItem {
  id: string;
  name: string;
  category: string; // e.g. SMS, WhatsApp, Email, KYC step, Platform fee
  unit: string; // e.g. "delivered SMS", "API call", "month"
  billingEvent: BillingEvent;
  plainEnglish: string; // one-line explanation for the user
  pricing: { mode: PricingMode; slabs: Slab[] };
  minCommitment: number | null; // ₹ per month minimum, if any
  freeUnits: number | null;
  taxPct: number | null;
  clause: string; // clause reference or quote
  questions: Question[];
  includes?: string[]; // APIs/steps bundled into this charge
  recurring?: "monthly" | "one_time" | "on_request";
  quoteRate?: number;
  // set by user
  owner?: string;
  sourceOfTruth?: "manual" | "api";
  sourceNote?: string;
  actualQty?: number;
}

export interface Agreement {
  vendor: string;
  service: string;
  period: string;
  summary: string;
  costItems: CostItem[];
  risks: string[];
  suggestions?: string[];
  negotiate?: { type: string; item: string; ask: string; why: string }[];
}

export interface InvoiceLine {
  description: string;
  costItemId: string | null;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  vendor: string;
  invoiceNo: string;
  date: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  supplierGstin?: string | null;
  buyerGstin?: string | null;
  sac?: string | null;
  taxLines?: { type: "IGST" | "CGST" | "SGST" | "GST"; ratePct: number; amount: number }[];
}

export interface Vendor {
  id: string;
  agreement: Agreement;
  invoice?: Invoice;
  status: "setup" | "ready" | "approved" | "disputed";
  disputeEmail?: string;
}
