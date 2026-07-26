import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createSnapshot } from "@/lib/backup";
import { buildExportWorkbook } from "@/lib/excel";
import { isEmailConfigured, sendMail } from "@/lib/email";

// Emails a full Excel workbook of the data as an off-site backup. No-op unless
// email is configured (RESEND_API_KEY + BACKUP_EMAIL).
async function emailExcelBackup(): Promise<string> {
  if (!isEmailConfigured()) return "skipped";
  try {
    const buffer = await buildExportWorkbook();
    const date = new Date().toISOString().split("T")[0];
    const res = await sendMail({
      subject: `نسخة Homex الاحتياطية — ${date}`,
      html: `<div dir="rtl" style="font-family:sans-serif">مرفق ملف Excel يحتوي كل بيانات Homex (العروض، العملاء، الدفعات) كنسخة احتياطية بتاريخ ${date}.</div>`,
      attachments: [{ filename: `homex-backup-${date}.xlsx`, content: buffer.toString("base64") }],
    });
    return res.ok ? "sent" : `error: ${res.error}`;
  } catch (e: any) {
    return `error: ${e?.message || "failed"}`;
  }
}

// Scheduled automatic backup. Invoked by Vercel Cron (see vercel.json) with an
// "Authorization: Bearer <CRON_SECRET>" header, or manually by an admin.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      // Not a valid cron call — require an authenticated admin instead.
      const session = await getAuth();
      const user = session?.user as any;
      if (!session || user?.role !== "admin" && user?.role !== "ceo") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const row = await createSnapshot(isCron ? "auto" : "manual");

    // Email the Excel backup weekly (Saturday) on cron, or on demand via ?email=1.
    const forceEmail = req.nextUrl.searchParams.get("email") === "1";
    const weekly = new Date().getDay() === 6; // Saturday
    let email: string | undefined;
    if (forceEmail || (isCron && weekly)) {
      email = await emailExcelBackup();
    }

    return NextResponse.json({ ok: true, backup: row, ...(email ? { email } : {}) });
  } catch (err) {
    console.error("Cron backup error:", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
