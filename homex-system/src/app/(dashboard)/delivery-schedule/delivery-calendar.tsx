"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// A single delivery mapped for the calendar view.
export interface CalItem {
  id: string;
  name: string;
  wilayat: string;
  date: string;          // deliveryDate (ISO)
  time: string | null;   // "HH:MM" or null
  driver: string;
  status: "ready" | "late" | "delivered";
}

const DAY_NAMES = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const STATUS = {
  ready: { bar: "border-s-teal-500", bg: "bg-gray-50 dark:bg-gray-800/60", label: "جاهز" },
  late: { bar: "border-s-red-500", bg: "bg-red-50 dark:bg-red-900/15", label: "متأخر" },
  delivered: { bar: "border-s-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/15", label: "تم التوصيل" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DeliveryCalendar({
  monthAnchor, items, onToday, onReschedule, canEdit,
}: {
  monthAnchor: Date;
  items: CalItem[];
  onToday: () => void;
  onReschedule: (id: string, date: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const y = monthAnchor.getFullYear(), m = monthAnchor.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) => new Date(y, m, i + 1));
  const leading = (new Date(y, m, 1).getDay() + 1) % 7; // Saturday-first blanks

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  const monthLabel = `${MONTHS[m]} ${y}`;

  const Chip = ({ it }: { it: CalItem }) => {
    const s = STATUS[it.status];
    return (
      <div
        draggable={canEdit}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null); }}
        onClick={() => router.push(`/quotations/${it.id}`)}
        title={`${it.name} — ${it.wilayat}${it.time ? " · " + it.time : ""} · ${it.driver}`}
        className={cn(
          "rounded-md border border-gray-200 dark:border-gray-700 border-s-[3px] px-1.5 py-1 transition-all hover:shadow-sm",
          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          s.bar, s.bg, dragId === it.id && "opacity-40",
        )}
      >
        <div className="text-[11.5px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1 min-w-0">
          {it.status === "delivered" && <span className="text-emerald-600 shrink-0">✔</span>}
          <span className="truncate">{it.name}</span>
        </div>
        <div className="text-[10px] text-gray-500 truncate">{it.wilayat}{it.time ? <span className="font-mono-en"> · {it.time}</span> : null}</div>
      </div>
    );
  };

  const DayCell = ({ day }: { day: Date }) => {
    const dayItems = itemsOn(day);
    const isToday = sameDay(day, today);
    const busy = dayItems.length >= 3;
    const key = ymd(day);
    return (
      <div
        onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOverKey(key); } }}
        onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
        onDrop={(e) => { e.preventDefault(); if (canEdit && dragId) onReschedule(dragId, key); setDragId(null); setOverKey(null); }}
        className={cn(
          "rounded-xl border p-1.5 flex flex-col gap-1 min-h-[112px]",
          isToday ? "border-gray-900 dark:border-white bg-gray-50/50 dark:bg-gray-800/40" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
          overKey === key && "ring-2 ring-teal-400 border-teal-400",
        )}
      >
        <div className="flex items-center justify-between px-0.5">
          {busy
            ? <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">{dayItems.length}</span>
            : <span />}
          <span className={cn("text-[14px] font-black font-mono-en leading-none", isToday ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-6 h-6 rounded-md flex items-center justify-center" : "text-gray-700 dark:text-gray-200")}>{day.getDate()}</span>
        </div>
        <div className="flex flex-col gap-1">
          {dayItems.map((it) => <Chip key={it.id} it={it} />)}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="min-w-[130px]">
          <div className="text-[15px] font-black text-gray-900 dark:text-white">{monthLabel}</div>
          <div className="text-xs text-gray-400 font-semibold"><span className="font-mono-en">{items.length}</span> توصيلة هذا الشهر</div>
        </div>
        <button onClick={onToday} className="px-4 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">اليوم</button>
        <div className="flex items-center gap-3 flex-wrap ms-auto text-xs font-semibold text-gray-500">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> جاهز</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> تم التوصيل</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> متأخر</span>
        </div>
      </div>

      {/* Full-month grid — all days at once, rows of 7 (Saturday-first) */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-7 gap-2 mb-1.5">
            {DAY_NAMES.map((n) => <div key={n} className="text-center text-[11px] font-bold text-gray-400">{n}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leading }, (_, i) => <div key={`b${i}`} />)}
            {days.map((day) => <DayCell key={ymd(day)} day={day} />)}
          </div>
        </div>
      </div>
      {canEdit && <p className="text-xs text-gray-400 text-center mt-3">اسحب أي بطاقة بين الأيام لإعادة الجدولة · اضغط بطاقة لفتح الطلب</p>}
    </div>
  );
}
