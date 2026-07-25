import { prisma } from "./prisma";
import { isEmailConfigured, sendMail } from "./email";

// Keep only the most recent N error logs so the table doesn't grow forever.
const RETENTION = 500;
// Don't email more than one alert every 10 minutes, so a crash loop can't
// flood the inbox.
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
let lastAlertAt = 0;

export interface CapturedError {
  message: string;
  digest?: string;
  path?: string;
  method?: string;
  routeType?: string;
  stack?: string;
}

/**
 * Records a server error and, if email is configured and the cooldown has
 * elapsed, sends an alert. Never throws — a failure here must not mask the
 * original error or crash request handling.
 */
export async function captureError(err: CapturedError): Promise<void> {
  try {
    await prisma.errorLog.create({ data: err });

    const keep = await prisma.errorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: RETENTION,
      select: { id: true },
    });
    await prisma.errorLog.deleteMany({ where: { id: { notIn: keep.map((r) => r.id) } } });
  } catch {
    // Swallow — logging the error must never throw.
  }

  const now = Date.now();
  if (!isEmailConfigured() || now - lastAlertAt < ALERT_COOLDOWN_MS) return;
  lastAlertAt = now;

  await sendMail({
    subject: `⚠️ خطأ في نظام Homex`,
    html: `<div dir="rtl" style="font-family:sans-serif">
      <p>صار خطأ في الموقع:</p>
      <p><b>الرسالة:</b> ${escapeHtml(err.message)}</p>
      ${err.path ? `<p><b>المسار:</b> ${escapeHtml(err.path)}</p>` : ""}
      ${err.method ? `<p><b>الطريقة:</b> ${escapeHtml(err.method)}</p>` : ""}
      <p style="color:#888;font-size:12px">قد تصلك هذي الرسالة مرة كل ١٠ دقائق كحد أقصى حتى لو تكرر الخطأ أكثر.</p>
    </div>`,
  }).catch(() => {});
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
