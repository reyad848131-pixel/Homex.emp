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
`مرحباً {customer} 👋
طلبكم جاهز للتوصيل.
الموعد: {date} {time}
نرجو تأكيد الموعد 🙏

{company}
{companyPhone}`;

export const DEFAULT_WA_COMPLETED =
`مرحباً {customer} 👋
يسعدنا إبلاغكم أن طلبكم {number} قد اكتمل تجهيزه ✅
سنتواصل معكم قريباً لترتيب التوصيل.
شكراً لثقتكم 🙏

{company}
{companyPhone}`;

export const DEFAULT_WA_READY =
`مرحباً {customer} 👋
طلبكم {number} أصبح جاهزاً للتوصيل 🚚
{date}
يرجى إبلاغنا بالوقت المناسب لكم 🙏

{company}
{companyPhone}`;

export const DEFAULT_WA_DELIVERED =
`مرحباً {customer} 🌟
تم توصيل طلبكم {number} بنجاح ✅
نتمنى أن ينال إعجابكم، ونسعد بخدمتكم دائماً.
شكراً لثقتكم بنا 🙏

{company}
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

// Build a wa.me link for a phone (code + number) and a ready message.
export function waLinkFor(phoneCode: string, phone: string, text: string): string {
  const num = `${phoneCode || "+968"}${phone}`.replace(/[^0-9]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
