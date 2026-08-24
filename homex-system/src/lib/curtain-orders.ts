// Work-status lifecycle for a curtain order, in order. Shared between the API
// (validation) and the client (labels / colours) so they never drift.
export const CURTAIN_WORK_STATUSES = [
  "placed",       // تم الطلب
  "awaiting",     // بإنتظار التصنيع
  "manufacturing", // قيد التصنيع
  "completed",    // مكتمل
  "ready",        // جاهز للتوصيل
  "delivered",    // تم التوصيل
] as const;

export type CurtainWorkStatus = (typeof CURTAIN_WORK_STATUSES)[number];

// Map a free-text work status (Arabic or English, from an imported Excel) to one
// of our status keys. Falls back to "placed".
export function parseWorkStatus(raw: unknown): CurtainWorkStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "placed";
  if (s.includes("توصيل") && (s.includes("تم") || s.includes("سلّم") || s.includes("سلم"))) return "delivered";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("جاهز") || s.includes("ready")) return "ready";
  if (s.includes("مكتمل") || s.includes("منجز") || s.includes("complete") || s.includes("done")) return "completed";
  if (s.includes("قيد") || s.includes("تصنيع الحالي") || s.includes("manufactur") || s.includes("progress")) return "manufacturing";
  if (s.includes("بإنتظار") || s.includes("بانتظار") || s.includes("انتظار") || s.includes("await") || s.includes("pending") || s.includes("wait")) return "awaiting";
  if (s.includes("تم الطلب") || s.includes("طلب") || s.includes("placed") || s.includes("new")) return "placed";
  return "placed";
}
