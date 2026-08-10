"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Phone, MapPin, Search, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/empty-state";

interface Customer {
  id: string;
  name: string;
  phone: string;
  phoneCode: string;
  governorate: string;
  wilayat: string;
  creatorName: string;
  quotationCount: number;
}

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const { t } = useI18n();

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.governorate.includes(q) ||
      c.wilayat.includes(q)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("customersTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} {t("customerCount")}</p>
        </div>
        <a href="/api/export?type=customers"
          className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title={t("custDownloadTitle")}>
          <Download className="w-4 h-4" /> {t("exportWord")}
        </a>
      </div>

      {customers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded pr-10 pl-3 py-2.5 text-sm"
              placeholder={t("searchCustomers")}
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
          <EmptyState
            icon={Users}
            title={search ? t("noSearchResults") : t("noCustomersYet")}
            description={!search ? t("customersAutoAdd") : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link href={`/customers/${c.id}`} key={c.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5 hover:border-gray-300 transition-colors block">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t("createdBy")} {c.creatorName}</p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                  {c.quotationCount} {t("quotesCount")}
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
