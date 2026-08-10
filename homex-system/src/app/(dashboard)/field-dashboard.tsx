"use client";

import Link from "next/link";
import { CalendarClock, AlertTriangle, Camera, ArrowUpRight, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Focused dashboard for field roles (driver / photographer): straight to their
// work, no quote statistics or financial figures they can't act on.
export function FieldDashboard({
  userName,
  role,
  todayDeliveries,
  overdueDeliveries,
  photoQueue,
}: {
  userName: string;
  role: string;
  todayDeliveries: number;
  overdueDeliveries: number;
  photoQueue: number;
}) {
  const isPhotographer = role === "photographer";
  const { t, locale } = useI18n();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("welcome")}{locale === "ar" ? " " : " "}{userName} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isPhotographer ? t("fdPhotoSub") : t("fdDeliverSub")}
        </p>
      </div>

      {/* Primary action */}
      <Link
        href={isPhotographer ? "/photography" : "/delivery-schedule"}
        className="flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl p-5 mb-4 hover:opacity-90 transition-opacity"
      >
        <div className="w-11 h-11 rounded-lg bg-white/15 dark:bg-gray-900/10 flex items-center justify-center shrink-0">
          {isPhotographer ? <Camera className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold">{isPhotographer ? t("fdPhotoList") : t("deliverySchedule")}</p>
          <p className="text-sm opacity-80">{isPhotographer ? t("fdPhotoReady") : t("fdDeliveryTimes")}</p>
        </div>
        <ArrowUpRight className="w-6 h-6 shrink-0" />
      </Link>

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isPhotographer ? (
          <Link href="/photography" className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-center gap-3 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors">
            <Camera className="w-5 h-5 text-teal-600 dark:text-teal-300 shrink-0" />
            <div>
              <p className="text-2xl font-black font-mono-en text-teal-700 dark:text-teal-300">{photoQueue}</p>
              <p className="text-xs font-bold text-teal-700 dark:text-teal-300">{t("fdWaitingPhoto")}</p>
            </div>
          </Link>
        ) : (
          <>
            <Link href="/delivery-schedule" className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-center gap-3 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors">
              <CalendarClock className="w-5 h-5 text-teal-600 dark:text-teal-300 shrink-0" />
              <div>
                <p className="text-2xl font-black font-mono-en text-teal-700 dark:text-teal-300">{todayDeliveries}</p>
                <p className="text-xs font-bold text-teal-700 dark:text-teal-300">{t("fdTodayDelivery")}</p>
              </div>
            </Link>
            <Link href="/delivery-schedule" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-300 shrink-0" />
              <div>
                <p className="text-2xl font-black font-mono-en text-red-700 dark:text-red-300">{overdueDeliveries}</p>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">{t("fdOverdue")}</p>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
