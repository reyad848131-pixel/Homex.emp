"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

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

// Card styling per status — mirrors the mockup (coloured inline-start border,
// tinted background for done/late).
const STATUS = {
  ready: { bar: "border-s-teal-500", bg: "bg-gray-50 dark:bg-gray-800/60", pill: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", label: "جاهز" },
  late: { bar: "border-s-red-500", bg: "bg-red-50 dark:bg-red-900/15", pill: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "متأخر" },
  delivered: { bar: "border-s-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/15", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "تم التوصيل" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function eachDay(from: string, to: string): Date[] {
  const out: Date[] = [];
  const s = new Date(from + "T00:00:00");
  const e = new Date(to + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}

export function DeliveryCalendar({
  items, from, to, onReschedule, canEdit,
}: {
  items: CalItem[];
  from: string;
  to: string;
  onReschedule: (id: string, date: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const days = eachDay(from, to);
  const multiWeek = days.length > 8; // whole month → align to Saturday-first rows
  const leading = multiWeek ? (days[0].getDay() + 1) % 7 : 0;

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  const Card = ({ it }: { it: CalItem }) => {
    const s = STATUS[it.status];
    return (
      <div
        draggable={canEdit}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null); }}
        onClick={() => router.push(`/quotations/${it.id}`)}
        className={cn(
          "rounded-[10px] border border-gray-200 dark:border-gray-700 border-s-[3px] px-2.5 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md",
          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          s.bar, s.bg, dragId === it.id && "opacity-40",
        )}
      >
        <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1">
          {it.status === "delivered" && <span className="text-emerald-600">✔</span>}{it.name}
        </div>
        <div className="text-[11.5px] text-gray-500 mt-0.5 flex items-center gap-1.5">
          <span>{it.wilayat}</span>
          {it.time && (<><span className="w-1 h-1 rounded-full bg-gray-400" /><span className="font-mono-en font-semibold text-gray-600 dark:text-gray-300">{it.time}</span></>)}
        </div>
        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><User className="w-3 h-3" />{it.driver}</div>
        <span className={cn("inline-block text-[9.5px] font-bold px-2 py-0.5 rounded-full mt-1.5", s.pill)}>{s.label}</span>
      </div>
    );
  };

  const DayCol = ({ day }: { day: Date }) => {
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
          "rounded-[14px] border bg-white dark:bg-gray-800 shadow-sm flex flex-col overflow-hidden min-h-[220px] lg:min-h-[340px] transition-colors",
          isToday ? "border-gray-900 dark:border-white" : "border-gray-200 dark:border-gray-700",
          overKey === key && "ring-2 ring-teal-400 border-teal-400",
        )}
      >
        <div className={cn("flex items-start justify-between gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700", isToday && "bg-gray-900 dark:bg-white border-transparent")}>
          <div>
            <div className={cn("text-[13px] font-black", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{DAY_NAMES[(day.getDay() + 1) % 7]}</div>
            <div className={cn("text-[11px] font-semibold font-mono-en", isToday ? "text-white/80 dark:text-gray-900/70" : "text-gray-400")}>{day.getDate()} {MONTHS[day.getMonth()]}</div>
            {busy && <span className="inline-block mt-1.5 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">مزدحم · {dayItems.length}</span>}
          </div>
          <div className={cn("text-[22px] font-black font-mono-en leading-none", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{day.getDate()}</div>
        </div>
        <div className="p-2.5 flex flex-col gap-2 flex-1 overflow-y-auto">
          {dayItems.length === 0
            ? <div className="flex-1 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600 min-h-[40px]">لا توصيلات</div>
            : dayItems.map((it) => <Card key={it.id} it={it} />)}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Legend (mockup) */}
      <div className="flex items-center gap-4 flex-wrap mb-3 text-xs font-semibold text-gray-500">
        <span className="font-bold text-gray-700 dark:text-gray-200 font-mono-en">{items.length} <span className="font-sans">توصيلة</span></span>
        <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> جاهز للتوصيل</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> تم التوصيل</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> متأخر</span>
      </div>

      {multiWeek && (
        <div className="hidden lg:grid grid-cols-7 gap-2.5 mb-1.5">
          {DAY_NAMES.map((n) => <div key={n} className="text-center text-[11px] font-bold text-gray-400">{n}</div>)}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-2.5">
        {multiWeek && Array.from({ length: leading }, (_, i) => <div key={`b${i}`} className="hidden lg:block" />)}
        {days.map((day) => <DayCol key={ymd(day)} day={day} />)}
      </div>
      {canEdit && <p className="text-xs text-gray-400 text-center mt-4">اسحب أي بطاقة من يوم إلى يوم لإعادة الجدولة · اضغط بطاقة لفتح الطلب</p>}
    </div>
  );
}
