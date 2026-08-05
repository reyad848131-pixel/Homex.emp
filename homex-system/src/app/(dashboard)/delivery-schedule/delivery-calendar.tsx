"use client";

import { useState, useRef, useEffect } from "react";
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

const STATUS = {
  ready: { bar: "border-s-teal-500", bg: "bg-gray-50 dark:bg-gray-800/60", pill: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", label: "جاهز" },
  late: { bar: "border-s-red-500", bg: "bg-red-50 dark:bg-red-900/15", pill: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "متأخر" },
  delivered: { bar: "border-s-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/15", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "تم التوصيل" },
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const y = monthAnchor.getFullYear(), m = monthAnchor.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) => new Date(y, m, i + 1));

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  // Bring "today" (or the first day) into view whenever the month changes.
  useEffect(() => {
    const box = scrollRef.current; if (!box) return;
    const el = box.querySelector<HTMLElement>('[data-today="1"]') || (box.firstElementChild as HTMLElement | null);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [monthAnchor]);

  const monthLabel = `${MONTHS[m]} ${y}`;

  const Card = ({ it }: { it: CalItem }) => {
    const s = STATUS[it.status];
    return (
      <div
        draggable={canEdit}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null); }}
        onClick={() => router.push(`/quotations/${it.id}`)}
        title={it.name}
        className={cn(
          "flex-1 min-h-[70px] rounded-[10px] border border-gray-200 dark:border-gray-700 border-s-[3px] px-2.5 py-1.5 flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-md",
          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          s.bar, s.bg, dragId === it.id && "opacity-40",
        )}
      >
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 flex items-start gap-1">
            {it.status === "delivered" && <span className="text-emerald-600 shrink-0">✔</span>}
            <span className="line-clamp-2 leading-tight">{it.name}</span>
          </div>
          <div className="text-[11.5px] text-gray-500 mt-0.5 flex items-center gap-1.5 min-w-0">
            <span className="truncate">{it.wilayat}</span>
            {it.time && (<><span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" /><span className="font-mono-en font-semibold text-gray-600 dark:text-gray-300 shrink-0">{it.time}</span></>)}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 min-w-0"><User className="w-3 h-3 shrink-0" /><span className="truncate">{it.driver}</span></div>
        </div>
        <span className={cn("inline-block self-start text-[9.5px] font-bold px-2 py-0.5 rounded-full", s.pill)}>{s.label}</span>
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
        data-today={isToday ? "1" : undefined}
        onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOverKey(key); } }}
        onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
        onDrop={(e) => { e.preventDefault(); if (canEdit && dragId) onReschedule(dragId, key); setDragId(null); setOverKey(null); }}
        className={cn(
          "snap-start shrink-0 w-[146px] rounded-[14px] border bg-white dark:bg-gray-800 shadow-sm flex flex-col overflow-hidden h-[288px] transition-colors",
          isToday ? "border-gray-900 dark:border-white" : "border-gray-200 dark:border-gray-700",
          overKey === key && "ring-2 ring-teal-400 border-teal-400",
        )}
      >
        <div className={cn("flex items-center justify-between gap-2 px-3 h-[46px] shrink-0 border-b border-gray-100 dark:border-gray-700", isToday && "bg-gray-900 dark:bg-white border-transparent")}>
          <div className="min-w-0">
            <div className={cn("text-[13px] font-black leading-none mb-1 truncate", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{DAY_NAMES[(day.getDay() + 1) % 7]}</div>
            <div className={cn("text-[11px] font-semibold font-mono-en whitespace-nowrap", isToday ? "text-white/80 dark:text-gray-900/70" : "text-gray-400")}>{day.getDate()} {MONTHS[day.getMonth()]}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {busy && <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">{dayItems.length}</span>}
            <span className={cn("text-[20px] font-black font-mono-en leading-none", isToday ? "text-white dark:text-gray-900" : "text-gray-800 dark:text-gray-100")}>{day.getDate()}</span>
          </div>
        </div>
        <div className="p-2 flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {dayItems.length === 0
            ? <div className="flex-1 flex items-center justify-center text-gray-200 dark:text-gray-700 text-lg select-none min-h-[36px]">·</div>
            : dayItems.map((it) => <Card key={it.id} it={it} />)}
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

      {/* Horizontal swipe strip — scroll left/right through every day of the month */}
      <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto pb-2 snap-x [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {days.map((day) => <DayCol key={ymd(day)} day={day} />)}
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">اسحب يمين/يسار للتنقّل بين الأيام{canEdit ? " · اسحب أي بطاقة بين الأيام لإعادة الجدولة" : ""}</p>
    </div>
  );
}
