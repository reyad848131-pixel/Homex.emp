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

export const WORK_STATUS_MAP: Record<string, { label: string; cardColor: string; badgeColor: string }> = {
  needs_preparation: { label: "يحتاج تجهيز", cardColor: "border-blue-300 text-blue-600 bg-blue-50", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ready_to_execute: { label: "جاهز للتنفيذ", cardColor: "border-pink-300 text-pink-600 bg-pink-50", badgeColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  in_progress: { label: "جاري العمل", cardColor: "border-gray-300 text-gray-600 bg-gray-50", badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  completed: { label: "جاهز", cardColor: "border-green-300 text-green-600 bg-green-50", badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  ready_for_delivery: { label: "جاهز للتوصيل", cardColor: "border-teal-300 text-teal-600 bg-teal-50", badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  delivered: { label: "تم التوصيل", cardColor: "border-yellow-300 text-yellow-600 bg-yellow-50", badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

export const VALID_WORK_STATUSES = Object.keys(WORK_STATUS_MAP);
