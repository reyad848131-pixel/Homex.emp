import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { STATUS_MAP } from "@/lib/types";
import Link from "next/link";
import { FileText, FilePlus, Users, TrendingUp, Clock, CheckCircle, XCircle, BarChart3, ArrowUpRight, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const session = await getAuth();
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;

  const isAdmin = role === "admin" || role === "manager";
  const whereClause = isAdmin ? {} : { employeeId: userId };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalQuotes, totalCustomers, quotations, monthlyQuotes, statusCounts] = await Promise.all([
    prisma.quotation.count({ where: whereClause }),
    prisma.customer.count({ where: isAdmin ? {} : { createdBy: userId } }),
    prisma.quotation.findMany({
      where: whereClause,
      include: { customer: true, employee: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.quotation.count({ where: { ...whereClause, createdAt: { gte: monthStart } } }),
    Promise.all([
      prisma.quotation.count({ where: { ...whereClause, status: "draft" } }),
      prisma.quotation.count({ where: { ...whereClause, status: "pending" } }),
      prisma.quotation.count({ where: { ...whereClause, status: "approved" } }),
      prisma.quotation.count({ where: { ...whereClause, status: "declined" } }),
      prisma.quotation.count({ where: { ...whereClause, status: "revised" } }),
    ]),
  ]);

  const [draftCount, pendingCount, approvedCount, declinedCount, revisedCount] = statusCounts;

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringQuotations = await prisma.quotation.findMany({
    where: {
      ...whereClause,
      status: { in: ["draft", "pending", "revised"] },
      validUntil: { not: null, lte: sevenDaysFromNow },
    },
    include: { customer: true },
    orderBy: { validUntil: "asc" },
    take: 5,
  });

  const revenueAgg = await prisma.quotation.aggregate({
    where: { ...whereClause, status: "approved" },
    _sum: { total: true },
  });
  const totalRevenue = revenueAgg._sum.total || 0;

  const conversionRate = totalQuotes > 0 ? ((approvedCount / totalQuotes) * 100).toFixed(0) : "0";

  const stats = [
    { label: "إجمالي العروض", value: totalQuotes, sub: `${monthlyQuotes} هذا الشهر`, icon: FileText, color: "bg-blue-50 text-blue-600" },
    { label: "العملاء", value: totalCustomers, sub: null, icon: Users, color: "bg-green-50 text-green-600" },
    { label: "الإيرادات المعتمدة", value: formatCurrency(totalRevenue), sub: `${conversionRate}% نسبة التحويل`, icon: TrendingUp, color: "bg-purple-50 text-purple-600" },
    { label: "قيد المراجعة", value: pendingCount, sub: `${draftCount} مسودة`, icon: Clock, color: "bg-yellow-50 text-yellow-600" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {session?.user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">إليك ملخص نشاطك اليوم</p>
        </div>
        <Link
          href="/quotations/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          عرض سعر جديد
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">{stat.label}</p>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
            {stat.sub && <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "مسودة", count: draftCount, color: "border-gray-300 text-gray-600 bg-gray-50" },
          { label: "قيد المراجعة", count: pendingCount, color: "border-blue-300 text-blue-600 bg-blue-50" },
          { label: "معتمد", count: approvedCount, color: "border-green-300 text-green-600 bg-green-50" },
          { label: "مُعاد للتعديل", count: revisedCount, color: "border-orange-300 text-orange-600 bg-orange-50" },
          { label: "مرفوض", count: declinedCount, color: "border-red-300 text-red-600 bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={`border rounded p-3 text-center ${s.color}`}>
            <p className="text-2xl font-black font-mono-en">{s.count}</p>
            <p className="text-xs font-bold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expiring Quotations Alert */}
      {expiringQuotations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">عروض أسعار تقترب من انتهاء الصلاحية</h2>
          </div>
          <div className="space-y-2">
            {expiringQuotations.map((q) => {
              const daysLeft = Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft <= 0;
              return (
                <div key={q.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-3 border border-amber-100 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 dark:text-white hover:underline text-sm">
                      {q.quoteNumber}
                    </Link>
                    <span className="text-sm text-gray-600">{q.customer.name}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${isExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {isExpired ? "منتهي الصلاحية" : `${daysLeft} يوم متبقي`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Quotations */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold">آخر عروض الأسعار</h2>
          <Link href="/quotations" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white font-semibold">
            عرض الكل
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">لا توجد عروض أسعار بعد</p>
            <Link
              href="/quotations/new"
              className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-gray-900 hover:underline"
            >
              <FilePlus className="w-4 h-4" />
              إنشاء أول عرض سعر
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold uppercase tracking-wider">رقم العرض</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">العميل</th>
                  {isAdmin && <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">الموظف</th>}
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">الحالة</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">البنود</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">المجموع</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => {
                  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
                  return (
                    <tr key={q.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="p-3 px-5">
                        <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 dark:text-white hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{q.customer.name}</td>
                      {isAdmin && <td className="p-3 text-gray-500 text-xs">{q.employee.name}</td>}
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono-en text-gray-400 text-xs">{q._count.items}</td>
                      <td className="p-3 font-mono-en font-bold text-gray-900 dark:text-white">{formatCurrency(q.total)}</td>
                      <td className="p-3 text-gray-400 font-mono-en text-xs">
                        {new Date(q.createdAt).toLocaleDateString("ar-OM")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
