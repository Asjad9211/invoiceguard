import { guard } from "@/lib/guard";

export const maxDuration = 30;

// Natural speech via ElevenLabs when ELEVENLABS_API_KEY is set. The client falls back to the browser voice otherwise.
export async function POST(req: Request) {
  const blocked = guard(req, 30);
  if (blocked) return blocked;
  const key = process.env.ELEVENLABS_API_KEY || process.env.Eleven_Labs || process.env.ELEVEN_LABS;
  if (!key) return Response.json({ error: "no-key" }, { status: 501 });
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ error: "empty" }, { status: 400 });
  const voice = process.env.ELEVENLABS_VOICE_ID || (await pickVoice(key));
  if (!voice) return Response.json({ error: "no voice found in ElevenLabs account" }, { status: 502 });
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.slice(0, 1500), model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
  });
  if (!r.ok) return Response.json({ error: `tts ${r.status}` }, { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}

let cachedVoice: string | null = null;
async function pickVoice(key: string): Promise<string | null> {
  if (cachedVoice) return cachedVoice;
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!r.ok) return null;
  const j = (await r.json()) as { voices?: { voice_id: string; name: string; category?: string }[] };
  const list = j.voices || [];
  const pick = list.find((v) => /india|hindi/i.test(v.name)) || list.find((v) => v.category === "premade") || list[0];
  cachedVoice = pick?.voice_id || null;
  return cachedVoice;
}
