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

  // Quotation List
  quotationsList: { ar: "عروض الأسعار", en: "Quotations" },
  quotationCount: { ar: "عرض سعر", en: "quotations" },
  searchQuotations: { ar: "بحث برقم العرض، اسم العميل، أو الهاتف...", en: "Search by quote #, customer, or phone..." },
  noResults: { ar: "لا توجد نتائج", en: "No results" },
  region: { ar: "المنطقة", en: "Region" },
  showing: { ar: "عرض", en: "Showing" },
  of: { ar: "من", en: "of" },
  previous: { ar: "السابق", en: "Previous" },
  next: { ar: "التالي", en: "Next" },

  // Quotation Detail
  createdBy: { ar: "أنشئ بواسطة", en: "Created by" },
  print: { ar: "طباعة", en: "Print" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
  duplicate: { ar: "نسخ", en: "Duplicate" },
  sendForReview: { ar: "إرسال للمراجعة", en: "Send for Review" },
  approve: { ar: "اعتماد", en: "Approve" },
  returnForEdit: { ar: "إعادة للتعديل", en: "Return for Edit" },
  decline: { ar: "رفض", en: "Decline" },
  issueInvoice: { ar: "إصدار فاتورة", en: "Issue Invoice" },
  issuingInvoice: { ar: "جاري الإصدار...", en: "Issuing..." },
  invoice: { ar: "فاتورة", en: "Invoice" },
  deleteQuote: { ar: "هل أنت متأكد من حذف هذا العرض؟", en: "Are you sure you want to delete this quote?" },
  customerInfo: { ar: "بيانات العميل", en: "Customer Info" },
  validUntil: { ar: "صالح حتى", en: "Valid until" },
  deliveryDate: { ar: "موعد التسليم", en: "Delivery date" },
  itemDetails: { ar: "تفاصيل البنود", en: "Item Details" },
  item: { ar: "البند", en: "Item" },
  quantity: { ar: "الكمية", en: "Qty" },
  price: { ar: "السعر", en: "Price" },
  extras: { ar: "الإضافات", en: "Extras" },
  subtotal: { ar: "المجموع الفرعي", en: "Subtotal" },
  vat: { ar: "ضريبة القيمة المضافة", en: "VAT" },
  tax: { ar: "ضريبة", en: "Tax" },
  grandTotal: { ar: "الإجمالي", en: "Grand Total" },
  advancePayment: { ar: "الدفعة المقدمة", en: "Advance payment" },
  declineReason: { ar: "سبب الرفض", en: "Decline reason" },
  revisionNote: { ar: "ملاحظة الإعادة للتعديل", en: "Revision note" },
  approvalNote: { ar: "ملاحظة الاعتماد", en: "Approval note" },
  notes: { ar: "ملاحظات", en: "Notes" },
  termsAndConditions: { ar: "الشروط والأحكام", en: "Terms & Conditions" },
  payments: { ar: "المدفوعات", en: "Payments" },
  recordPayment: { ar: "تسجيل دفعة", en: "Record Payment" },
  paid: { ar: "المدفوع", en: "Paid" },
  remaining: { ar: "المتبقي", en: "Remaining" },
  amount: { ar: "المبلغ", en: "Amount" },
  paymentMethod: { ar: "طريقة الدفع", en: "Payment method" },
  cash: { ar: "نقدي", en: "Cash" },
  bankTransfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  cheque: { ar: "شيك", en: "Cheque" },
  card: { ar: "بطاقة", en: "Card" },
  reference: { ar: "رقم المرجع", en: "Reference #" },
  optional: { ar: "اختياري", en: "Optional" },
  maxAmount: { ar: "الحد الأقصى", en: "Max" },
  recording: { ar: "جاري التسجيل...", en: "Recording..." },
  recordPaymentBtn: { ar: "تسجيل الدفعة", en: "Record Payment" },
  method: { ar: "الطريقة", en: "Method" },
  by: { ar: "بواسطة", en: "By" },
  noPayments: { ar: "لا توجد دفعات مسجلة", en: "No payments recorded" },
  quoteNotFound: { ar: "عرض السعر غير موجود", en: "Quote not found" },
  quotePrint: { ar: "عرض سعر", en: "Quotation" },
  quoteDetails: { ar: "تفاصيل العرض", en: "Quote Details" },
  unitPrice: { ar: "سعر الوحدة", en: "Unit Price" },
  approveQuote: { ar: "اعتماد عرض السعر", en: "Approve Quotation" },
  declineQuote: { ar: "رفض عرض السعر", en: "Decline Quotation" },
  returnForEditTitle: { ar: "إعادة للتعديل", en: "Return for Edit" },
  revisionRequired: { ar: "اكتب ملاحظة للموظف توضح التعديل المطلوب (إلزامي)", en: "Write a note explaining what needs to change (required)" },
  addCommentOptional: { ar: "أضف تعليق أو ملاحظة (اختياري)", en: "Add a comment or note (optional)" },
  confirmApprove: { ar: "تأكيد الاعتماد", en: "Confirm Approval" },
  confirmDecline: { ar: "تأكيد الرفض", en: "Confirm Decline" },

  // Status labels (for quotation status filter)
  statusAll: { ar: "الكل", en: "All" },
  statusDraft: { ar: "مسودة", en: "Draft" },
  statusPending: { ar: "قيد المراجعة", en: "Under Review" },
  statusApproved: { ar: "معتمد", en: "Approved" },
  statusSent: { ar: "مرسل للعميل", en: "Sent to Client" },
  statusAccepted: { ar: "مقبول", en: "Accepted" },
  statusRevised: { ar: "مُعاد للتعديل", en: "Revised" },
  statusDeclined: { ar: "مرفوض", en: "Declined" },
  statusCancelled: { ar: "ملغي", en: "Cancelled" },

  // Customers
  customersTitle: { ar: "العملاء", en: "Customers" },
  customerCount: { ar: "عميل", en: "customers" },
  searchCustomers: { ar: "بحث بالاسم، الهاتف، أو المنطقة...", en: "Search by name, phone, or region..." },
  noSearchResults: { ar: "لا توجد نتائج للبحث", en: "No search results" },
  noCustomersYet: { ar: "لا يوجد عملاء بعد", en: "No customers yet" },
  customersAutoAdd: { ar: "سيتم إضافة العملاء تلقائياً عند إنشاء عروض الأسعار", en: "Customers are added automatically when creating quotations" },
  quotesCount: { ar: "عروض", en: "quotes" },
  customerDetails: { ar: "تفاصيل العميل", en: "Customer Details" },
  editInfo: { ar: "تعديل البيانات", en: "Edit Info" },
  editCustomerInfo: { ar: "تعديل بيانات العميل", en: "Edit Customer Info" },
  addedBy: { ar: "أضافه", en: "Added by" },
  statistics: { ar: "إحصائيات", en: "Statistics" },
  totalQuotes: { ar: "إجمالي العروض", en: "Total Quotes" },
  approvedQuotes: { ar: "عروض معتمدة", en: "Approved Quotes" },
  revenueTitle: { ar: "الإيرادات", en: "Revenue" },
  fromApproved: { ar: "من العروض المعتمدة", en: "From approved quotes" },
  noQuotationsForCustomer: { ar: "لا توجد عروض أسعار لهذا العميل", en: "No quotations for this customer" },
  nameLabel: { ar: "الاسم", en: "Name" },
  phoneNumber: { ar: "رقم الهاتف", en: "Phone Number" },
  governorate: { ar: "المحافظة", en: "Governorate" },
  wilayat: { ar: "الولاية", en: "Wilayat" },
  addressLabel: { ar: "العنوان", en: "Address" },
  choose: { ar: "اختر", en: "Choose" },
  namePhoneRequired: { ar: "الاسم ورقم الهاتف مطلوبان", en: "Name and phone are required" },
  errorOccurred: { ar: "حدث خطأ", en: "An error occurred" },
  savingText: { ar: "جاري الحفظ...", en: "Saving..." },
  saveChanges: { ar: "حفظ التعديلات", en: "Save Changes" },

  // Employees
  employeesManagement: { ar: "إدارة الموظفين", en: "Employee Management" },
  employeeCount: { ar: "موظف", en: "employees" },
  addEmployee: { ar: "إضافة موظف", en: "Add Employee" },
  editEmployee: { ar: "تعديل موظف", en: "Edit Employee" },
  addNewEmployee: { ar: "إضافة موظف جديد", en: "Add New Employee" },
  civilIdLabel: { ar: "الرقم المدني", en: "Civil ID" },
  role: { ar: "الدور", en: "Role" },
  quotesLabel: { ar: "العروض", en: "Quotes" },
  actions: { ar: "إجراءات", en: "Actions" },
  activeStatus: { ar: "نشط", en: "Active" },
  disabledStatus: { ar: "معطل", en: "Disabled" },
  disable: { ar: "تعطيل", en: "Disable" },
  enable: { ar: "تفعيل", en: "Enable" },
  allFieldsRequired: { ar: "جميع الحقول مطلوبة", en: "All fields are required" },
  civilIdExists: { ar: "الرقم المدني مسجل مسبقاً", en: "Civil ID already registered" },
  updateFailed: { ar: "فشل التحديث", en: "Update failed" },
  addFailed: { ar: "فشل الإضافة", en: "Add failed" },
  updateBtn: { ar: "تحديث", en: "Update" },
  addBtn: { ar: "إضافة", en: "Add" },
  newPasswordOptional: { ar: "كلمة مرور جديدة (اختياري)", en: "New password (optional)" },

  // Categories
  categoriesManagement: { ar: "إدارة الفئات", en: "Category Management" },
  categoriesDescription: { ar: "إضافة وتعديل فئات الخدمات والمنتجات", en: "Add and edit service and product categories" },
  newCategory: { ar: "فئة جديدة", en: "New Category" },
  editCategory: { ar: "تعديل الفئة", en: "Edit Category" },
  addNewCategory: { ar: "إضافة فئة جديدة", en: "Add New Category" },
  nameAr: { ar: "الاسم بالعربي", en: "Name (Arabic)" },
  nameEn: { ar: "الاسم بالإنجليزي", en: "Name (English)" },
  iconEmoji: { ar: "الأيقونة (إيموجي)", en: "Icon (Emoji)" },
  pricingType: { ar: "نوع التسعير", en: "Pricing Type" },
  fixedPrice: { ar: "سعر ثابت", en: "Fixed Price" },
  perMeter: { ar: "بالمتر", en: "Per Meter" },
  perUnit: { ar: "بالوحدة", en: "Per Unit" },
  customPrice: { ar: "مخصص", en: "Custom" },
  basePrice: { ar: "السعر الأساسي", en: "Base Price" },
  sortOrder: { ar: "ترتيب العرض", en: "Sort Order" },
  noCategoriesYet: { ar: "لا توجد فئات بعد", en: "No categories yet" },
  confirmDelete: { ar: "هل أنت متأكد من الحذف؟", en: "Are you sure you want to delete?" },
  orderCol: { ar: "الترتيب", en: "Order" },
  iconCol: { ar: "الأيقونة", en: "Icon" },
  nameCol: { ar: "الاسم", en: "Name" },
  nameEnCol: { ar: "الاسم EN", en: "Name EN" },
  pricingCol: { ar: "التسعير", en: "Pricing" },
  basePriceCol: { ar: "السعر الأساسي", en: "Base Price" },
  reactivate: { ar: "إعادة تفعيل", en: "Reactivate" },

  // Reports
  reportsTitle: { ar: "التقارير", en: "Reports" },
  weekPeriod: { ar: "أسبوع", en: "Week" },
  monthPeriod: { ar: "شهر", en: "Month" },
  yearPeriod: { ar: "سنة", en: "Year" },
  totalRevenue: { ar: "إجمالي الإيرادات", en: "Total Revenue" },
  approvedAmount: { ar: "المعتمد", en: "Approved" },
  statusDistribution: { ar: "توزيع الحالات", en: "Status Distribution" },
  totalCount: { ar: "إجمالي", en: "Total" },
  noData: { ar: "لا توجد بيانات", en: "No data" },
  dailyActivity: { ar: "النشاط اليومي (عدد العروض)", en: "Daily Activity (Quotations)" },
  dailyRevenue: { ar: "الإيرادات اليومية", en: "Daily Revenue" },
  employeePerformance: { ar: "لوحة أداء الموظفين", en: "Employee Performance" },
  quoteWord: { ar: "عرض", en: "quote" },
  approvedWord: { ar: "معتمد", en: "approved" },
  revenueLabel: { ar: "الإيرادات", en: "Revenue" },
  topCategories: { ar: "الفئات الأكثر طلبا", en: "Top Categories" },
  itemWord: { ar: "بند", en: "item" },
  governorateDistribution: { ar: "توزيع المحافظات", en: "Governorate Distribution" },
  reportError: { ar: "خطأ في تحميل التقارير", en: "Error loading reports" },
  draftStatus: { ar: "مسودة", en: "Draft" },
  pendingReview: { ar: "قيد المراجعة", en: "Under Review" },
  returnedForEdit: { ar: "مُعاد للتعديل", en: "Returned for Edit" },
  declinedStatus: { ar: "مرفوض", en: "Declined" },

  // Settings
  settingsTitle: { ar: "الإعدادات", en: "Settings" },
  systemSettings: { ar: "إعدادات النظام والشركة", en: "System and company settings" },
  saveChangesBtn: { ar: "حفظ التغييرات", en: "Save Changes" },
  savedMsg: { ar: "تم الحفظ ✓", en: "Saved ✓" },
  companyLogo: { ar: "شعار الشركة", en: "Company Logo" },
  uploadLogo: { ar: "رفع شعار", en: "Upload Logo" },
  uploadingLogo: { ar: "جاري الرفع...", en: "Uploading..." },
  deleteLogo: { ar: "حذف الشعار", en: "Delete Logo" },
  logoHint: { ar: "PNG, JPG, WebP أو SVG - حد أقصى 500KB", en: "PNG, JPG, WebP or SVG - max 500KB" },
  companyInfo: { ar: "معلومات الشركة", en: "Company Info" },
  companyName: { ar: "اسم الشركة", en: "Company Name" },
  companySubtitle: { ar: "الوصف التعريفي", en: "Company Description" },
  companyFactory: { ar: "المصنع التابع", en: "Associated Factory" },
  companyPhone: { ar: "هاتف الشركة", en: "Company Phone" },
  companyAddress: { ar: "العنوان", en: "Address" },
  commercialReg: { ar: "السجل التجاري", en: "Commercial Registration" },
  companyWebsite: { ar: "موقع الشركة", en: "Company Website" },
  financialSettings: { ar: "الإعدادات المالية", en: "Financial Settings" },
  vatRate: { ar: "نسبة ضريبة القيمة المضافة (%)", en: "VAT Rate (%)" },
  advancePercent: { ar: "نسبة الدفعة المقدمة الافتراضية (%)", en: "Default Advance Payment (%)" },
  quoteValidity: { ar: "صلاحية عرض السعر (أيام)", en: "Quote Validity (days)" },
  currencyLabel: { ar: "العملة", en: "Currency" },
  termsTitle: { ar: "الشروط والأحكام", en: "Terms & Conditions" },
  termsHint: { ar: "تظهر تلقائياً في عرض السعر وملف PDF. كل سطر يظهر كبند منفصل.", en: "Automatically appears in quotations and PDF. Each line shows as a separate item." },
  dataManagement: { ar: "إدارة البيانات", en: "Data Management" },
  exportQuotations: { ar: "تصدير العروض (CSV)", en: "Export Quotations (CSV)" },
  exportCustomers: { ar: "تصدير العملاء (CSV)", en: "Export Customers (CSV)" },
  backupData: { ar: "نسخة احتياطية", en: "Backup" },

  // Profile
  profileTitle: { ar: "الملف الشخصي", en: "Profile" },
  profileDescription: { ar: "معلوماتك الشخصية وإعدادات الحساب", en: "Your personal info and account settings" },
  basicInfo: { ar: "المعلومات الأساسية", en: "Basic Info" },
  creationDate: { ar: "تاريخ الإنشاء", en: "Creation Date" },
  changePassword: { ar: "تغيير كلمة المرور", en: "Change Password" },
  currentPassword: { ar: "كلمة المرور الحالية", en: "Current Password" },
  newPassword: { ar: "كلمة المرور الجديدة", en: "New Password" },
  confirmNewPassword: { ar: "تأكيد كلمة المرور الجديدة", en: "Confirm New Password" },
  enterPasswords: { ar: "أدخل كلمة المرور الحالية والجديدة", en: "Enter current and new password" },
  passwordMismatch: { ar: "كلمة المرور الجديدة غير متطابقة", en: "New password doesn't match" },
  passwordTooShort: { ar: "كلمة المرور يجب أن تكون 4 أحرف على الأقل", en: "Password must be at least 4 characters" },
  passwordChanged: { ar: "تم تغيير كلمة المرور بنجاح", en: "Password changed successfully" },
  changingPassword: { ar: "جاري التغيير...", en: "Changing..." },
  done: { ar: "تم", en: "Done" },

  // Audit Logs
  auditLogsTitle: { ar: "سجل النشاطات", en: "Activity Log" },
  logCount: { ar: "سجل", en: "logs" },
  allTypes: { ar: "جميع الأنواع", en: "All Types" },
  quotationsType: { ar: "عروض الأسعار", en: "Quotations" },
  employeesType: { ar: "الموظفين", en: "Employees" },
  settingsType: { ar: "الإعدادات", en: "Settings" },
  noLogs: { ar: "لا توجد سجلات", en: "No logs" },
  actionCreate: { ar: "إنشاء", en: "Create" },
  actionUpdate: { ar: "تعديل", en: "Update" },
  actionDelete: { ar: "حذف", en: "Delete" },
  actionStatusChange: { ar: "تغيير حالة", en: "Status Change" },
  entityQuotation: { ar: "عرض سعر", en: "Quotation" },
  entityEmployee: { ar: "موظف", en: "Employee" },
  entitySettings: { ar: "إعدادات", en: "Settings" },
  entityCustomer: { ar: "عميل", en: "Customer" },
  actionCol: { ar: "الإجراء", en: "Action" },
  typeCol: { ar: "النوع", en: "Type" },
  detailsCol: { ar: "التفاصيل", en: "Details" },

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
