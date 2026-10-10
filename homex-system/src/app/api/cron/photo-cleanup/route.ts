import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { deletePhoto } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auto-delete production photos older than the configured retention window.
// photo_retention_months: "0" (or empty) = keep forever; "6" / "12" = delete
// after that many months. Runs daily via Vercel Cron; admins can also hit it.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!isCron) {
      const session = await getAuth();
      const user = session?.user as any;
      if (!session || (user?.role !== "admin" && user?.role !== "ceo")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const months = parseInt((await getSetting("photo_retention_months", "0")) || "0", 10) || 0;
    if (months <= 0) return NextResponse.json({ ok: true, retention: "forever", deleted: 0 });

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const stale = await prisma.itemPhoto.findMany({ where: { createdAt: { lt: cutoff } }, take: 500 });
    let deleted = 0;
    for (const p of stale) {
      await deletePhoto(p.publicId);
      await prisma.itemPhoto.delete({ where: { id: p.id } });
      deleted += 1;
    }
    return NextResponse.json({ ok: true, retention: `${months}m`, deleted });
  } catch (e) {
    console.error("API error [/api/cron/photo-cleanup]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
