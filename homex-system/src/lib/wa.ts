// WhatsApp message templates. The company can edit these from Settings; when a
// template is empty the sensible default below is used, so behaviour never
// regresses. Templates use {placeholders} that are filled per message.

export const WA_PLACEHOLDERS = [
  "{customer}", "{number}", "{total}", "{advance}", "{advancePct}",
  "{link}", "{date}", "{time}", "{location}", "{company}", "{companyPhone}",
] as const;

export const DEFAULT_WA_QUOTE =
`مرحباً {customer} 🌿

يسعدنا أن نضع بين يديك عرض السعر الخاص بطلبك من *{company}*.

📄 *عرض سعر رقم {number}*
• الإجمالي: *{total}*
• الدفعة المقدمة ({advancePct}%): {advance}

للاطّلاع على كامل التفاصيل والموافقة إلكترونياً:
{link}

يسعدنا خدمتك، ونحن جاهزون لأي استفسار 🤍
*{company}*
{companyPhone}`;

// Caption sent alongside the PDF file — same warm message but without the
// online approval link (the attached PDF is the deliverable here).
export const DEFAULT_WA_PDF =
`مرحباً {customer} 🌿

يسعدنا أن نرفق لك عرض السعر الخاص بطلبك من *{company}* بصيغة PDF.

📄 *عرض سعر رقم {number}*
• الإجمالي: *{total}*
• الدفعة المقدمة ({advancePct}%): {advance}

يسعدنا خدمتك، ونحن جاهزون لأي استفسار 🤍
*{company}*
{companyPhone}`;

export const DEFAULT_WA_DELIVERY =
`مرحباً {customer} 🌿

يسرّنا إبلاغك بأن طلبك رقم *{number}* أصبح جاهزاً للتوصيل 🚚
موعد التوصيل: *{date}* {time}

نرجو تأكيد الموعد ليصلك في وقته المناسب 🙏
*{company}*
{companyPhone}`;

export const DEFAULT_WA_COMPLETED =
`مرحباً {customer} 🌿

يسعدنا إبلاغك بأن طلبك رقم *{number}* قد اكتمل تجهيزه بالكامل ✅
وسنتواصل معك قريباً لترتيب موعد التوصيل.

شكراً لثقتك، ويسعدنا خدمتك دائماً 🤍
*{company}*
{companyPhone}`;

export const DEFAULT_WA_READY =
`مرحباً {customer} 🌿

طلبك رقم *{number}* أصبح جاهزاً للتوصيل 🚚
يرجى إبلاغنا بالوقت المناسب لك ونحن على أتمّ الاستعداد.

نسعد بخدمتك دائماً 🙏
*{company}*
{companyPhone}`;

export const DEFAULT_WA_DELIVERED =
`مرحباً {customer} 🌟

تم توصيل طلبك رقم *{number}* بنجاح ✅
نتمنى أن ينال إعجابك، ويسعدنا خدمتك في كل مرة.

شكراً لثقتك بنا 🤍
*{company}*
{companyPhone}`;

// Fill a template with values and clean up the result: unknown placeholders are
// dropped, blank lines collapsed, and leading/trailing whitespace trimmed.
export function renderWaTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl || "";
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  out = out.replace(/\{[a-zA-Z]+\}/g, "");   // drop any leftover placeholders
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

// Build a WhatsApp deep link for a phone (code + number) and a ready message.
// On phones we use wa.me, which opens the native app directly. On desktop we go
// straight to web.whatsapp.com instead: wa.me is a redirector that some
// networks/DNS fail to resolve (DNS_PROBE_FINISHED_NXDOMAIN — "site can't be
// reached"), whereas web.whatsapp.com is the very client the user is already
// signed into, so it always resolves. Falls back to wa.me when there's no
// browser (server render / tests).
export function waLinkFor(phoneCode: string, phone: string, text: string): string {
  const num = `${phoneCode || "+968"}${phone}`.replace(/[^0-9]/g, "");
  const encoded = encodeURIComponent(text);
  let isMobile = false;
  try {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      isMobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
    }
  } catch { /* ignore — default to desktop web link below */ }
  return isMobile
    ? `https://wa.me/${num}?text=${encoded}`
    : `https://web.whatsapp.com/send?phone=${num}&text=${encoded}`;
}
