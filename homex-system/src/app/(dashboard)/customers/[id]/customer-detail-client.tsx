"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Phone, MapPin, Calendar, FileText, User, Trash2, Loader2 } from "lucide-react";
import { EditCustomerButton } from "@/components/edit-customer-button";
import { useToast } from "@/components/toast";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { STATUS_MAP } from "@/lib/types";

const STATUS_KEYS: Record<string, TranslationKey> = {
  draft: "statusDraft",
  pending: "statusPending",
  approved: "statusApproved",
  sent: "statusSent",
  accepted: "statusAccepted",
  revised: "statusRevised",
  declined: "statusDeclined",
  cancelled: "statusCancelled",
};

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  phoneCode: string;
  governorate: string;
  wilayat: string;
  address: string | null;
  creatorName: string;
  createdAt: string;
  totalQuotes: number;
  approvedCount: number;
  canManage?: boolean;
  canSeeFinancials?: boolean;
  totalRevenue: number | null;
  quotations: Array<{
    id: string;
    quoteNumber: string;
    employeeName: string;
    status: string;
    itemCount: number;
    total: number | null;
    createdAt: string;
  }>;
}

export function CustomerDetailClient({ data }: { data: CustomerData }) {
  const { t, dateLocale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;
  const showMoney = data.canSeeFinancials !== false;

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${data.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("deletedSuccess"));
        router.push("/customers");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("deleteFailed"));
        setDeleting(false);
      }
    } catch {
      toast.error(t("serverConnectionError"));
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("customerDetails")}</p>
        </div>
        {data.canManage !== false && (
          <div className="flex items-center gap-2">
            <EditCustomerButton customer={{
              id: data.id, name: data.name, phone: data.phone,
              phoneCode: data.phoneCode, governorate: data.governorate,
              wilayat: data.wilayat, address: data.address,
            }} />
            {data.totalQuotes === 0 && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50 disabled:opacity-50">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t("delete")}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 mb-4">{t("customerInfo")}</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="font-mono-en text-sm">{data.phoneCode} {data.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{data.governorate} - {data.wilayat}</span>
            </div>
            {data.address && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{data.address}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{t("addedBy")}: {data.creatorName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 font-mono-en">
                {new Date(data.createdAt).toLocaleDateString(dateLocale)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
          <h2 className="text-sm font-bold text-gray-400 mb-4">{t("statistics")}</h2>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-black text-gray-900">{data.totalQuotes}</p>
              <p className="text-xs text-gray-400 mt-1">{t("totalQuotes")}</p>
            </div>
            <div>
              <p className="text-3xl font-black text-green-600">{data.approvedCount}</p>
              <p className="text-xs text-gray-400 mt-1">{t("approvedQuotes")}</p>
            </div>
          </div>
        </div>

        {showMoney && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-sm font-bold text-gray-400 mb-4">{t("revenueTitle")}</h2>
            <p className="text-3xl font-black text-gray-900">{data.totalRevenue != null ? fmtCur(data.totalRevenue) : "—"}</p>
            <p className="text-xs text-gray-400 mt-1">{t("fromApproved")}</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            {t("quotations")} ({data.totalQuotes})
          </h2>
        </div>

        {data.quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">{t("noQuotationsForCustomer")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("quoteNumber")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("employee")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("status")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("items")}</th>
                  {showMoney && <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("total")}</th>}
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.quotations.map((q) => {
                  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
                  const statusKey = STATUS_KEYS[q.status];
                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-3 px-5">
                        {showMoney ? (
                          <Link href={`/quotations/${q.id}`} className="font-mono-en font-bold text-gray-900 hover:underline">
                            {q.quoteNumber}
                          </Link>
                        ) : (
                          <span className="font-mono-en font-bold text-gray-900">{q.quoteNumber}</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{q.employeeName}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {statusKey ? t(statusKey) : status.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono-en text-gray-400 text-xs">{q.itemCount}</td>
                      {showMoney && <td className="p-3 font-mono-en font-bold text-gray-900">{q.total != null ? fmtCur(q.total) : "—"}</td>}
                      <td className="p-3 text-gray-400 font-mono-en text-xs">
                        {new Date(q.createdAt).toLocaleDateString(dateLocale)}
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
