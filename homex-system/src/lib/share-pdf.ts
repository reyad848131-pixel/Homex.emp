// Fetch a real PDF of a quotation (rendered server-side by headless Chromium so
// Arabic shapes correctly) and hand it to the device's native share sheet — so
// it attaches as an actual PDF file in WhatsApp on iPad/mobile.
//
// wa.me links can only carry text, so "send the PDF" goes through the Web Share
// API (navigator.share with a File). On desktops without file-share support we
// fall back to downloading the PDF so it can be attached manually.

export async function buildQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const res = await fetch(`/api/quotations/${quotationId}/pdf-file`, { credentials: "include" });
  if (!res.ok) throw new Error("pdf-fetch-failed");
  const blob = await res.blob();
  if (blob.type && !blob.type.includes("pdf")) throw new Error("pdf-fetch-failed");
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
export async function sharePdf(blob: Blob, fileName: string, text?: string): Promise<"shared" | "downloaded"> {
  const safe = fileName.replace(/[\\/:*?"<>|]/g, " ").trim() || "quote.pdf";
  const file = new File([blob], safe.endsWith(".pdf") ? safe : `${safe}.pdf`, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: safe, ...(text ? { text } : {}) });
    return "shared";
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
