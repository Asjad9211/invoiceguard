"use client";
import { useEffect, useRef, useState } from "react";

const LANGS: [string, string, string][] = [
  ["en-IN", "English", "English"], ["hi-IN", "हिन्दी", "Hindi"], ["mr-IN", "मराठी", "Marathi"], ["ta-IN", "தமிழ்", "Tamil"],
  ["te-IN", "తెలుగు", "Telugu"], ["bn-IN", "বাংলা", "Bengali"], ["gu-IN", "ગુજરાતી", "Gujarati"], ["kn-IN", "ಕನ್ನಡ", "Kannada"],
];

type Rec = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export default function AskVoice({ context, vendor }: { context: unknown; vendor: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const rec = useRef<Rec | null>(null);
  const [canListen, setCanListen] = useState(false);
  useEffect(() => { setCanListen(typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)); }, []);

  const audio = useRef<HTMLAudioElement | null>(null);
  async function say(text: string) {
    if (!speak || typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) {
        const url = URL.createObjectURL(await r.blob());
        audio.current = new Audio(url);
        await audio.current.play();
        return;
      }
    } catch {}
    browserSay(text);
  }
  function browserSay(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang === lang) || window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setQ("");
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, language: LANGS.find((l) => l[0] === lang)?.[2] || "English", context, history: chat }) });
      const j = await r.json();
      const a = j.answer || j.error || "Sorry, I couldn't answer that.";
      setChat((c) => [...c, { q: question, a }]);
      say(a);
    } catch {
      setChat((c) => [...c, { q: question, a: "Something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const W = window as unknown as Record<string, new () => Rec>;
    const R = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = lang;
    r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0][0].transcript; ask(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  const starters = ["What am I paying for?", "Is this invoice correct?", "What should I negotiate?", "When is payment due?"];

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-medium text-white shadow-xl hover:bg-[#1c3bb8]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        Ask about {vendor.length > 18 ? "this vendor" : vendor}
      </button>
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl md:inset-x-auto md:right-4 md:bottom-4 md:w-[400px]">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="min-w-0"><div className="font-semibold">Ask InvoiceGuard</div><div className="truncate text-[12px] text-slate">{vendor}</div></div>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="ml-auto rounded-full border border-line px-2 py-1 text-[13px]" aria-label="Language">
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
            <button onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); audio.current?.pause(); }} className="rounded-full px-2 py-1 text-slate hover:bg-paper" aria-label="Close">✕</button>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-3">
            {chat.length === 0 && (
              <div>
                <div className="text-[13px] text-slate">Ask by voice or text, in English or your language. Answers come from this vendor&apos;s agreement and invoice.</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{starters.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1 text-[13px] hover:border-ink/40">{s}</button>)}</div>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-gold px-3 py-2 text-[14px] text-white">{m.q}</div>
                <div className="flex items-start gap-1.5">
                  <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-paper px-3 py-2 text-[14px]">{m.a}</div>
                  <button onClick={() => say(m.a)} className="mt-1 text-[12px] text-cobalt" aria-label="Play answer">▶</button>
                </div>
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl bg-paper px-3 py-2 text-[14px] text-slate">Thinking…</div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2 border-t border-line p-2">
            {canListen && (
              <button type="button" onClick={() => (listening ? rec.current?.stop() : listen())} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${listening ? "animate-pulse bg-risk text-white" : "bg-cobalt text-white"}`} aria-label={listening ? "Stop listening" : "Speak"}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? "Listening…" : "Type a question"} className="min-w-0 flex-1 rounded-full border border-line px-3 py-2" />
            <button type="button" onClick={() => { setSpeak(!speak); window.speechSynthesis?.cancel(); audio.current?.pause(); }} className="rounded-full px-2 py-1 text-[12px] text-slate" aria-label="Toggle spoken answers">{speak ? "🔊" : "🔇"}</button>
          </form>
        </div>
      )}
    </>
  );
}
