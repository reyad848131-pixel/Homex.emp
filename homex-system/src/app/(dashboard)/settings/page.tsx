"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, Save, Building2, Download, Database, FileSpreadsheet, ScrollText, Upload, Trash2, ImageIcon } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/logo").then((r) => r.json()).then((d) => setLogo(d.logo || ""));
  }, []);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const form = new FormData();
    form.append("logo", file);
    try {
      const res = await fetch("/api/logo", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setLogo(data.logo);
      }
    } catch {} finally { setUploadingLogo(false); }
  };

  const handleLogoDelete = async () => {
    const res = await fetch("/api/logo", { method: "DELETE" });
    if (res.ok) setLogo("");
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            الإعدادات
          </h1>
          <p className="text-sm text-gray-500 mt-1">إعدادات النظام والشركة</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ التغييرات"}
        </button>
      </div>

      {/* Logo Upload */}
      <div className="bg-white border border-gray-200 rounded p-6 mb-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          شعار الشركة
        </h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
            {logo ? (
              <img src={logo} alt="شعار الشركة" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="space-y-2">
            <input type="file" ref={fileRef} className="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <Upload className="w-4 h-4" />
              {uploadingLogo ? "جاري الرفع..." : "رفع شعار"}
            </button>
            {logo && (
              <button onClick={handleLogoDelete}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                حذف الشعار
              </button>
            )}
            <p className="text-xs text-gray-400">PNG, JPG, WebP أو SVG - حد أقصى 500KB</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            معلومات الشركة
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">اسم الشركة</label>
              <input type="text" value={settings.company_name || ""} onChange={(e) => update("company_name", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="Homex" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الوصف التعريفي</label>
              <input type="text" value={settings.company_subtitle || ""} onChange={(e) => update("company_subtitle", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="مطابخ · خزائن · أثاث مخصص وتصميم داخلي" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">المصنع التابع</label>
              <input type="text" value={settings.company_factory || ""} onChange={(e) => update("company_factory", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="شركة تابعة لمصنع سلطان النبهاني للمنتجات الخشبية — بهلاء، عُمان" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">هاتف الشركة</label>
              <input type="tel" value={settings.company_phone || ""} onChange={(e) => update("company_phone", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="+968 XXXXXXXX" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">العنوان</label>
              <input type="text" value={settings.company_address || ""} onChange={(e) => update("company_address", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" placeholder="مسقط، سلطنة عمان" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">السجل التجاري</label>
              <input type="text" value={settings.company_cr || ""} onChange={(e) => update("company_cr", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="XXXXXXXX" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">موقع الشركة</label>
              <input type="url" value={settings.company_website || ""} onChange={(e) => update("company_website", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" dir="ltr" placeholder="https://homex-om.netlify.app" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="text-base font-bold mb-4">الإعدادات المالية</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">نسبة ضريبة القيمة المضافة (%)</label>
              <input type="number" step={0.1} min={0} max={100} value={settings.vat_rate || "5"}
                onChange={(e) => update("vat_rate", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">نسبة الدفعة المقدمة الافتراضية (%)</label>
              <input type="number" step={1} min={0} max={100} value={settings.advance_pct || "15"}
                onChange={(e) => update("advance_pct", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">صلاحية عرض السعر (أيام)</label>
              <input type="number" min={1} value={settings.quote_validity_days || "30"}
                onChange={(e) => update("quote_validity_days", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">العملة</label>
              <input type="text" value={settings.currency || "ر.ع"} onChange={(e) => update("currency", e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-white border border-gray-200 rounded p-6 mt-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-gray-400" />
          الشروط والأحكام
        </h2>
        <p className="text-sm text-gray-500 mb-3">تظهر تلقائياً في عرض السعر وملف PDF. كل سطر يظهر كبند منفصل.</p>
        <textarea
          value={settings.terms_conditions || ""}
          onChange={(e) => update("terms_conditions", e.target.value)}
          rows={8}
          className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm leading-relaxed"
          placeholder={"الأسعار شاملة التوريد والتركيب\nمدة التنفيذ 30 يوم عمل من تاريخ الدفعة المقدمة\nالدفعة المقدمة غير قابلة للاسترداد\nالضمان سنة واحدة من تاريخ التسليم\nالأسعار صالحة لمدة 30 يوم من تاريخ العرض"}
        />
      </div>

      {/* Data Management */}
      <div className="bg-white border border-gray-200 rounded p-6 mt-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          إدارة البيانات
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a href="/api/export?type=quotations" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            تصدير العروض (CSV)
          </a>
          <a href="/api/export?type=customers" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            تصدير العملاء (CSV)
          </a>
          <a href="/api/backup" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 text-purple-600" />
            نسخة احتياطية
          </a>
        </div>
      </div>
    </div>
  );
}
