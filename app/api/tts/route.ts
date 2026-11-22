import { guard } from "@/lib/guard";

export const maxDuration = 30;

// Natural speech via ElevenLabs when ELEVENLABS_API_KEY is set. The client falls back to the browser voice otherwise.
export async function POST(req: Request) {
  const blocked = guard(req, 30);
  if (blocked) return blocked;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 501 });
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ error: "empty" }, { status: 400 });
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq3qXAvO";
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.slice(0, 1500), model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
  });
  if (!r.ok) return Response.json({ error: `tts ${r.status}` }, { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
