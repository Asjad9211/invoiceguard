"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { saveOrg, type Org } from "@/lib/org";
import { isValidGstin } from "@/lib/gst";

export default function Signup() {
  const router = useRouter();
  const [f, setF] = useState({ company: "", gstin: "", name: "", email: "", plan: "Free", mode: "company" as "company" | "personal" });
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("for") === "me") setF((x) => ({ ...x, mode: "personal" })); }, []);
  const gstOk = !f.gstin || isValidGstin(f.gstin);
  const ok = (f.mode === "personal" || f.company) && f.name && /.+@.+\..+/.test(f.email) && gstOk;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok) return;
    const org: Org = { name: f.mode === "personal" ? f.name : f.company, gstin: f.mode === "personal" ? "" : f.gstin.toUpperCase(), plan: f.mode === "personal" ? "Personal" : f.plan, mode: f.mode, members: [{ id: "u1", name: f.name, email: f.email, role: "Admin" }] };
    saveOrg(org);
    router.push("/app?welcome=1");
  }
  const field = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt-100";

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <Link href="/"><Logo dark /></Link>
        <div>
          <div className="font-display text-4xl font-semibold leading-tight tracking-tight">Check every vendor bill<br />before you pay it.</div>
          <ul className="mt-6 space-y-2 text-white/75">
            <li>· See every charge in your vendor agreements</li>
            <li>· Give each charge an owner who confirms usage</li>
            <li>· Check usage, rates and GST on every invoice</li>
          </ul>
        </div>
        <div className="font-mono text-[11px] text-white/50">Free for 3 vendors · no card needed</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
          <div className="md:hidden"><Link href="/"><Logo /></Link></div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{f.mode === "personal" ? "Create your account" : "Create your company"}</h1>
            <p className="text-sm text-slate">{f.mode === "personal" ? "Keep track of your agreements and bills." : "You'll be the Admin. You can invite your team after this."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
            {([["company", "For my company"], ["personal", "For myself"]] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setF({ ...f, mode: k })} className={`rounded-lg px-3 py-2 text-sm font-medium ${f.mode === k ? "bg-white shadow-sm" : "text-slate"}`}>{l}</button>
            ))}
          </div>
          {f.mode === "personal" && <p className="text-[13px] text-slate">Rent, deposit, broadband, insurance, school fees or any bill with an agreement. Free for up to 3 agreements.</p>}
          {f.mode === "company" && <>
          <label className="block text-sm font-medium">Company name
            <input className={field} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Acme Finserv Pvt Ltd" autoComplete="organization" />
          </label>
          <label className="block text-sm font-medium">Company GSTIN <span className="font-normal text-slate">(optional, used for GST checks)</span>
            <input className={field} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="29AABCA1234F1Z5" maxLength={15} />
            {!gstOk && <span className="mt-1 block text-[13px] text-risk">GSTIN should be 15 characters, e.g. 29AABCA1234F1Z5</span>}
          </label>
          </>}
          <label className="block text-sm font-medium">Your name
            <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
          </label>
          <label className="block text-sm font-medium">{f.mode === "personal" ? "Email" : "Work email"}
            <input type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          </label>
          {f.mode === "company" && <fieldset>
            <legend className="text-sm font-medium">Plan</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {[["Free", "3 vendors"], ["Team", "₹1,499, 1st month free"], ["Business", "Talk to us"]].map(([p, price]) => (
                <button type="button" key={p} onClick={() => setF({ ...f, plan: p })} className={`rounded-md border px-2 py-2 text-left text-sm ${f.plan === p ? "border-cobalt bg-cobalt-50" : "border-line"}`}>
                  <div className="font-medium">{p}</div><div className="text-[12px] text-slate">{price}</div>
                </button>
              ))}
            </div>
          </fieldset>}
          {touched && !ok && <p className="text-[13px] text-risk">Please fill in your name and a valid email.</p>}
          <button className="w-full rounded-md bg-cobalt px-4 py-3 font-medium text-white hover:bg-[#2148e0]">{f.mode === "personal" ? "Create account" : "Create company"}</button>
          <p className="text-center text-[13px] text-slate">Just looking? <Link href="/app" className="underline">Try it with a sample agreement</Link></p>
        </form>
      </div>
    </div>
  );
}
