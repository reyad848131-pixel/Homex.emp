import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const dbPath = join(process.cwd(), "prisma", "dev.db");
    const buffer = await readFile(dbPath);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="homex-backup-${date}.db"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
