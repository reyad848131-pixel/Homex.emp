import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getAttendanceMonth } from "@/lib/foreman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Short status code for a shift. ح = present, م = onsite, غ = absent, – = none.
function code(s?: string) {
  if (s === "present") return "ح";
  if (s === "onsite") return "م";
  if (s === "absent") return "غ";
  return "–";
}

// Monthly attendance grid. format=xlsx streams an Excel workbook.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const ids = await foremanAccessIds().catch(() => [] as string[]);
    if (!canAccessForeman(user.civilId, user.id, ids)) return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const now = new Date();
    const year = parseInt(sp.get("year") || String(now.getFullYear()), 10) || now.getFullYear();
    const month = parseInt(sp.get("month") || String(now.getMonth() + 1), 10) || (now.getMonth() + 1);
    const report = await getAttendanceMonth(year, month);

    if (sp.get("format") !== "xlsx") return NextResponse.json(report);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${year}-${String(month).padStart(2, "0")}`);
    ws.views = [{ rightToLeft: true }];
    const cols: Partial<ExcelJS.Column>[] = [
      { header: "العامل", key: "name", width: 20 },
      { header: "حضور", key: "present", width: 8 },
      { header: "غياب", key: "absent", width: 8 },
      { header: "نسبة %", key: "pct", width: 8 },
    ];
    for (let d = 1; d <= report.daysInMonth; d++) cols.push({ header: String(d), key: `d${d}`, width: 6 });
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };

    for (const r of report.rows) {
      const row: any = { name: r.name, present: r.present, absent: r.absent, pct: r.pct == null ? "" : `${r.pct}%` };
      for (let d = 1; d <= report.daysInMonth; d++) {
        const cell = (r.days as any)[d];
        row[`d${d}`] = cell ? `${code(cell.am)}/${code(cell.pm)}` : "";
      }
      ws.addRow(row);
    }

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance-${year}-${String(month).padStart(2, "0")}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("API error [/api/foreman/attendance/report]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
