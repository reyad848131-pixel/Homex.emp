import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createSnapshot } from "@/lib/backup";

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
      if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const row = await createSnapshot(isCron ? "auto" : "manual");
    return NextResponse.json({ ok: true, backup: row });
  } catch (err) {
    console.error("Cron backup error:", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
