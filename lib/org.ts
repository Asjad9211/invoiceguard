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
