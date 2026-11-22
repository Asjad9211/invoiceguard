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
  name: "Acme Finserv Pvt Ltd",
  gstin: "29AABCA1234F1Z5",
  plan: "Team",
  members: [
    { id: "u1", name: "You", email: "you@acmefinserv.in", role: "Admin" },
    { id: "u2", name: "Priya (Marketing Ops)", email: "priya@acmefinserv.in", role: "Owner" },
    { id: "u3", name: "Rohan (Onboarding PM)", email: "rohan@acmefinserv.in", role: "Owner" },
    { id: "u4", name: "Meera (Finance)", email: "meera@acmefinserv.in", role: "Approver" },
  ],
};
export const ROLE_INFO: Record<Role, string> = {
  Admin: "Company, billing, users, everything",
  Approver: "Approve or dispute invoices",
  Owner: "Verify usage for assigned vendors",
  Viewer: "Read-only for finance and audit",
};
