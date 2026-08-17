// Fetch a real PDF of a quotation (rendered server-side by headless Chromium so
// Arabic shapes correctly) and hand it to the device's native share sheet — so
// it attaches as an actual PDF file in WhatsApp on iPad/mobile.
//
// wa.me links can only carry text, so "send the PDF" goes through the Web Share
// API (navigator.share with a File). On desktops without file-share support we
// fall back to downloading the PDF so it can be attached manually.

export async function buildQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const res = await fetch(`/api/quotations/${quotationId}/pdf-file`, { credentials: "include" });
  if (!res.ok) {
    // Surface the server's error detail so it can be reported without digging
    // through hosting logs.
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (blob.type && !blob.type.includes("pdf")) throw new Error("bad-content-type");
  return blob;
}

// True when the browser can share an actual file (iPad/most mobiles).
export function canShareFiles(): boolean {
  try {
    const f = new File([new Blob()], "t.pdf", { type: "application/pdf" });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch {
    return false;
  }
}

// Share (or download as fallback) a PDF blob under the given file name.
// Some platforms accept a file + caption together, some only accept the file,
// so try the richest payload first and gracefully degrade — ending in a plain
// download when the browser can't share files at all. A user-cancelled share
// (AbortError) is propagated so the caller can stay silent.
export async function sharePdf(blob: Blob, fileName: string, text?: string): Promise<"shared" | "downloaded"> {
  const safe = fileName.replace(/[\\/:*?"<>|]/g, " ").trim() || "quote.pdf";
  const file = new File([blob], safe.endsWith(".pdf") ? safe : `${safe}.pdf`, { type: "application/pdf" });

  const payloads: ShareData[] = text
    ? [{ files: [file], text }, { files: [file] }]
    : [{ files: [file] }];

  if (typeof navigator.canShare === "function" && typeof navigator.share === "function") {
    for (const p of payloads) {
      if (!navigator.canShare(p)) continue;
      try {
        await navigator.share(p);
        return "shared";
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e; // user closed the sheet
        // otherwise try the next (simpler) payload, then fall back to download
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
