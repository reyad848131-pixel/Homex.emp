// Build a real PDF file from a quotation's print HTML entirely in the browser,
// then hand it to the device's native share sheet (so it attaches as an actual
// PDF file in WhatsApp on iPad/mobile). No server-side PDF renderer needed.
//
// wa.me links can only carry text, so "send the PDF" goes through the Web Share
// API (navigator.share with a File). On desktops without file-share support we
// fall back to downloading the PDF so it can be attached manually.

// A4 at 96dpi in CSS pixels.
const A4_W = 210; // mm
const A4_H = 297; // mm

async function loadDeps() {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  return { jsPDF, html2canvas };
}

// Render the quotation's PDF-style HTML into an offscreen iframe and rasterise
// it to a paginated A4 PDF. Returns the PDF as a Blob.
export async function buildQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const { jsPDF, html2canvas } = await loadDeps();

  const res = await fetch(`/api/quotations/${quotationId}/pdf`, { credentials: "include" });
  if (!res.ok) throw new Error("pdf-fetch-failed");
  const html = await res.text();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;height:1160px;border:0;opacity:0;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Drop the on-screen toolbar/hint so they don't appear in the PDF.
    doc.querySelectorAll(".pdf-toolbar, .pdf-hint").forEach((el) => el.remove());

    // Wait for layout, webfonts and images before capturing.
    await new Promise((r) => setTimeout(r, 350));
    try { await (doc as any).fonts?.ready; } catch { /* ignore */ }
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); })
      )
    );
    await new Promise((r) => setTimeout(r, 150));

    const target = (doc.querySelector(".page") as HTMLElement) || doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = A4_W;
    const pageH = A4_H;
    // Slice the tall canvas into A4-height pages.
    const pxPerMm = canvas.width / pageW;
    const pageHpx = Math.floor(pageH * pxPerMm);
    let rendered = 0;
    let first = true;
    while (rendered < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - rendered);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const imgData = slice.toDataURL("image/jpeg", 0.92);
      const hMm = sliceH / pxPerMm;
      if (!first) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, hMm);
      first = false;
      rendered += sliceH;
    }
    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
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
