import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { buildExportWorkbook } from "@/lib/excel";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role === "sales") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
