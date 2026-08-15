"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingBag, Plus, Trash2, Search, Loader2, Send, Power, Clock3, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { normalizePhone } from "@/lib/text";
import { waLinkFor } from "@/lib/wa";
import { useToast } from "@/components/toast";

interface Supplier { id: string; name: string; phone: string; phoneCode: string; category: string | null; note: string | null; isActive: boolean; }
interface Material { id: string; category: string; name: string; code: string | null; unit: string; packSize: string | null; supplierId: string | null; isActive: boolean; stock: number; minStock: number; demand?: number; }
interface MLine { id: string; name: string; code: string | null; category: string; quantity: number; unit: string; status: string; supplierId: string | null; supplier: Supplier | null; }
interface Order { id: string; quoteNumber: string; deliveryDate: string | null; customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string }; materialOrders: MLine[]; }

const CAT_KEY: Record<string, TranslationKey> = { fabric: "pcCatFabric", wood: "pcCatWood", foam: "pcCatFoam", accessory: "pcCatAccessory", other: "pcCatOther" };
const UNIT_KEY: Record<string, TranslationKey> = { meter: "pcUnitMeter", sheet: "pcUnitSheet", kg: "pcUnitKg", piece: "pcUnitPiece", carton: "pcUnitCarton", box: "pcUnitBox", bag: "pcUnitBag", gallon: "pcUnitGallon", roll: "pcUnitRoll" };
const STATUS_KEY: Record<string, TranslationKey> = { needed: "pcNeeded", ordered: "pcOrdered", received: "pcReceived" };
const STATUS_TONE: Record<string, string> = {
  needed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  ordered: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};
const CATS = ["fabric", "wood", "foam", "accessory", "other"];
const UNITS = ["piece", "meter", "sheet", "kg", "carton", "box", "bag", "gallon", "roll"];

// Store status levels, computed from stock vs the reorder threshold (minStock):
//   out         → nothing left (stock ≤ 0)
//   danger      → at/under the reorder point → needs an order
//   approaching → within 50% above the reorder point → getting low
//   safe        → comfortable
type StockStat = "out" | "danger" | "approaching" | "safe";
function stockStatus(m: Material): StockStat {
  if (m.stock <= 0) return "out";
  if (m.stock <= m.minStock || m.stock < (m.demand || 0)) return "danger";
  if (m.minStock > 0 && m.stock <= m.minStock * 1.5) return "approaching";
  return "safe";
}
const STAT_KEY: Record<StockStat, TranslationKey> = { safe: "pcStatSafe", approaching: "pcStatApproaching", danger: "pcStatDanger", out: "pcStatOut" };
const STAT_TONE: Record<StockStat, string> = {
  safe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  approaching: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  out: "bg-red-600 text-white dark:bg-red-700",
};
const STAT_BORDER: Record<StockStat, string> = {
  safe: "border-gray-200 dark:border-gray-700",
  approaching: "border-amber-300 dark:border-amber-800",
  danger: "border-red-300 dark:border-red-800",
  out: "border-red-500 dark:border-red-700",
};
const STAT_STOCK_TEXT: Record<StockStat, string> = {
  safe: "text-emerald-600", approaching: "text-amber-600", danger: "text-red-600", out: "text-red-600",
};

export default function PurchasingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"store" | "orders" | "batch" | "suppliers">("store");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const loadSuppliers = useCallback(() => { fetch("/api/suppliers").then((r) => r.ok ? r.json() : []).then(setSuppliers).catch(() => {}); }, []);
  const loadMaterials = useCallback(() => { fetch("/api/materials").then((r) => r.ok ? r.json() : []).then(setMaterials).catch(() => {}); }, []);
  useEffect(() => { loadSuppliers(); loadMaterials(); }, [loadSuppliers, loadMaterials]);

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> {t("pcTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("pcSubtitle")}</p>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 mb-5 w-fit flex-wrap">
        {([["store", "pcTabStore"], ["orders", "pcTabOrders"], ["batch", "pcTabBatch"], ["suppliers", "pcTabSuppliers"]] as const).map(([k, lk]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-colors",
              tab === k ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white" : "text-gray-500")}>
            {t(lk)}
          </button>
        ))}
      </div>

      {tab === "store" && <StoreTab materials={materials} suppliers={suppliers} reload={loadMaterials} />}
      {tab === "orders" && <OrdersTab suppliers={suppliers} materials={materials} />}
      {tab === "batch" && <BatchTab />}
      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} reload={loadSuppliers} />}
    </div>
  );
}

/* ─────────────── Orders tab ─────────────── */
function OrdersTab({ suppliers, materials }: { suppliers: Supplier[]; materials: Material[] }) {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback((q?: string) => {
    setOrders(null);
    const url = q && q.trim() ? `/api/material-orders?search=${encodeURIComponent(q.trim())}` : "/api/material-orders";
    fetch(url).then((r) => r.ok ? r.json() : []).then(setOrders).catch(() => setOrders([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const unitLabel = (u: string) => t(UNIT_KEY[u] || "pcUnitPiece");

  const catLabel = (c: string) => t(CAT_KEY[c] || "pcCatOther");
  const sendWa = (o: Order, sup: Supplier, lines: MLine[]) => {
    const items = lines.map((l) => `• ${catLabel(l.category)} — ${l.name}${l.code ? ` (${l.code})` : ""} × ${l.quantity} ${unitLabel(l.unit)}`).join("\n");
    const text = `${t("pcWaGreeting")}\n${locale === "en" ? "Customer" : "الزبون"}: ${displayName(o.customer.name, locale)}\n${t("pcOrderNo")}: ${o.quoteNumber}\n${items}`;
    window.open(waLinkFor(sup.phoneCode, sup.phone, text), "_blank");
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(search); }}
            className="field w-full pr-10" placeholder={t("pcSearchOrder")} />
        </div>
        <button onClick={() => load(search)} className="px-4 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold">{t("pcSearch")}</button>
      </div>

      {!search && <p className="text-xs text-gray-400 font-semibold mb-2">{t("pcActiveOrders")}</p>}

      {orders === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" /> {t("pcNoOrders")}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} suppliers={suppliers} materials={materials}
              onReload={() => load(search)} sendWa={sendWa} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, suppliers, materials, onReload, sendWa }:
  { order: Order; suppliers: Supplier[]; materials: Material[]; onReload: () => void; sendWa: (o: Order, s: Supplier, lines: MLine[]) => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState({ materialId: "", name: "", code: "", category: "other", unit: "meter", quantity: "1", cost: "", supplierId: "" });
  const [busy, setBusy] = useState(false);
  const unitLabel = (u: string) => t(UNIT_KEY[u] || "pcUnitPiece");

  const pickMaterial = (mid: string) => {
    const m = materials.find((x) => x.id === mid);
    if (m) setDraft((d) => ({ ...d, materialId: m.id, name: m.name, code: m.code || "", category: m.category, unit: m.unit, supplierId: m.supplierId || d.supplierId }));
    else setDraft((d) => ({ ...d, materialId: "" }));
  };

  const resetDraft = () => setDraft({ materialId: "", name: "", code: "", category: "other", unit: "meter", quantity: "1", cost: "", supplierId: "" });

  const addLine = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/material-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: order.id, materialId: draft.materialId || null, name: draft.name, code: draft.code, category: draft.category, unit: draft.unit, quantity: parseFloat(draft.quantity) || 1, cost: draft.cost ? parseFloat(draft.cost) : null, supplierId: draft.supplierId || null }),
      });
      if (res.ok) { resetDraft(); onReload(); }
      else toast.error(t("saveFailed"));
    } catch { toast.error(t("serverConnectionError")); }
    finally { setBusy(false); }
  };

  const patchLine = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/material-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    onReload();
  };
  const delLine = async (id: string) => {
    await fetch(`/api/material-orders/${id}`, { method: "DELETE" }).catch(() => {});
    onReload();
  };

  // Group lines by supplier for the WhatsApp buttons.
  const bySupplier = new Map<string, { sup: Supplier; lines: MLine[] }>();
  for (const l of order.materialOrders) if (l.supplier) {
    const g = bySupplier.get(l.supplier.id) || { sup: l.supplier, lines: [] };
    g.lines.push(l); bySupplier.set(l.supplier.id, g);
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <h3 className="font-bold">{displayName(order.customer.name, locale)}</h3>
          <p className="text-xs text-gray-400 font-mono-en">{order.quoteNumber}{order.deliveryDate ? ` · ${new Date(order.deliveryDate).toLocaleDateString(locale === "en" ? "en-GB" : "ar")}` : ""}</p>
        </div>
      </div>

      {/* Existing lines */}
      {order.materialOrders.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {order.materialOrders.map((l) => (
            <div key={l.id} className="flex items-center gap-2 flex-wrap text-sm border border-gray-100 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
              <span className="font-semibold">{l.name}</span>
              {l.code && <span className="text-xs text-gray-400">({l.code})</span>}
              <span className="font-mono-en text-gray-500">× {l.quantity} {unitLabel(l.unit)}</span>
              <select value={l.supplierId || ""} onChange={(e) => patchLine(l.id, { supplierId: e.target.value })}
                className="field h-8 text-xs py-0 w-32">
                <option value="">{t("pcChooseSupplier")}</option>
                {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                {(["needed", "ordered", "received"] as const).map((st) => (
                  <button key={st} onClick={() => patchLine(l.id, { status: st })}
                    className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", l.status === st ? STATUS_TONE[st] : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700")}>
                    {t(STATUS_KEY[st])}
                  </button>
                ))}
              </div>
              <button onClick={() => delLine(l.id)} className="ms-auto p-1 rounded text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Add line */}
      <div className="flex items-end gap-2 flex-wrap bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2.5 mb-3">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcMaterial")}</label>
          {materials.length > 0 && (
            <select value={draft.materialId} onChange={(e) => pickMaterial(e.target.value)} className="field h-9 text-xs w-full mb-1">
              <option value="">{t("pcChooseMaterial")}</option>
              {materials.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{t(CAT_KEY[m.category])} — {m.name}{m.code ? ` (${m.code})` : ""}</option>)}
            </select>
          )}
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, materialId: "" })} className="field h-9 text-xs w-full" placeholder={t("pcMatName")} />
        </div>
        <div className="w-20">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcColor")}</label>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className="field h-9 text-xs w-full" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcQty")}</label>
          <input type="number" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className="field h-9 text-xs w-full font-mono-en" />
        </div>
        <div className="w-20">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcUnit")}</label>
          <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="field h-9 text-xs w-full">
            {UNITS.map((u) => <option key={u} value={u}>{t(UNIT_KEY[u])}</option>)}
          </select>
        </div>
        <div className="w-20">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcCost")}</label>
          <input type="number" inputMode="decimal" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} className="field h-9 text-xs w-full font-mono-en" placeholder="—" />
        </div>
        <div className="w-32">
          <label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcSupplier")}</label>
          <select value={draft.supplierId} onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })} className="field h-9 text-xs w-full">
            <option value="">{t("pcChooseSupplier")}</option>
            {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={addLine} disabled={busy || !draft.name.trim()} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold disabled:opacity-40">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {t("pcAddLine")}
        </button>
      </div>

      {/* WhatsApp send per supplier */}
      {bySupplier.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(bySupplier.values()).map(({ sup, lines }) => (
            <button key={sup.id} onClick={() => sendWa(order, sup, lines)}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              <Send className="w-3.5 h-3.5" /> {sup.name} ({lines.length})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Batch-by-supplier tab ─────────────── */
interface BatchLine { id: string; name: string; code: string | null; category: string; quantity: number; unit: string; status: string; supplier: Supplier | null; quotation: { id: string; quoteNumber: string; customer: { name: string } }; }

function BatchTab() {
  const { t, locale } = useI18n();
  const [lines, setLines] = useState<BatchLine[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLines(null);
    fetch("/api/material-orders?view=supplier").then((r) => r.ok ? r.json() : []).then(setLines).catch(() => setLines([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const unitLabel = (u: string) => t(UNIT_KEY[u] || "pcUnitPiece");

  // Group pending lines by supplier.
  const groups = new Map<string, { sup: Supplier | null; lines: BatchLine[] }>();
  for (const l of lines || []) {
    const key = l.supplier?.id || "none";
    const g = groups.get(key) || { sup: l.supplier, lines: [] };
    g.lines.push(l); groups.set(key, g);
  }

  const catLabel = (c: string) => t(CAT_KEY[c] || "pcCatOther");
  const sendAll = (sup: Supplier, gl: BatchLine[]) => {
    const items = gl.map((l) => `• ${displayName(l.quotation.customer.name, locale)} — ${catLabel(l.category)} ${l.name}${l.code ? ` (${l.code})` : ""} × ${l.quantity} ${unitLabel(l.unit)}`).join("\n");
    const text = `${t("pcWaGreeting")}\n${items}`;
    window.open(waLinkFor(sup.phoneCode, sup.phone, text), "_blank");
  };

  const markAllOrdered = async (gl: BatchLine[]) => {
    setBusy(true);
    try {
      await Promise.all(gl.filter((l) => l.status !== "ordered").map((l) =>
        fetch(`/api/material-orders/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ordered" }) }).catch(() => {})));
      load();
    } finally { setBusy(false); }
  };

  if (lines === null) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (lines.length === 0) return <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400"><ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" /> {t("pcNoBatch")}</div>;

  return (
    <div className="space-y-4">
      {Array.from(groups.values()).map((g, gi) => (
        <div key={g.sup?.id || `none-${gi}`} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="font-bold">{g.sup ? g.sup.name : t("pcNoSupplierGroup")} <span className="text-xs font-normal text-gray-400">· <span className="font-mono-en">{g.lines.length}</span> {t("pcItemsCount")}</span></h3>
            {g.sup && (
              <div className="flex items-center gap-2">
                <button onClick={() => markAllOrdered(g.lines)} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
                  {t("pcMarkAllOrdered")}
                </button>
                <button onClick={() => sendAll(g.sup!, g.lines)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                  <Send className="w-3.5 h-3.5" /> {t("pcSendAll")}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {g.lines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 flex-wrap text-sm border-b border-gray-50 dark:border-gray-700/50 py-1.5 last:border-0">
                <span className="text-gray-500 min-w-[120px] truncate">{displayName(l.quotation.customer.name, locale)}</span>
                <span className="font-semibold">{l.name}</span>
                {l.code && <span className="text-xs text-gray-400">({l.code})</span>}
                <span className="font-mono-en text-gray-500">× {l.quantity} {unitLabel(l.unit)}</span>
                <span className={cn("ms-auto text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_TONE[l.status])}>{t(STATUS_KEY[l.status])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Suppliers tab ─────────────── */
function SuppliersTab({ suppliers, reload }: { suppliers: Supplier[]; reload: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", category: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: "", phone: "", category: "" }); reload(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || t("saveFailed")); }
    } catch { toast.error(t("serverConnectionError")); }
    finally { setSaving(false); }
  };
  const toggle = async (s: Supplier) => { await fetch(`/api/suppliers/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !s.isActive }) }).catch(() => {}); reload(); };
  const del = async (id: string) => { await fetch(`/api/suppliers/${id}`, { method: "DELETE" }).catch(() => {}); reload(); };

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" placeholder={t("pcSupplierName")} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value).slice(0, 8) })} inputMode="numeric" maxLength={8} dir="ltr" className="field font-mono-en" placeholder={t("pcSupplierPhone")} />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="field" placeholder={t("pcSupplierCategory")} />
        <button onClick={add} disabled={saving || !form.name.trim() || !form.phone.trim()} className="inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("pcAddSupplier")}
        </button>
      </div>
      {suppliers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("pcNoSuppliers")}</div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className={cn("flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3", !s.isActive && "opacity-50")}>
              <div>
                <p className="font-bold">{s.name} {s.category && <span className="text-xs font-normal text-gray-400">· {s.category}</span>}</p>
                <p className="text-xs text-gray-400 font-mono-en" dir="ltr">{s.phoneCode} {s.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(s)} className="p-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-700"><Power className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(s.id)} className="p-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Catalog tab ─────────────── */
/* ─────────────── Store / inventory tab ─────────────── */
function StoreTab({ materials, suppliers, reload }: { materials: Material[]; suppliers: Supplier[]; reload: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ category: "fabric", name: "", code: "", unit: "carton", packSize: "", stock: "", minStock: "" });
  const [saving, setSaving] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, stock: form.stock ? parseFloat(form.stock) : 0, minStock: form.minStock ? parseFloat(form.minStock) : 0 }) });
      if (res.ok) { setForm({ ...form, name: "", code: "", packSize: "", stock: "", minStock: "" }); reload(); }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || t("saveFailed")); }
    } catch { toast.error(t("serverConnectionError")); }
    finally { setSaving(false); }
  };

  // "Needs order" = danger or out of stock.
  const needsOrder = (m: Material) => { const s = stockStatus(m); return s === "danger" || s === "out"; };
  const shown = attentionOnly ? materials.filter(needsOrder) : materials;
  const attentionCount = materials.filter(needsOrder).length;

  return (
    <div>
      {/* Add material */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-8 gap-2">
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="field">
          {CATS.map((c) => <option key={c} value={c}>{t(CAT_KEY[c])}</option>)}
        </select>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" placeholder={t("pcMatName")} />
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="field" placeholder={t("pcColor")} />
        <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="field">
          {UNITS.map((u) => <option key={u} value={u}>{t(UNIT_KEY[u])}</option>)}
        </select>
        <input value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} className="field" placeholder={t("pcPackSize")} title={t("pcPackSizeHint")} />
        <input type="number" inputMode="decimal" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="field font-mono-en" placeholder={t("pcStock")} />
        <input type="number" inputMode="decimal" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="field font-mono-en" placeholder={t("pcMin")} />
        <button onClick={add} disabled={saving || !form.name.trim()} className="inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("pcAddMaterial")}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <button onClick={() => setAttentionOnly((v) => !v)}
          className={cn("px-3 h-9 rounded-lg text-xs font-bold border", attentionOnly ? "bg-red-600 border-red-600 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
          {t("pcAttentionOnly")} {attentionCount > 0 && <span className="font-mono-en">({attentionCount})</span>}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("pcNoMaterials")}</div>
      ) : (
        <div className="space-y-2">
          {shown.map((m) => <MaterialRow key={m.id} m={m} suppliers={suppliers} reload={reload} />)}
        </div>
      )}
    </div>
  );
}

function MaterialRow({ m, suppliers, reload }: { m: Material; suppliers: Supplier[]; reload: () => void }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"" | "receive" | "order" | "consume">("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [supplierId, setSupplierId] = useState(m.supplierId || "");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<Array<{ id: string; delta: number; reason: string; createdAt: string }> | null | undefined>(undefined);
  const unitLabel = t(UNIT_KEY[m.unit] || "pcUnitPiece");
  const stat = stockStatus(m);
  // A material is "packaged" when its size wording is set (e.g. carton صغير).
  const packLabel = m.packSize ? `${unitLabel} ${m.packSize}` : unitLabel;

  const setStock = async (v: string) => { const n = parseFloat(v); if (!Number.isFinite(n) || n === m.stock) return; await fetch(`/api/materials/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock: n }) }).catch(() => {}); reload(); };
  const toggleHist = () => {
    if (hist !== undefined) { setHist(undefined); return; }
    setHist(null);
    fetch(`/api/materials/${m.id}/movements`).then((r) => r.ok ? r.json() : []).then(setHist).catch(() => setHist([]));
  };

  const receive = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setBusy(true);
    try {
      await fetch(`/api/materials/${m.id}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: q, cost: cost ? parseFloat(cost) : null }) });
      setMode(""); setQty(""); setCost(""); reload();
    } finally { setBusy(false); }
  };
  const consume = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setBusy(true);
    try {
      await fetch(`/api/materials/${m.id}/consume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: q }) });
      setMode(""); setQty(""); reload();
    } finally { setBusy(false); }
  };
  const orderWa = () => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return;
    const q = qty ? `${qty} ${packLabel}` : "";
    const cat = t(CAT_KEY[m.category] || "pcCatOther");
    const text = `${t("pcWaBulkGreeting")}\n• ${cat} — ${m.name}${m.code ? ` (${m.code})` : ""}${m.packSize ? ` — ${unitLabel} ${m.packSize}` : ""}${q ? ` × ${q}` : ""}`;
    window.open(waLinkFor(sup.phoneCode, sup.phone, text), "_blank");
  };
  const setMin = async (v: string) => { await fetch(`/api/materials/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minStock: parseFloat(v) || 0 }) }).catch(() => {}); reload(); };
  const del = async () => { await fetch(`/api/materials/${m.id}`, { method: "DELETE" }).catch(() => {}); reload(); };

  return (
    <div className={cn("bg-white dark:bg-gray-800 border rounded-lg px-4 py-3", STAT_BORDER[stat])}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{t(CAT_KEY[m.category])}</span>
          <span className="font-semibold text-sm">{m.name}</span>
          {m.code && <span className="text-xs text-gray-400">({m.code})</span>}
          {m.packSize && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{unitLabel} {m.packSize}</span>}
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", STAT_TONE[stat])}>{t(STAT_KEY[stat])}</span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span>{t("pcStock")}: <input defaultValue={m.stock} onBlur={(e) => setStock(e.target.value)} className={cn("w-14 field h-7 text-xs font-mono-en inline-block px-1 text-center", STAT_STOCK_TEXT[stat])} /> {unitLabel}</span>
          <span className="text-gray-400">{t("pcMin")}: <input defaultValue={m.minStock} onBlur={(e) => { if (parseFloat(e.target.value) !== m.minStock) setMin(e.target.value); }} className="w-12 field h-7 text-xs font-mono-en inline-block px-1 text-center" /></span>
          {(m.demand || 0) > 0 && <span className="text-amber-600">{t("pcDemand")}: <b className="font-mono-en">{m.demand}</b></span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={toggleHist} className="p-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-700" title={t("pcHistory")}><Clock3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setMode(mode === "consume" ? "" : "consume")} disabled={m.stock <= 0} className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40"><Minus className="w-3 h-3" /> {t("pcConsume")}</button>
          <button onClick={() => setMode(mode === "order" ? "" : "order")} className="px-2.5 h-8 rounded-lg border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20">{t("pcOrderBulk")}</button>
          <button onClick={() => setMode(mode === "receive" ? "" : "receive")} className="px-2.5 h-8 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold">{t("pcReceive")}</button>
          <button onClick={del} className="p-1.5 rounded border border-red-200 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {mode === "consume" && (
        <div className="flex items-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap">
          <div className="w-24"><label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcConsumeQty")}</label>
            <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field h-9 text-xs font-mono-en w-full" autoFocus /></div>
          <button onClick={consume} disabled={busy || !qty} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />} {t("pcConsume")}
          </button>
          <span className="text-[10px] text-gray-400">{t("pcStock")}: <b className="font-mono-en">{m.stock}</b> {packLabel}</span>
        </div>
      )}

      {mode === "receive" && (
        <div className="flex items-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap">
          <div className="w-24"><label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcReceiveQty")}</label>
            <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field h-9 text-xs font-mono-en w-full" /></div>
          <div className="w-24"><label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcCost")}</label>
            <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="field h-9 text-xs font-mono-en w-full" placeholder="—" /></div>
          <button onClick={receive} disabled={busy || !qty} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-bold disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {t("pcReceive")}
          </button>
          <span className="text-[10px] text-gray-400">{t("pcCostHint")}</span>
        </div>
      )}

      {mode === "order" && (
        <div className="flex items-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap">
          <div className="w-24"><label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcOrderQty")}</label>
            <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field h-9 text-xs font-mono-en w-full" /></div>
          <div className="w-36"><label className="block text-[10px] font-bold text-gray-400 mb-0.5">{t("pcSupplier")}</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="field h-9 text-xs w-full">
              <option value="">{t("pcChooseSupplier")}</option>
              {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <button onClick={orderWa} disabled={!supplierId} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40">
            <Send className="w-3.5 h-3.5" /> {t("pcSendWa")}
          </button>
        </div>
      )}

      {hist !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {hist === null ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("loadingDots")}</div>
          ) : hist.length === 0 ? (
            <p className="text-xs text-gray-400">—</p>
          ) : (
            <ul className="space-y-1">
              {hist.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-xs">
                  <span className={cn("font-mono-en font-bold w-16", h.delta >= 0 ? "text-emerald-600" : "text-red-600")}>{h.delta >= 0 ? "+" : ""}{h.delta}</span>
                  <span className="text-gray-500">{t(h.reason === "receive" ? "pcReasonReceive" : h.reason === "consume" ? "pcReasonConsume" : "pcReasonAdjust")}</span>
                  <span className="text-gray-400 font-mono-en ms-auto">{new Date(h.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : "ar")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
