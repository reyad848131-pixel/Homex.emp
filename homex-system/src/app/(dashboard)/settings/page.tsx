"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Building2, Download, Database, FileSpreadsheet } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

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
