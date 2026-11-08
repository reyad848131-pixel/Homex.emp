import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { hasReportsAccess } from "@/lib/permissions";
import { buildExportWorkbook } from "@/lib/excel";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    // Full-data export — gate by the reports capability, not just "deny sales".
    if (!(await hasReportsAccess(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const buffer = await buildExportWorkbook();
    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="homex-export-${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("XLSX export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
