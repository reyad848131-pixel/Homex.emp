import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildBackup } from "@/lib/backup";

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin" && user.role !== "ceo") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);

    // List stored automatic/manual snapshots (metadata only, no heavy data).
    if (searchParams.get("list") === "true") {
      const backups = await prisma.backup.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, size: true, source: true, createdAt: true },
      });
      return NextResponse.json({ backups });
    }

    // Download a specific stored snapshot by id.
    const id = searchParams.get("id");
    if (id) {
      const stored = await prisma.backup.findUnique({ where: { id } });
      if (!stored) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const date = new Date(stored.createdAt).toISOString().split("T")[0];
      return new NextResponse(stored.data, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="homex-backup-${date}.json"`,
        },
      });
    }

    // Default: generate and download a fresh live backup.
    const backup = await buildBackup();
    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="homex-backup-${date}.json"`,
      },
    });
  } catch (e) {
    console.error("API error [/api/backup]:", e);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
