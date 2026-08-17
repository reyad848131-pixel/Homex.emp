// Shared on-screen toolbar injected into the HTML documents returned by the
// PDF-style routes (quotation, invoice, payment receipt). It gives the user a
// working Back button and a Save/Download (print-to-PDF) button, and hides
// itself when printing. Fixes the "can't go back / can't save" problem where
// these pages opened as bare HTML in a new tab with no controls.
export function pdfToolbar(backHref: string, downloadHref?: string): string {
  // When a downloadHref is given (a real server-rendered PDF), the Save button
  // opens that file directly — crisper output and a correct multi-page
  // watermark — instead of the browser's own print of this HTML.
  const saveBtn = downloadHref
    ? `<a class="pdf-save" href="${downloadHref}" target="_blank" rel="noopener">⬇︎ تحميل / حفظ PDF</a>`
    : `<button class="pdf-save" onclick="window.print()">⬇︎ تحميل / حفظ PDF</button>`;
  return `
<style>
  .pdf-toolbar {
    position: sticky; top: 0; z-index: 99999;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: #2f3b38; padding: 10px 16px;
    font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; direction: rtl;
  }
  .pdf-toolbar a, .pdf-toolbar button {
    font-family: inherit; font-size: 14px; font-weight: 700;
    border-radius: 8px; padding: 9px 16px; cursor: pointer; border: none;
    display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
  }
  .pdf-toolbar .pdf-back { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.4); }
  .pdf-toolbar .pdf-save { background: #fff; color: #2f3b38; }
  .pdf-hint {
    background: #fff8e6; color: #8a6d1a; direction: rtl;
    font-family: -apple-system, "Segoe UI", Tahoma, sans-serif;
    font-size: 12px; text-align: center; padding: 7px 12px;
  }
  @media print { .pdf-toolbar, .pdf-hint { display: none !important; } }
</style>
<div class="pdf-toolbar">
  <a class="pdf-back" href="${backHref}">→ رجوع</a>
  ${saveBtn}
</div>
<div class="pdf-hint">للحفظ في جهازك: اضغط «تحميل / حفظ PDF» ثم اختر «حفظ في الملفات» أو «حفظ كـ PDF».</div>
`;
}
