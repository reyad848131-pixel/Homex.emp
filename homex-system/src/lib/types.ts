export type UserRole = "admin" | "manager" | "sales";

export interface SessionUser {
  id: string;
  name: string;
  civilId: string;
  role: UserRole;
}

export interface QuoteItemData {
  categoryId: string;
  categoryName: string;
  description: string;
  details?: Record<string, any>;
  quantity: number;
  unitPrice: number;
  extras: number;
  lineTotal: number;
}

export const GOVERNORATES: Record<string, string[]> = {
  "مسقط": ["مسقط", "مطرح", "بوشر", "السيب", "العامرات", "قريات"],
  "ظفار": ["صلالة", "طاقة", "مرباط", "ثمريت", "رخيوت", "ضلكوت", "المزيونة", "مقشن", "شليم وجزر الحلانيات", "سدح"],
  "مسندم": ["خصب", "بخاء", "دبا", "مدحاء"],
  "البريمي": ["البريمي", "محضة", "السنينة"],
  "الداخلية": ["نزوى", "سمائل", "بهلاء", "أدم", "الحمراء", "منح", "إزكي", "بدبد"],
  "شمال الباطنة": ["صحار", "شناص", "لوى", "صحم", "الخابورة", "السويق"],
  "جنوب الباطنة": ["الرستاق", "العوابي", "نخل", "وادي المعاول", "بركاء", "المصنعة"],
  "جنوب الشرقية": ["صور", "جعلان بني بو علي", "جعلان بني بو حسن", "الكامل والوافي", "مصيرة"],
  "شمال الشرقية": ["إبراء", "المضيبي", "بدية", "القابل", "وادي بني خالد", "دماء والطائيين"],
  "الظاهرة": ["عبري", "ينقل", "ضنك"],
  "الوسطى": ["هيماء", "محوت", "الدقم", "الجازر"],
};

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "معتمد", color: "bg-blue-100 text-blue-700" },
  sent: { label: "مرسل للعميل", color: "bg-purple-100 text-purple-700" },
  accepted: { label: "مقبول", color: "bg-green-100 text-green-700" },
  revised: { label: "مُعاد للتعديل", color: "bg-orange-100 text-orange-700" },
  declined: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  cancelled: { label: "ملغي", color: "bg-gray-200 text-gray-500" },
};

export const WORK_STATUS_MAP: Record<string, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  needs_preparation: { label: "يحتاج تجهيز", emoji: "🔵", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-50 dark:bg-blue-900/30", borderColor: "border-blue-300 dark:border-blue-700" },
  ready_to_execute: { label: "جاهز للتنفيذ", emoji: "🩷", color: "text-pink-700 dark:text-pink-300", bgColor: "bg-pink-50 dark:bg-pink-900/30", borderColor: "border-pink-300 dark:border-pink-700" },
  in_progress: { label: "جاري العمل", emoji: "⚪", color: "text-gray-700 dark:text-gray-300", bgColor: "bg-gray-100 dark:bg-gray-700/50", borderColor: "border-gray-300 dark:border-gray-600" },
  completed: { label: "جاهز", emoji: "🟢", color: "text-green-700 dark:text-green-300", bgColor: "bg-green-50 dark:bg-green-900/30", borderColor: "border-green-300 dark:border-green-700" },
  delivered: { label: "تم التوصيل", emoji: "🟡", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-50 dark:bg-yellow-900/30", borderColor: "border-yellow-300 dark:border-yellow-700" },
};

export const VALID_WORK_STATUSES = Object.keys(WORK_STATUS_MAP);
