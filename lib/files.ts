"use client";
export type Doc = { text?: string; pdfBase64?: string; docxBase64?: string; images?: string[] };

const LIMIT = 3_000_000; // keep request bodies under Vercel's 4.5 MB

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function canvasToJpeg(c: HTMLCanvasElement) {
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

async function imageFile(f: File) {
  const url = URL.createObjectURL(f);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return canvasToJpeg(c);
}

async function pdfFallback(f: File): Promise<Doc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    text += `\n--- Page ${p} ---\n` + tc.items.map((i) => ("str" in i ? i.str : "")).join(" ");
  }
  if (text.replace(/\s|-|Page \d+/g, "").length > 400) return { text: text.slice(0, 400_000) };
  // scanned PDF: send page images (first 12 pages)
  const images: string[] = [];
  let total = 0;
  for (let p = 1; p <= Math.min(pdf.numPages, 12); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1.4 });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    const img = await canvasToJpeg(c);
    total += img.length;
    if (total > LIMIT) break;
    images.push(img);
  }
  return { images };
}

export async function fileToDoc(f: File): Promise<Doc> {
  const name = f.name.toLowerCase();
  if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/.test(name)) return { images: [await imageFile(f)] };
  if (name.endsWith(".pdf") || f.type === "application/pdf") {
    if (f.size * 1.37 < LIMIT) return { pdfBase64: b64(await f.arrayBuffer()) };
    return pdfFallback(f);
  }
  if (name.endsWith(".docx")) {
    if (f.size * 1.37 < LIMIT) return { docxBase64: b64(await f.arrayBuffer()) };
    throw new Error("This Word file is too large. Save it as PDF and upload again.");
  }
  if (name.endsWith(".doc")) throw new Error("Old .doc files aren't supported. Save it as .docx or PDF and upload again.");
  return { text: (await f.text()).slice(0, 400_000) };
}
