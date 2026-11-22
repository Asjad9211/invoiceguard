export type Role = "Admin" | "Approver" | "Owner" | "Viewer";
export interface Member { id: string; name: string; email: string; role: Role }
export interface Org { name: string; gstin: string; plan: string; members: Member[] }

const KEY = "invoiceguard.org";
export function loadOrg(): Org | null {
  try {
    const r = localStorage.getItem(KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
export function saveOrg(o: Org) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {}
}
export const DEMO_ORG: Org = {
  name: "Your company",
  gstin: "",
  plan: "Free",
  members: [{ id: "u1", name: "You", email: "", role: "Admin" }],
};
export const ROLE_INFO: Record<Role, string> = {
  Admin: "Company, billing, users, everything",
  Approver: "Approve or dispute invoices",
  Owner: "Verify usage for assigned vendors",
  Viewer: "Read-only for finance and audit",
};

export const DEFAULT_CHECKLIST = [
  "All charges and rates, including one-time and optional fees",
  "When each charge is billed (sent, delivered, started, completed)",
  "Slab rules and whether they apply to all units or per band",
  "Minimum commitment and what happens to a shortfall",
  "Advance payments, expiry and refund terms",
  "Payment terms and late payment interest or penalties",
  "Invoice dispute window and process",
  "Price change or escalation clause",
  "Term, auto-renewal and notice period",
  "Termination and exit costs",
  "Liability cap and indemnity",
  "SLA, uptime and service credits",
  "Usage reports the vendor must share",
  "Data protection and where data is stored",
];
