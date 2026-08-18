import { getSettings } from "@/lib/settings";
import QRCode from "qrcode";

// Shared brand design system for the printable documents (invoice, payment
// receipt). It mirrors the official quotation PDF 1:1 — same Cairo + Montserrat
// fonts, the Iridium + sage palette, the letterhead, watermark, meta grid and
// letterhead footer — so every Homex document reads as one family. The
// quotation route keeps its own inline copy and is intentionally left
// untouched; this module drives the other documents only.

export function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface BrandCtx {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  companySubtitle: string;
  companyFactory: string;
  companyCR: string;
  companyVat: string;
  companyLogo: string;
  companyWebsite: string;
  companyInstagram: string;
  companyMaps: string;
  instaUrl: string;
  monogram: string;
  wmEnabled: boolean;
  wmColor: string;
  wmOpacity: number;
  wmSize: number;
  wmImage: string;
}

export async function loadBrand(): Promise<BrandCtx> {
  const s = await getSettings();
  const companyName = s.company_name || "Homex";
  const companyInstagram = s.company_instagram || "";
  const instaUrl = companyInstagram
    ? (/^https?:\/\//i.test(companyInstagram) ? companyInstagram : `https://instagram.com/${companyInstagram.replace(/^@/, "")}`)
    : "";
  const companyCR = s.company_cr || "";
  const companyLogo = s.company_logo || "";
  return {
    companyName,
    companyPhone: s.company_phone || "+968 97460716",
    companyAddress: s.company_address || "بهلاء، محافظة الداخلية، عُمان",
    companySubtitle: s.company_subtitle || "مطابخ · خزائن · أثاث مخصص وتصميم داخلي",
    companyFactory: s.company_factory || "شركة تابعة لمصنع سلطان النبهاني للمنتجات الخشبية — بهلاء، عُمان",
    companyCR,
    companyVat: s.company_vat || companyCR || "",
    companyLogo,
    companyWebsite: s.company_website || "",
    companyInstagram,
    companyMaps: s.company_maps || "",
    instaUrl,
    monogram: (esc(companyName).trim()[0] || "H").toUpperCase(),
    wmEnabled: (s.wm_enabled ?? "1") !== "0",
    wmColor: /^#[0-9a-fA-F]{3,8}$/.test(s.wm_color || "") ? (s.wm_color as string) : "#3d3d3d",
    wmOpacity: Math.max(0, Math.min(30, parseFloat(s.wm_opacity || "5") || 5)) / 100,
    wmSize: Math.max(200, Math.min(800, parseInt(s.wm_size || "560", 10) || 560)),
    wmImage: s.wm_image || companyLogo,
  };
}

export async function makeQr(data: string): Promise<string> {
  try { return await QRCode.toDataURL(data, { margin: 1, width: 220, color: { dark: "#3d3d3d", light: "#ffffff" } }); }
  catch { return ""; }
}

// The three-dashes-and-dots monogram mark used beside every section title.
export const iconLines = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#8b9a7b" stroke-width="2" stroke-linecap="round"><line x1="8" y1="7" x2="20" y2="7"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="17" x2="20" y2="17"/><circle cx="4" cy="7" r="1.4" fill="#8b9a7b" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="#8b9a7b" stroke="none"/><circle cx="4" cy="17" r="1.4" fill="#8b9a7b" stroke="none"/></svg>`;

// Shared <style> block — the exact palette, fonts and building blocks of the
// official quotation document, plus a few classes specific to the money
// documents (payment box, receipt hero amount).
export function brandCss(): string {
  return `<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Montserrat:wght@600;700;800&display=swap');
  :root {
    --font-body:'Cairo','Segoe UI',Tahoma,sans-serif;
    --font-head:'Cairo','Segoe UI',sans-serif;
    --font-word:'Montserrat','Segoe UI',sans-serif;
    --ink:#262625; --muted:#7e7f77; --green:#3d3d3d; --green-2:#2a2a28;
    --sage:#8b9a7b; --sage-d:#6f7e62; --soft:#eef0ea; --paper:#fff;
    --panel:#f6f6f3; --line:#d3d4cc;
    --danger:#a4442f; --ok:#5f7452;
  }
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font-body);font-size:13px;color:var(--ink);background:#eceae4;line-height:1.65;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";letter-spacing:.2px}
  .page{max-width:820px;margin:22px auto;background:var(--paper);box-shadow:0 10px 40px rgba(0,0,0,.10);position:relative;overflow:hidden}

  .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none;user-select:none;font-weight:900;line-height:1}
  .watermark img{display:block}
  .page>*:not(.watermark){position:relative;z-index:1}

  .lh{background:linear-gradient(135deg,var(--green) 0%,var(--green-2) 100%);color:#fff;padding:32px 44px 28px;display:flex;align-items:center;gap:22px;position:relative}
  .lh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--sage),transparent 60%)}
  .lh-badge{width:80px;height:80px;flex-shrink:0;border:1px solid rgba(255,255,255,.32);border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);overflow:hidden}
  .lh-badge img{width:100%;height:100%;object-fit:contain}
  .lh-badge .mono{font-size:38px;font-weight:800;color:#fff;letter-spacing:1px}
  .lh-main{flex:1}
  .lh-main h1{font-family:var(--font-word);font-size:30px;font-weight:700;letter-spacing:9px;line-height:1.1}
  .lh-sub{font-size:12px;color:rgba(255,255,255,.85);margin-top:7px;font-weight:500;letter-spacing:.3px}
  .lh-factory{font-size:10.5px;color:rgba(255,255,255,.6);margin-top:3px}
  .lh-doc{text-align:left;flex-shrink:0}
  .lh-doc .k{font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.6);text-transform:uppercase}
  .lh-doc .v{font-size:18px;font-weight:800;letter-spacing:1px;margin-top:3px}
  .lh-doc .badge{display:inline-block;margin-top:8px;font-size:10px;letter-spacing:1px;padding:3px 10px;border:1px solid rgba(255,255,255,.3);border-radius:20px;color:rgba(255,255,255,.85)}
  .lh-doc .badge.paid{background:var(--sage);border-color:var(--sage);color:#fff;font-weight:700}
  .lh-doc .badge.due{background:rgba(164,68,47,.9);border-color:transparent;color:#fff;font-weight:700}

  .meta{display:flex;padding:26px 44px 8px;gap:34px}
  .meta-col{flex:1}
  .meta-col.right{border-inline-start:1px solid var(--line);padding-inline-start:34px}
  .meta-k{font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--sage-d);font-weight:700;margin-bottom:7px}
  .meta-name{font-size:15px;font-weight:700;color:var(--ink)}
  .meta-line{font-size:12px;color:var(--muted);margin-top:2px}

  .facts{display:flex;margin:22px 44px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .fact{flex:1;padding:12px 16px;text-align:center}
  .fact+.fact{border-inline-start:1px solid var(--line)}
  .fact .k{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}
  .fact .v{font-size:13px;font-weight:700;color:var(--ink);margin-top:3px}
  .fact .v.accent{color:var(--sage-d)}

  .sec{margin:30px 44px 0;display:flex;align-items:center;gap:10px}
  .sec .bar{width:4px;height:18px;background:var(--sage);border-radius:2px}
  .sec .ic{display:flex}
  .sec h2{font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--green);letter-spacing:.3px}
  .sec .rule{flex:1;height:1px;background:var(--line)}

  .items{width:calc(100% - 88px);margin:14px 44px 0;border-collapse:collapse}
  .items thead th{background:var(--green);color:#fff;font-size:11.5px;font-weight:700;padding:11px 14px;text-align:right;letter-spacing:.3px}
  .items thead th:first-child{border-start-start-radius:8px}
  .items thead th:last-child{border-start-end-radius:8px}
  .items thead th.ta-c{text-align:center}
  .items tbody td{padding:11px 14px;font-size:13px;border-bottom:1px solid var(--line);vertical-align:top}
  .items tbody tr:nth-child(even) td{background:var(--panel)}
  .c-idx{text-align:center;width:38px;color:var(--muted)}
  .c-desc{font-weight:500}
  .c-qty{text-align:center;width:64px}
  .c-num{text-align:left;width:120px;font-variant-numeric:tabular-nums;direction:ltr}
  .c-strong{font-weight:800;color:var(--sage-d)}

  .totals{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin:18px 44px 0}
  .totals-card{width:340px;flex-shrink:0}
  .totals-qr{display:flex;gap:26px;padding-bottom:4px}
  .tq{text-align:center}
  .tq img{width:88px;height:88px;border:1px solid var(--line);border-radius:10px;padding:5px;background:#fff}
  .tq .cap{font-size:10px;color:var(--muted);margin-top:6px;letter-spacing:.3px;line-height:1.5}
  .tq .cap b{color:var(--sage-d);font-weight:700}
  .tt{display:flex;justify-content:space-between;padding:8px 16px;font-size:13px}
  .tt .l{color:var(--muted);font-weight:600}
  .tt .v{font-variant-numeric:tabular-nums;direction:ltr;font-weight:700}
  .tt.sub{border-bottom:1px solid var(--line)}
  .tt.grand{background:var(--green);color:#fff;border-radius:10px;padding:13px 16px;margin-top:8px}
  .tt.grand .l{color:#fff;font-weight:800;font-size:14px}
  .tt.grand .v{color:#fff;font-weight:900;font-size:15px}

  /* Payment status strip (invoice + receipt) */
  .paybar{display:flex;gap:14px;margin:24px 44px 0}
  .paybox{flex:1;border:1px solid var(--line);border-radius:12px;padding:15px 12px;text-align:center;background:var(--panel)}
  .paybox .l{font-size:10.5px;letter-spacing:.5px;color:var(--muted);text-transform:uppercase}
  .paybox .n{font-size:18px;font-weight:900;margin-top:5px;font-variant-numeric:tabular-nums;direction:ltr}
  .paybox .n .u{font-size:11px;font-weight:700;color:var(--muted)}
  .paybox.paid{background:var(--soft);border-color:#cdd6c2}
  .paybox.paid .n{color:var(--ok)}
  .paybox.due .n{color:var(--danger)}
  .paybox.total .n{color:var(--green)}

  .note{margin:22px 44px 0;padding:12px 16px;background:var(--panel);border-inline-start:3px solid var(--sage);border-radius:6px;font-size:11.5px;color:var(--muted);line-height:1.7}

  .foot{margin-top:26px;padding:14px 44px;border-top:1px solid var(--line)}
  .foot .row1{text-align:center;font-size:10.5px;color:var(--muted)}
  .foot .row2{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:10.5px;color:var(--muted)}
  .foot .brand{font-family:var(--font-word);font-weight:700;color:var(--green);letter-spacing:1.5px}
  .foot-qr{display:flex;justify-content:center;gap:34px;margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
  .fq{text-align:center}
  .fq img{width:70px;height:70px;border:1px solid var(--line);border-radius:8px;padding:3px;background:#fff}
  .fq .cap{font-size:9.5px;color:var(--muted);margin-top:5px;letter-spacing:.3px}
  .fq .cap b{color:var(--sage-d);font-weight:700}

  @media print{
    body{background:#fff} .page{margin:0;max-width:100%;box-shadow:none}
    /* Keep money/summary/signature blocks whole across page breaks. */
    .totals,.totals-card,.paybar,.paybox,.note,.facts,.hero,.kvgrid,.sign-cols{break-inside:avoid}
    .items tr,.items thead,.kv{break-inside:avoid}
  }
</style>`;
}

// Faint centred watermark that repeats on every printed/PDF page.
export function watermarkHtml(b: BrandCtx): string {
  if (!b.wmEnabled) return "";
  const inner = b.wmImage
    ? `<img src="${b.wmImage}" style="width:${b.wmSize}px;height:${b.wmSize}px;object-fit:contain;opacity:${b.wmOpacity}" alt="" />`
    : `<span style="color:${b.wmColor};opacity:${b.wmOpacity}">${b.monogram}</span>`;
  return `<div class="watermark" style="font-size:${Math.round(b.wmSize * 0.95)}px">${inner}</div>`;
}

// Dark Iridium letterhead with the logo/monogram, wordmark and document label.
export function letterheadHtml(b: BrandCtx, docLabel: string, docNumber: string, badge = ""): string {
  return `<div class="lh">
    <div class="lh-badge">${b.companyLogo ? `<img src="${b.companyLogo}" alt="${esc(b.companyName)}" />` : `<span class="mono">${b.monogram}</span>`}</div>
    <div class="lh-main">
      <h1>${esc(b.companyName).toUpperCase()}</h1>
      <div class="lh-sub">${esc(b.companySubtitle)}</div>
      <div class="lh-factory">${esc(b.companyFactory)}</div>
    </div>
    <div class="lh-doc">
      <div class="k">${esc(docLabel)}</div>
      <div class="v num">${esc(docNumber)}</div>
      ${badge}
    </div>
  </div>`;
}

// Letterhead footer with the contact line, wordmark, print date and the
// Instagram / factory-location QR strip (built from settings).
export async function footerHtml(b: BrandCtx, printDate: string): Promise<string> {
  const footerLine = [b.companyPhone, b.companyAddress, b.companyCR ? `س.ت ${b.companyCR}` : "", b.companyWebsite]
    .filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
  const qrInsta = b.instaUrl ? await makeQr(b.instaUrl) : "";
  const qrMaps = b.companyMaps ? await makeQr(b.companyMaps) : "";
  const igHandle = esc(b.companyInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, ""));
  const qrStrip = (qrInsta || qrMaps) ? `<div class="foot-qr">
      ${qrInsta ? `<div class="fq"><img src="${qrInsta}" alt="Instagram" /><div class="cap"><b>إنستقرام</b> ${igHandle}</div></div>` : ""}
      ${qrMaps ? `<div class="fq"><img src="${qrMaps}" alt="Location" /><div class="cap"><b>موقع المصنع</b></div></div>` : ""}
    </div>` : "";
  return `<div class="foot">
    <div class="row1">${footerLine}</div>
    <div class="row2"><span class="brand">${esc(b.companyName)}</span><span class="num">${esc(printDate)}</span></div>
    ${qrStrip}
  </div>`;
}

export function printDateStr(): string {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
}
