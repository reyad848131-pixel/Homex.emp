"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Phone, MessageCircle, FileText, X, User } from "lucide-react";

// A single delivery mapped for the calendar view.
export interface CalItem {
  id: string;
  name: string;
  wilayat: string;
  governorate: string;
  quoteNumber: string;
  phone: string;
  phoneCode: string;
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
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export function DeliveryCalendar({
  monthAnchor, items, onToday, onPrevMonth, onNextMonth, onReschedule, canEdit,
}: {
  monthAnchor: Date;
  items: CalItem[];
  onToday: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReschedule: (id: string, date: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const waHref = (it: CalItem) => `https://wa.me/${`${it.phoneCode}${it.phone}`.replace(/\D/g, "")}`;

  useEffect(() => {
    if (!openDay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay]);

  // ── Finger-following carousel ──────────────────────────────────────────────
  // Three month panels (prev / current / next) sit side by side in a track that
  // is translated -1 panel to centre the current month. The finger drags the
  // track in real time; on release it snaps to a neighbour and commits the month
  // change, then silently re-centres on the new current month.
  const trackRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const gesture = useRef<{ x: number; y: number; axis: "?" | "x" | "y" } | null>(null);
  const pending = useRef<"next" | "prev" | null>(null);
  const [offset, setOffset] = useState(0); // px the finger has dragged the track
  const [anim, setAnim] = useState(false); // whether the snap transition is on

  const onTouchStart = (e: React.TouchEvent) => {
    if (openDay || dragId) return;
    widthRef.current = trackRef.current?.parentElement?.clientWidth ?? 0;
    const t = e.touches[0];
    gesture.current = { x: t.clientX, y: t.clientY, axis: "?" };
    setAnim(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (g.axis === "?") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (g.axis === "y") return; // vertical → let the page scroll
    setOffset(dx);
  };
  const onTouchEnd = () => {
    const g = gesture.current; gesture.current = null;
    if (!g || g.axis !== "x") { if (offset) { setAnim(true); setOffset(0); } return; }
    const w = widthRef.current || 1;
    const threshold = Math.min(w * 0.22, 90);
    setAnim(true);
    if (offset <= -threshold) { pending.current = "prev"; setOffset(-w); }
    else if (offset >= threshold) { pending.current = "next"; setOffset(w); }
    else { pending.current = null; setOffset(0); }
  };
  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== trackRef.current || e.propertyName !== "transform") return;
    const dir = pending.current;
    if (!dir) return;
    pending.current = null;
    if (dir === "next") onNextMonth(); else onPrevMonth();
    // Re-centre instantly on the new current month (panels have re-indexed).
    setAnim(false);
    setOffset(0);
  };

  const cur = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const prevMonth = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  const curCount = items.filter((it) => sameMonth(new Date(it.date), cur)).length;
  const monthLabel = `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`;

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  const Chip = ({ it }: { it: CalItem }) => {
    const s = STATUS[it.status];
    return (
      <div
        draggable={canEdit}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null); }}
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
        onClick={() => { if (dayItems.length) setOpenDay(day); }}
        onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOverKey(key); } }}
        onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
        onDrop={(e) => { e.preventDefault(); if (canEdit && dragId) onReschedule(dragId, key); setDragId(null); setOverKey(null); }}
        className={cn(
          "rounded-xl border p-1.5 flex flex-col gap-1 min-h-[112px]",
          dayItems.length && "cursor-pointer hover:border-gray-400 dark:hover:border-gray-500",
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

  // One month's grid of day cells (Saturday-first). Rendered inside each panel.
  const MonthGrid = ({ anchor }: { anchor: Date }) => {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const days = Array.from({ length: lastDay }, (_, i) => new Date(y, m, i + 1));
    const leading = (new Date(y, m, 1).getDay() + 1) % 7;
    return (
      <div className="grid grid-cols-7 gap-2 content-start">
        {Array.from({ length: leading }, (_, i) => <div key={`b${i}`} />)}
        {days.map((day) => <DayCell key={ymd(day)} day={day} />)}
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="min-w-[130px]">
          <div className="text-[15px] font-black text-gray-900 dark:text-white">{monthLabel}</div>
          <div className="text-xs text-gray-400 font-semibold"><span className="font-mono-en">{curCount}</span> توصيلة هذا الشهر</div>
        </div>
        <button onClick={onToday} className="px-4 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">اليوم</button>
        <div className="flex items-center gap-3 flex-wrap ms-auto text-xs font-semibold text-gray-500">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> جاهز</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> تم التوصيل</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> متأخر</span>
        </div>
      </div>

      {/* Weekday header (fixed — shared by every month). */}
      <div className="grid grid-cols-7 gap-2 mb-1.5">
        {DAY_NAMES.map((n) => <div key={n} className="text-center text-[11px] font-bold text-gray-400">{n}</div>)}
      </div>

      {/* Carousel: swipe the track left/right; it follows the finger and snaps.
          Forced LTR so the transform math is direction-independent; each panel's
          content is restored to RTL. */}
      <div dir="ltr" className="overflow-hidden" style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div
          ref={trackRef}
          onTransitionEnd={onTrackTransitionEnd}
          className={cn("flex items-start", anim && "transition-transform duration-300 ease-out")}
          style={{ width: "300%", transform: `translateX(calc(-33.3333% + ${offset}px))`, willChange: "transform" }}
        >
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={nextMonth} /></div>
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={cur} /></div>
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={prevMonth} /></div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-3">اضغط أي يوم لعرض طلباته · اسحب يمين/يسار لتغيير الشهر{canEdit ? " · اسحب بطاقة لإعادة الجدولة" : ""}</p>

      {/* Day detail modal */}
      {openDay && (() => {
        const list = itemsOn(openDay);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpenDay(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[82vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="text-base font-black text-gray-900 dark:text-white">{DAY_NAMES[(openDay.getDay() + 1) % 7]} · <span className="font-mono-en">{openDay.getDate()} {MONTHS[openDay.getMonth()]}</span></div>
                  <div className="text-xs text-gray-400 font-semibold"><span className="font-mono-en">{list.length}</span> توصيلة</div>
                </div>
                <button onClick={() => setOpenDay(null)} className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="إغلاق"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 overflow-y-auto flex flex-col gap-2.5">
                {list.map((it) => {
                  const s = STATUS[it.status];
                  const tel = `${it.phoneCode}${it.phone}`;
                  return (
                    <div key={it.id} className={cn("rounded-xl border border-gray-200 dark:border-gray-700 border-s-[3px] p-3", s.bar, s.bg)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            {it.status === "delivered" && <span className="text-emerald-600">✔</span>}{it.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{it.governorate} — {it.wilayat} · <span className="font-mono-en">{it.quoteNumber}</span></div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                            {it.time && <span className="font-mono-en">{it.time}</span>}
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{it.driver}</span>
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", s.pill)}>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold hover:opacity-90"><Phone className="w-3.5 h-3.5" /> اتصال</a>
                        <a href={waHref(it)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700"><MessageCircle className="w-3.5 h-3.5" /> واتساب</a>
                        <button onClick={() => router.push(`/quotations/${it.id}`)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 ms-auto"><FileText className="w-3.5 h-3.5" /> فتح الطلب</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
