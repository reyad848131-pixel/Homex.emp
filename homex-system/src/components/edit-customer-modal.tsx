"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/types";
import { X, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props {
  customer: {
    id: string;
    name: string;
    phone: string;
    phoneCode: string;
    governorate: string;
    wilayat: string;
    address: string | null;
  };
  onClose: () => void;
}

export function EditCustomerModal({ customer, onClose }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    phoneCode: customer.phoneCode,
    governorate: customer.governorate,
    wilayat: customer.wilayat,
    address: customer.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const wilayats = form.governorate ? GOVERNORATES[form.governorate] || [] : [];

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t("namePhoneRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || t("errorOccurred"));
      }
    } catch {
      setError(t("connectionError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold">{t("editCustomerInfo")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("nameLabel")} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("phoneNumber")} *</label>
            <div className="flex gap-2">
              <select value={form.phoneCode} onChange={(e) => setForm({ ...form, phoneCode: e.target.value })}
                className="field w-24 shrink-0 px-2 font-mono-en">
                <option value="+968">+968</option>
                <option value="+971">+971</option>
                <option value="+966">+966</option>
              </select>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                pattern="[0-9]{8}" maxLength={8}
                className="field flex-1 min-w-0 font-mono-en" placeholder="9XXXXXXX" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("governorate")}</label>
              <select value={form.governorate}
                onChange={(e) => setForm({ ...form, governorate: e.target.value, wilayat: "" })}
                className="field">
                <option value="">{t("choose")}</option>
                {Object.keys(GOVERNORATES).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wilayat")}</label>
              <select value={form.wilayat} onChange={(e) => setForm({ ...form, wilayat: e.target.value })}
                className="field disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-gray-900/40" disabled={!form.governorate}>
                <option value="">{t("choose")}</option>
                {wilayats.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("addressLabel")}</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="field" placeholder={t("optional")} />
          </div>

          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? t("savingText") : t("saveChanges")}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
