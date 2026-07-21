"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Locale = "ar" | "en";

const translations = {
  // Sidebar & Navigation
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  quotations: { ar: "عروض الأسعار", en: "Quotations" },
  newQuotation: { ar: "عرض سعر جديد", en: "New Quotation" },
  customers: { ar: "العملاء", en: "Customers" },
  workOrders: { ar: "إدارة الأعمال", en: "Work Orders" },
  reports: { ar: "التقارير", en: "Reports" },
  employees: { ar: "الموظفين", en: "Employees" },
  categories: { ar: "الفئات", en: "Categories" },
  auditLogs: { ar: "سجل النشاطات", en: "Activity Log" },
  settings: { ar: "الإعدادات", en: "Settings" },
  logout: { ar: "تسجيل الخروج", en: "Logout" },
  lightMode: { ar: "الوضع الفاتح", en: "Light Mode" },
  darkMode: { ar: "الوضع الداكن", en: "Dark Mode" },

  // Roles
  roleAdmin: { ar: "مدير النظام", en: "System Admin" },
  roleManager: { ar: "مدير", en: "Manager" },
  roleSales: { ar: "مبيعات", en: "Sales" },

  // Login
  employeeLogin: { ar: "دخول الموظفين", en: "Employee Login" },
  signIn: { ar: "تسجيل الدخول", en: "Sign In" },
  enterCredentials: { ar: "أدخل الرقم المدني وكلمة المرور", en: "Enter your civil ID and password" },
  civilId: { ar: "الرقم المدني", en: "Civil ID" },
  password: { ar: "كلمة المرور", en: "Password" },
  login: { ar: "دخول", en: "Login" },
  loggingIn: { ar: "جاري الدخول...", en: "Logging in..." },
  loginError: { ar: "أدخل الرقم المدني وكلمة المرور", en: "Enter civil ID and password" },
  invalidCredentials: { ar: "رقم مدني أو كلمة مرور غير صحيحة", en: "Invalid civil ID or password" },
  connectionError: { ar: "خطأ في الاتصال", en: "Connection error" },

  // Dashboard
  welcome: { ar: "مرحباً", en: "Welcome" },
  activitySummary: { ar: "إليك ملخص نشاطك اليوم", en: "Here's your activity summary" },
  totalQuotations: { ar: "إجمالي العروض", en: "Total Quotations" },
  thisMonth: { ar: "هذا الشهر", en: "this month" },
  approvedRevenue: { ar: "الإيرادات المعتمدة", en: "Approved Revenue" },
  conversionRate: { ar: "نسبة التحويل", en: "conversion rate" },
  underReview: { ar: "قيد المراجعة", en: "Under Review" },
  draft: { ar: "مسودة", en: "Draft" },
  approved: { ar: "معتمد", en: "Approved" },
  revised: { ar: "مُعاد للتعديل", en: "Revised" },
  declined: { ar: "مرفوض", en: "Declined" },
  expiringQuotations: { ar: "عروض أسعار تقترب من انتهاء الصلاحية", en: "Quotations nearing expiry" },
  expired: { ar: "منتهي الصلاحية", en: "Expired" },
  daysRemaining: { ar: "يوم متبقي", en: "days left" },
  recentQuotations: { ar: "آخر عروض الأسعار", en: "Recent Quotations" },
  viewAll: { ar: "عرض الكل", en: "View All" },
  noQuotationsYet: { ar: "لا توجد عروض أسعار بعد", en: "No quotations yet" },
  createFirstQuotation: { ar: "إنشاء أول عرض سعر", en: "Create first quotation" },

  // Table Headers
  quoteNumber: { ar: "رقم العرض", en: "Quote #" },
  customer: { ar: "العميل", en: "Customer" },
  employee: { ar: "الموظف", en: "Employee" },
  status: { ar: "الحالة", en: "Status" },
  items: { ar: "البنود", en: "Items" },
  total: { ar: "المجموع", en: "Total" },
  date: { ar: "التاريخ", en: "Date" },

  // Work Orders
  workOrdersTitle: { ar: "إدارة الأعمال والتسليم", en: "Work Orders & Delivery" },
  allMonths: { ar: "جميع الأشهر", en: "All Months" },
  all: { ar: "الكل", en: "All" },
  currentMonth: { ar: "الشهر الحالي", en: "Current Month" },
  work: { ar: "عمل", en: "orders" },
  filter: { ar: "فلترة", en: "Filter" },
  searchPlaceholder: { ar: "بحث برقم العرض أو اسم العميل...", en: "Search by quote # or customer..." },
  to: { ar: "إلى", en: "To" },
  noOrders: { ar: "لا توجد طلبات", en: "No orders found" },
  matchingFilter: { ar: "مطابقة للفلتر", en: "matching filter" },
  note: { ar: "ملاحظة", en: "Note" },
  urgent: { ar: "مستعجل", en: "Urgent" },
  clear: { ar: "مسح", en: "Clear" },
  needsPreparation: { ar: "يحتاج تجهيز", en: "Needs Preparation" },
  readyToExecute: { ar: "جاهز للتنفيذ", en: "Ready to Execute" },
  inProgress: { ar: "قيد التنفيذ", en: "In Progress" },
  completed: { ar: "مكتمل", en: "Completed" },
  delivered: { ar: "تم التوصيل", en: "Delivered" },
  wood: { ar: "أخشاب", en: "Wood" },
  fabric: { ar: "أقمشة", en: "Fabric" },
  notOrdered: { ar: "لم تُطلب", en: "Not Ordered" },
  ordered: { ar: "طُلبت", en: "Ordered" },
  arrived: { ar: "وصلت", en: "Arrived" },
  materialStatus: { ar: "حالة المواد", en: "Material Status" },
  changeWorkStatus: { ar: "تغيير حالة العمل", en: "Change Work Status" },
  addNote: { ar: "إضافة ملاحظة", en: "Add Note" },
  removeNote: { ar: "إزالة الملاحظة", en: "Remove Note" },
  markUrgent: { ar: "تحديد مستعجل", en: "Mark Urgent" },
  removeUrgent: { ar: "إزالة الاستعجال", en: "Remove Urgent" },
  autoAlert: { ar: "تنبيه تلقائي — أقل من شهر", en: "Auto alert — less than a month" },
  workNotes: { ar: "ملاحظات العمل", en: "Work Notes" },
  edit: { ar: "تعديل", en: "Edit" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  addWorkNotes: { ar: "أضف ملاحظات العمل هنا...", en: "Add work notes here..." },
  noNotes: { ar: "لا توجد ملاحظات", en: "No notes" },
  openOriginalQuote: { ar: "فتح عرض السعر الأصلي", en: "Open Original Quote" },
  orderDetails: { ar: "تفاصيل الطلب", en: "Order Details" },
  clickToChange: { ar: "اضغط للتغيير", en: "Click to change" },
  deliveredStatus: { ar: "تم التوصيل", en: "Delivered" },
  lateBy: { ar: "متأخر", en: "Late by" },
  day: { ar: "يوم", en: "day" },
  days: { ar: "يوم", en: "days" },
  today: { ar: "اليوم!", en: "Today!" },
  phone: { ar: "الهاتف", en: "Phone" },
  itemCount: { ar: "عدد البنود", en: "Item Count" },

  // Loading & Errors
  loading: { ar: "جاري التحميل...", en: "Loading..." },
  dataError: { ar: "خطأ في تحميل البيانات", en: "Error loading data" },
  pageNotFound: { ar: "الصفحة غير موجودة", en: "Page Not Found" },
  returnHome: { ar: "العودة للرئيسية", en: "Return Home" },
  unexpectedError: { ar: "حدث خطأ غير متوقع", en: "An unexpected error occurred" },
  retry: { ar: "إعادة المحاولة", en: "Retry" },

  // Update checker
  updateAvailable: { ar: "تحديث متاح — اضغط للتحديث", en: "Update available — tap to refresh" },

  // Language
  language: { ar: "English", en: "عربي" },

  // Months
  january: { ar: "يناير", en: "January" },
  february: { ar: "فبراير", en: "February" },
  march: { ar: "مارس", en: "March" },
  april: { ar: "أبريل", en: "April" },
  may: { ar: "مايو", en: "May" },
  june: { ar: "يونيو", en: "June" },
  july: { ar: "يوليو", en: "July" },
  august: { ar: "أغسطس", en: "August" },
  september: { ar: "سبتمبر", en: "September" },
  october: { ar: "أكتوبر", en: "October" },
  november: { ar: "نوفمبر", en: "November" },
  december: { ar: "ديسمبر", en: "December" },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  dir: "rtl" | "ltr";
  dateLocale: string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ar",
  setLocale: () => {},
  t: (key) => translations[key]?.ar || key,
  dir: "rtl",
  dateLocale: "ar-OM",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale;
    if (saved === "en" || saved === "ar") {
      setLocaleState(saved);
      applyLocale(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    applyLocale(l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[key]?.[locale] || key;
  }, [locale]);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const dateLocale = locale === "ar" ? "ar-OM" : "en-US";

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir, dateLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

function applyLocale(locale: Locale) {
  const html = document.documentElement;
  html.lang = locale;
  html.dir = locale === "ar" ? "rtl" : "ltr";
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslatedMonths() {
  const { t } = useI18n();
  return [
    t("january"), t("february"), t("march"), t("april"),
    t("may"), t("june"), t("july"), t("august"),
    t("september"), t("october"), t("november"), t("december"),
  ];
}
