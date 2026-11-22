"use client";
export default function PlayDemo() {
  return (
    <button
      onClick={() => {
        const v = document.getElementById("demo-video") as HTMLVideoElement | null;
        if (!v) return;
        v.scrollIntoView({ behavior: "smooth", block: "center" });
        v.play().catch(() => {});
      }}
      className="rounded-full bg-gold px-7 py-3.5 text-[16px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(36,72,216,.7)] hover:bg-[#1c3bb8]"
    >
      ▶ Watch the full journey (1 min)
    </button>
  );
}
