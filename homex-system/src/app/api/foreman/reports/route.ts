import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getForemanReport } from "@/lib/foreman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Performance report over [from, to]. format=xlsx streams an Excel workbook.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const ids = await foremanAccessIds().catch(() => [] as string[]);
    if (!canAccessForeman(user.civilId, user.id, ids)) return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const from = (sp.get("from") || today).trim();
    const to = (sp.get("to") || today).trim();
    const report = await getForemanReport(from, to);

    if (sp.get("format") !== "xlsx") return NextResponse.json(report);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("الأداء");
    ws.views = [{ rightToLeft: true }];
    ws.columns = [
      { header: "العامل", key: "name", width: 22 },
      { header: "مهام منجزة", key: "tasksDone", width: 14 },
      { header: "تركيبات", key: "installs", width: 12 },
      { header: "أيام حضور", key: "daysPresent", width: 12 },
      { header: "أيام غياب", key: "daysAbsent", width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of report.rows) ws.addRow(r);

    // Second sheet: productivity per stage / section.
    const ws2 = wb.addWorksheet("حسب القسم");
    ws2.views = [{ rightToLeft: true }];
    ws2.columns = [
      { header: "القسم / المرحلة", key: "stage", width: 24 },
      { header: "قطع منجزة", key: "count", width: 14 },
    ];
    ws2.getRow(1).font = { bold: true };
    for (const s of report.byStage || []) ws2.addRow(s);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="foreman-report-${from}_${to}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("API error [/api/foreman/reports]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
