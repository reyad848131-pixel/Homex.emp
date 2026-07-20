import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { STATUS_MAP } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Phone, MapPin, Calendar, FileText, User } from "lucide-react";
import { EditCustomerButton } from "@/components/edit-customer-button";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth();
  const user = session?.user as any;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true } },
      quotations: {
        include: {
          employee: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return notFound();

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  if (!isAdmin && customer.createdBy !== user?.id) return notFound();

  const totalQuotes = customer.quotations.length;
  const approvedQuotes = customer.quotations.filter((q) => q.status === "approved");
  const totalRevenue = approvedQuotes.reduce((sum, q) => sum + q.total, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">تفاصيل العميل</p>
        </div>
        <EditCustomerButton customer={{
          id: customer.id, name: customer.name, phone: customer.phone,
          phoneCode: customer.phoneCode, governorate: customer.governorate,
          wilayat: customer.wilayat, address: customer.address,
        }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 mb-4">معلومات العميل</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="font-mono-en text-sm">{customer.phoneCode} {customer.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{customer.governorate} - {customer.wilayat}</span>
            </div>
            {customer.address && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{customer.address}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">أضافه: {customer.creator.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 font-mono-en">
                {new Date(customer.createdAt).toLocaleDateString("ar-OM")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 mb-4">إحصائيات</h2>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-black text-gray-900">{totalQuotes}</p>
              <p className="text-xs text-gray-400 mt-1">إجمالي العروض</p>
            </div>
            <div>
              <p className="text-3xl font-black text-green-600">{approvedQuotes.length}</p>
              <p className="text-xs text-gray-400 mt-1">عروض معتمدة</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 mb-4">الإيرادات</h2>
          <p className="text-3xl font-black text-gray-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">من العروض المعتمدة</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            عروض الأسعار ({totalQuotes})
          </h2>
        </div>

        {customer.quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">لا توجد عروض أسعار لهذا العميل</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">رقم العرض</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">الموظف</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">الحالة</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">البنود</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">المجموع</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {customer.quotations.map((q) => {
                  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-3 px-5">
                        <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{q.employee.name}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono-en text-gray-400 text-xs">{q._count.items}</td>
                      <td className="p-3 font-mono-en font-bold text-gray-900">{formatCurrency(q.total)}</td>
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
