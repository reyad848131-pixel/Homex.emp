import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Users, Phone, MapPin } from "lucide-react";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const customers = await prisma.customer.findMany({
    where: isAdmin ? {} : { createdBy: user?.id },
    include: {
      _count: { select: { quotations: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <p className="text-sm text-gray-500 mt-1">{customers.length} عميل</p>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">لا يوجد عملاء بعد</p>
          <p className="text-sm text-gray-400 mt-1">سيتم إضافة العملاء تلقائياً عند إنشاء عروض الأسعار</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">بواسطة {c.creator.name}</p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                  {c._count.quotations} عروض
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono-en">{c.phoneCode} {c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{c.governorate} - {c.wilayat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
