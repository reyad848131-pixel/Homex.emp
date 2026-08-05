"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, ChevronRight, ChevronLeft } from "lucide-react";

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
  ready: { border: "border-r-teal-500", bg: "", pill: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", label: "جاهز" },
  late: { border: "border-r-red-500", bg: "bg-red-50 dark:bg-red-900/15", pill: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "متأخر" },
  delivered: { border: "border-r-emerald-500", bg: "bg-emerald-50/60 dark:bg-emerald-900/15", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "تم التوصيل" },
} as const;

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
// Saturday on/before the given date (week starts Saturday).
function saturdayOf(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 1) % 7)); return x; }

export function DeliveryCalendar({
  items, mode, onReschedule, canEdit,
}: {
  items: CalItem[];
  mode: "week" | "month";
  onReschedule: (id: string, date: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (mode === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d); };

  const Card = ({ it, drag }: { it: CalItem; drag: boolean }) => {
    const s = STATUS[it.status];
    return (
      <div
        draggable={drag}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null); }}
        onClick={() => router.push(`/quotations/${it.id}`)}
        className={cn(
          "rounded-lg border border-gray-200 dark:border-gray-700 border-r-4 p-2.5 transition-shadow bg-white dark:bg-gray-800 hover:shadow-md",
          drag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          s.border, s.bg, dragId === it.id && "opacity-40",
        )}
      >
        <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1">
          {it.status === "delivered" && <span className="text-emerald-600">✔</span>}{it.name}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
          <span>{it.wilayat}</span>
          {it.time && (<><span className="w-1 h-1 rounded-full bg-gray-400" /><span className="font-mono-en font-semibold text-gray-600 dark:text-gray-300">{it.time}</span></>)}
        </div>
        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><User className="w-3 h-3" />{it.driver}</div>
        <span className={cn("inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1.5", s.pill)}>{s.label}</span>
      </div>
    );
  };

  // ---- toolbar ----
  const weekStart = saturdayOf(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const rangeLabel = mode === "week"
    ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]}`
    : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const weekTotal = mode === "week" ? weekDays.reduce((s, d) => s + itemsOn(d).length, 0) : 0;

  const toolbar = (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button onClick={() => shift(1)} className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="min-w-[150px]">
        <div className="text-base font-black text-gray-900 dark:text-white font-mono-en">{rangeLabel}</div>
        {mode === "week" && <div className="text-xs text-gray-400 font-semibold">{weekTotal} توصيلة هذا الأسبوع</div>}
      </div>
      <button onClick={() => shift(-1)} className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={goToday} className="px-4 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">اليوم</button>
      <div className="flex items-center gap-3 flex-wrap ms-auto text-xs font-semibold text-gray-500">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> جاهز</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> تم التوصيل</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> متأخر</span>
      </div>
    </div>
  );

  // ---- WEEK ----
  if (mode === "week") {
    return (
      <div>
        {toolbar}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {weekDays.map((day, i) => {
            const dayItems = itemsOn(day);
            const isToday = sameDay(day, today);
            const busy = dayItems.length >= 3;
            const key = ymd(day);
            return (
              <div
                key={key}
                onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOverKey(key); } }}
                onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => { e.preventDefault(); if (canEdit && dragId) { onReschedule(dragId, key); } setDragId(null); setOverKey(null); }}
                className={cn(
                  "rounded-xl border bg-gray-50/60 dark:bg-gray-900/30 flex flex-col min-h-[120px] lg:min-h-[320px] transition-colors",
                  isToday ? "border-gray-900 dark:border-white" : "border-gray-200 dark:border-gray-700",
                  overKey === key && "ring-2 ring-teal-400 border-teal-400",
                )}
              >
                <div className={cn("flex items-start justify-between gap-2 px-3 py-2 rounded-t-xl", isToday ? "bg-gray-900 dark:bg-white" : "")}>
                  <div>
                    <div className={cn("text-[13px] font-black", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{DAY_NAMES[i]}</div>
                    <div className={cn("text-[11px] font-semibold", isToday ? "text-white/80 dark:text-gray-900/70" : "text-gray-400")}>{MONTHS[day.getMonth()]}</div>
                    {busy && <span className="inline-block mt-1 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">مزدحم · {dayItems.length}</span>}
                  </div>
                  <div className={cn("text-2xl font-black font-mono-en leading-none", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{day.getDate()}</div>
                </div>
                <div className="p-2 flex flex-col gap-2 flex-1 overflow-y-auto">
                  {dayItems.length === 0
                    ? <div className="flex-1 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600 min-h-[40px]">—</div>
                    : dayItems.map((it) => <Card key={it.id} it={it} drag={canEdit} />)}
                </div>
              </div>
            );
          })}
        </div>
        {canEdit && <p className="text-xs text-gray-400 text-center mt-4">اسحب أي بطاقة من يوم إلى يوم لإعادة الجدولة · اضغط بطاقة لفتح الطلب</p>}
      </div>
    );
  }

  // ---- MONTH ----
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 1) % 7; // Saturday-first leading blanks
  const start = new Date(first); start.setDate(1 - lead);
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  // Trim trailing empty week.
  const trimmed = cells.slice(0, cells.length - (cells.slice(35).every((d) => d.getMonth() !== cursor.getMonth()) ? 7 : 0));

  return (
    <div>
      {toolbar}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_NAMES.map((n) => <div key={n} className="text-center text-[11px] font-bold text-gray-400 py-1 hidden sm:block">{n}</div>)}
        {trimmed.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const dayItems = inMonth ? itemsOn(day) : [];
          const isToday = sameDay(day, today);
          return (
            <div key={ymd(day)} className={cn("rounded-lg border p-1.5 min-h-[96px] flex flex-col gap-1",
              inMonth ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" : "bg-gray-50/50 dark:bg-gray-900/20 border-transparent opacity-50")}>
              <div className={cn("text-[12px] font-bold self-start", isToday && "bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-6 h-6 rounded-md flex items-center justify-center")}>{day.getDate()}</div>
              {dayItems.slice(0, 3).map((it) => (
                <button key={it.id} onClick={() => router.push(`/quotations/${it.id}`)}
                  className={cn("text-[10.5px] font-bold px-1.5 py-1 rounded text-right truncate", STATUS[it.status].pill)}>
                  {it.name.split(" ")[0]}
                </button>
              ))}
              {dayItems.length > 3 && <span className="text-[10.5px] font-bold text-gray-400">+{dayItems.length - 3} أخرى</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
