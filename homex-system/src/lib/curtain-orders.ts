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
