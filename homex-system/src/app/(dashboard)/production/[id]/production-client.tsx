"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, X, Plus, Package, FileText, HardHat, Layers, Sparkles } from "lucide-react";
import { DEFAULT_STAGES, initials } from "@/lib/workers";

interface WorkerLite { id: string; name: string; color: string }
interface Task { id: string; stage: string; workerId: string | null; doneAt: string | null; sortOrder: number; worker: WorkerLite | null }
interface Item {
  id: string; description: string; quantity: number; lineTotal: number;
  category: { nameAr: string; nameEn: string };
  tasks: Task[];
}
interface Order {
  id: string; quoteNumber: string; total: number; deliveryDate: string | null; workStatus: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string };
  items: Item[];
}

// A quick starter template applied to every item in one tap.
const QUICK_TEMPLATE = ["نجارة", "دهان", "تغليف"];

function Avatar({ color, name, size = 26 }: { color: string; name: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-lg font-black shrink-0"
      style={{ width: size, height: size, background: color, color: "#0c0c0e", fontSize: size * 0.42 }}>
      {initials(name)}
    </span>
  );
}

function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = (size - 7) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (total ? done / total : 0));
  const complete = total > 0 && done === total;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={complete ? "text-emerald-500" : "text-teal-500"} stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .4s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black font-mono-en leading-none">{done}/{total}</span>
        <span className="text-[9px] text-gray-400 font-bold mt-0.5">مرحلة</span>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "قبل قليل";
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

interface Handlers {
  assign: (itemId: string, taskId: string, workerId: string | null) => void;
  toggle: (itemId: string, taskId: string, done: boolean) => void;
  remove: (itemId: string, taskId: string) => void;
  add: (itemId: string, stage: string) => void;
}

function StageCard({ task, index, itemId, workers, h }: { task: Task; index: number; itemId: string; workers: WorkerLite[]; h: Handlers }) {
  const done = !!task.doneAt;
  const w = task.worker;
  return (
    <div className={cn(
      "rounded-xl border p-3.5 flex flex-col gap-3 w-full sm:w-[230px] transition-colors",
      done ? "bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800"
        : w ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
        : "bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600"
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-sm flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-700 grid place-items-center text-[10px] font-mono-en text-gray-500 shrink-0">{index + 1}</span>
          <span className="truncate">{task.stage}</span>
        </span>
        <button onClick={() => h.remove(itemId, task.id)} className="text-gray-300 hover:text-red-500 shrink-0" title="حذف المرحلة"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-2 py-1.5">
        <Avatar color={w ? w.color : "#cbd5e1"} name={w ? w.name : "؟"} size={26} />
        <select
          value={task.workerId || ""}
          onChange={(e) => h.assign(itemId, task.id, e.target.value || null)}
          className="text-sm font-semibold bg-transparent flex-1 min-w-0 outline-none cursor-pointer text-gray-700 dark:text-gray-200"
        >
          <option value="">اختر عاملاً…</option>
          {workers.map((wk) => <option key={wk.id} value={wk.id}>{wk.name}</option>)}
        </select>
      </div>

      <button
        onClick={() => h.toggle(itemId, task.id, !done)}
        className={cn(
          "h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors",
          done ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white hover:opacity-90"
        )}
      >
        {done ? <><Check className="w-4 h-4" /> منجز · {timeAgo(task.doneAt!)}</> : "علّم كمنجز"}
      </button>
    </div>
  );
}

function AddStage({ itemId, onAdd }: { itemId: string; onAdd: (itemId: string, stage: string) => void }) {
  const pick = (v: string) => {
    if (!v) return;
    const stage = v === "__custom__" ? (window.prompt("اسم المرحلة:") || "").trim() : v;
    if (stage) onAdd(itemId, stage);
  };
  return (
    <label className="relative overflow-hidden w-full sm:w-[230px] min-h-[130px] rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-teal-600 hover:border-teal-400 cursor-pointer transition-colors">
      <Plus className="w-5 h-5" />
      <span className="text-sm font-bold">إضافة مرحلة</span>
      <select className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value="" onChange={(e) => { pick(e.target.value); e.target.value = ""; }}>
        <option value="">إضافة مرحلة…</option>
        {DEFAULT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value="__custom__">مخصّص…</option>
      </select>
    </label>
  );
}

function ItemSection({ item, workers, h, locale }: { item: Item; workers: WorkerLite[]; h: Handlers; locale: string }) {
  const done = item.tasks.filter((t) => t.doneAt).length;
  const total = item.tasks.length;
  const catName = locale === "en" ? item.category.nameEn : item.category.nameAr;
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-lg truncate">{item.description}</h3>
            <span className="text-gray-400 font-mono-en text-sm shrink-0">×{item.quantity}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">
            <Layers className="w-3 h-3" /> {catName}
          </span>
        </div>
        {total > 0 && (
          <div className="ms-auto flex items-center gap-2 shrink-0">
            <div className="w-28 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-gray-500 font-mono-en">{done}/{total}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-stretch">
        {item.tasks.map((task, i) => <StageCard key={task.id} task={task} index={i} itemId={item.id} workers={workers} h={h} />)}
        <AddStage itemId={item.id} onAdd={h.add} />
      </div>
    </div>
  );
}

export function ProductionClient({ order, workers }: { order: Order; workers: WorkerLite[] }) {
  const [items, setItems] = useState<Item[]>(order.items);
  const locale = "ar";

  const totalTasks = items.reduce((s, it) => s + it.tasks.length, 0);
  const doneTasks = items.reduce((s, it) => s + it.tasks.filter((t) => t.doneAt).length, 0);

  const setItemTasks = (itemId: string, fn: (tasks: Task[]) => Task[]) =>
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, tasks: fn(it.tasks) } : it)));

  const h: Handlers = {
    add: (itemId, stage) => {
      fetch("/api/item-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteItemId: itemId, stage }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((task) => { if (task) setItemTasks(itemId, (ts) => [...ts, task]); })
        .catch(() => {});
    },
    assign: (itemId, taskId, workerId) => {
      const w = workers.find((x) => x.id === workerId) || null;
      setItemTasks(itemId, (ts) => ts.map((t) => (t.id === taskId ? { ...t, workerId, worker: w } : t)));
      fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, workerId }) }).catch(() => {});
    },
    toggle: (itemId, taskId, done) => {
      setItemTasks(itemId, (ts) => ts.map((t) => (t.id === taskId ? { ...t, doneAt: done ? new Date().toISOString() : null } : t)));
      fetch("/api/item-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, done }) }).catch(() => {});
    },
    remove: (itemId, taskId) => {
      setItemTasks(itemId, (ts) => ts.filter((t) => t.id !== taskId));
      fetch(`/api/item-tasks?id=${taskId}`, { method: "DELETE" }).catch(() => {});
    },
  };

  // Apply one stage to every item at once.
  const applyToAll = (stage: string) => {
    if (!stage) return;
    const ids = items.map((it) => it.id);
    fetch("/api/item-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteItemIds: ids, stage }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((tasks: Array<Task & { quoteItemId: string }> | null) => {
        if (!Array.isArray(tasks)) return;
        // Map each created task back to its item by quoteItemId.
        const byItem = new Map<string, Task[]>();
        for (const t of tasks) {
          const arr = byItem.get(t.quoteItemId) || [];
          arr.push(t); byItem.set(t.quoteItemId, arr);
        }
        setItems((prev) => prev.map((it) => byItem.has(it.id) ? { ...it, tasks: [...it.tasks, ...byItem.get(it.id)!] } : it));
      })
      .catch(() => {});
  };

  const applyTemplate = async () => {
    for (const stage of QUICK_TEMPLATE) applyToAll(stage);
  };

  const days = order.deliveryDate ? Math.ceil((new Date(new Date(order.deliveryDate).toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;

  return (
    <div>
      <Link href="/work-orders" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white mb-4">
        <ArrowRight className="w-4 h-4" /> رجوع لإدارة الأعمال
      </Link>

      {/* Order header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 mb-4 flex items-center gap-4 flex-wrap">
        <ProgressRing done={doneTasks} total={totalTasks} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <HardHat className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-black">خط الإنتاج</h1>
            <Link href={`/quotations/${order.id}`} className="font-mono-en font-bold text-sm text-teal-600 hover:underline flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> {order.quoteNumber}
            </Link>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 font-semibold mt-1">{order.customer.name}</div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{order.customer.governorate} — {order.customer.wilayat}</span>
            {order.deliveryDate && <><span>·</span><span>التسليم <span className="font-mono-en">{new Date(order.deliveryDate).toLocaleDateString("ar-OM", { day: "numeric", month: "short" })}</span></span></>}
            {days != null && days >= 0 && <span className={cn("font-bold", days <= 7 ? "text-red-500" : days <= 30 ? "text-orange-500" : "text-gray-400")}>· باقٍ <span className="font-mono-en">{days}</span> يوم</span>}
            {days != null && days < 0 && <span className="font-bold text-red-500">· متأخّر <span className="font-mono-en">{Math.abs(days)}</span> يوم</span>}
          </div>
        </div>
      </div>

      {/* Toolbar: apply a stage / a quick template to ALL items at once */}
      {items.length > 1 && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/15 p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-teal-800 dark:text-teal-200 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> تسريع: طبّق على كل الأصناف دفعة واحدة</span>
          <label className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white dark:bg-gray-800 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 text-sm font-bold cursor-pointer">
            <Plus className="w-4 h-4" /> أضف مرحلة للكل
            <select className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value="" onChange={(e) => { const v = e.target.value; if (v) applyToAll(v === "__custom__" ? (window.prompt("اسم المرحلة:") || "").trim() : v); e.target.value = ""; }}>
              <option value="">اختر مرحلة…</option>
              {DEFAULT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__custom__">مخصّص…</option>
            </select>
          </label>
          <button onClick={applyTemplate} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700">
            <Layers className="w-4 h-4" /> قالب سريع ({QUICK_TEMPLATE.join(" · ")})
          </button>
        </div>
      )}

      {workers.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 p-3 mb-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
          لا يوجد عمّال بعد — أضِف فريقك من صفحة «العمّال» لتعيينهم على المراحل.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          لا توجد أصناف في هذا الطلب.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => <ItemSection key={item.id} item={item} workers={workers} h={h} locale={locale} />)}
        </div>
      )}
    </div>
  );
}
