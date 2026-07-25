import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { roundMoney } from "./utils";

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", pending: "قيد المراجعة", approved: "معتمد", sent: "مرسل",
  accepted: "مقبول", revised: "معاد للتعديل", declined: "مرفوض", cancelled: "ملغي",
};
const METHOD_AR: Record<string, string> = {
  cash: "نقداً", bank_transfer: "تحويل بنكي", cheque: "شيك", card: "بطاقة",
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FF2F3B38" },
};

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
}

/**
 * Builds a styled multi-sheet Excel workbook (summary, quotations, customers,
 * payments) of all data. Shared by the download route and the emailed backup.
 */
export async function buildExportWorkbook(): Promise<Buffer> {
  const [quotations, customers, payments] = await Promise.all([
    prisma.quotation.findMany({
      include: { customer: true, employee: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      include: { _count: { select: { quotations: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      include: { quotation: { select: { quoteNumber: true, customer: { select: { name: true } } } }, recorder: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Homex";
  wb.created = new Date();
  const money = "0.000";

  const approved = quotations.filter((q) => q.status === "approved");
  const totalApproved = roundMoney(approved.reduce((s, q) => s + q.total, 0));
  const totalCollected = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  const sum = wb.addWorksheet("ملخّص", { views: [{ rightToLeft: true }] });
  sum.columns = [{ width: 28 }, { width: 20 }];
  sum.addRows([
    ["الملخّص العام", ""],
    ["إجمالي العروض", quotations.length],
    ["العملاء", customers.length],
    ["العروض المعتمدة", approved.length],
    ["قيمة العروض المعتمدة", totalApproved],
    ["إجمالي المحصّل", totalCollected],
    ["المتبقّي للتحصيل", roundMoney(Math.max(totalApproved - totalCollected, 0))],
    ["تاريخ التصدير", new Date().toLocaleString("ar-OM")],
  ]);
  sum.getRow(1).font = { bold: true, size: 14, color: { argb: "FF2F3B38" } };
  sum.getColumn(1).font = { bold: true };
  [5, 6, 7].forEach((r) => (sum.getCell(`B${r}`).numFmt = money));

  const qs = wb.addWorksheet("العروض");
  qs.columns = [
    { header: "رقم العرض", key: "no", width: 16 },
    { header: "العميل", key: "cust", width: 22 },
    { header: "الهاتف", key: "phone", width: 16 },
    { header: "المحافظة", key: "gov", width: 14 },
    { header: "الموظف", key: "emp", width: 16 },
    { header: "الحالة", key: "status", width: 14 },
    { header: "المجموع الفرعي", key: "subtotal", width: 15, style: { numFmt: money } },
    { header: "الضريبة", key: "vat", width: 12, style: { numFmt: money } },
    { header: "الإجمالي", key: "total", width: 14, style: { numFmt: money } },
    { header: "الدفعة المقدمة", key: "advance", width: 14, style: { numFmt: money } },
    { header: "عدد البنود", key: "items", width: 11 },
    { header: "التاريخ", key: "date", width: 14 },
  ];
  quotations.forEach((q) => qs.addRow({
    no: q.quoteNumber, cust: q.customer.name, phone: `${q.customer.phoneCode}${q.customer.phone}`,
    gov: q.customer.governorate, emp: q.employee.name, status: STATUS_AR[q.status] || q.status,
    subtotal: q.subtotal, vat: q.vatAmount, total: q.total, advance: q.advanceAmount,
    items: q._count.items, date: new Date(q.createdAt).toLocaleDateString("ar-OM"),
  }));
  styleHeader(qs);

  const cs = wb.addWorksheet("العملاء");
  cs.columns = [
    { header: "الاسم", key: "name", width: 22 },
    { header: "الهاتف", key: "phone", width: 16 },
    { header: "المحافظة", key: "gov", width: 14 },
    { header: "الولاية", key: "wil", width: 14 },
    { header: "العنوان", key: "addr", width: 24 },
    { header: "عدد العروض", key: "count", width: 12 },
    { header: "التاريخ", key: "date", width: 14 },
  ];
  customers.forEach((c) => cs.addRow({
    name: c.name, phone: `${c.phoneCode}${c.phone}`, gov: c.governorate, wil: c.wilayat,
    addr: c.address || "", count: c._count.quotations, date: new Date(c.createdAt).toLocaleDateString("ar-OM"),
  }));
  styleHeader(cs);

  const ps = wb.addWorksheet("الدفعات");
  ps.columns = [
    { header: "رقم العرض", key: "no", width: 16 },
    { header: "العميل", key: "cust", width: 22 },
    { header: "المبلغ", key: "amount", width: 14, style: { numFmt: money } },
    { header: "الطريقة", key: "method", width: 14 },
    { header: "المرجع", key: "ref", width: 16 },
    { header: "المستلِم", key: "by", width: 16 },
    { header: "التاريخ", key: "date", width: 14 },
  ];
  payments.forEach((p) => ps.addRow({
    no: p.quotation.quoteNumber, cust: p.quotation.customer.name, amount: p.amount,
    method: METHOD_AR[p.method] || p.method, ref: p.reference || "", by: p.recorder.name,
    date: new Date(p.paidAt).toLocaleDateString("ar-OM"),
  }));
  styleHeader(ps);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
