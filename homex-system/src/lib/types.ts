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
