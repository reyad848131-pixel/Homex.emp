"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, Save, Building2, Download, Database, FileSpreadsheet, ScrollText, Upload, Trash2, ImageIcon, ShieldCheck, Smartphone, MessageCircle } from "lucide-react";
import { DEFAULT_WA_QUOTE, DEFAULT_WA_DELIVERY, DEFAULT_WA_COMPLETED, DEFAULT_WA_READY, DEFAULT_WA_DELIVERED } from "@/lib/wa";
import { useI18n } from "@/lib/i18n";
import { AppIconEditor } from "@/components/app-icon-editor";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // App icon (home-screen / browser-tab). iconVer busts the <img> cache after
  // an upload; the icon itself is served from /api/app-icon.
  const [iconVer, setIconVer] = useState(0);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const wmRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const { t, dateLocale } = useI18n();

  type BackupRow = { id: string; size: number; source: string; createdAt: string };
  const [backups, setBackups] = useState<BackupRow[]>([]);

  const loadBackups = () => {
    fetch("/api/backup?list=true")
      .then((r) => (r.ok ? r.json() : { backups: [] }))
      .then((d) => setBackups(d.backups || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/logo").then((r) => r.json()).then((d) => setLogo(d.logo || ""));
    loadBackups();
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

  // Downscale an image client-side and store it as a data URI under `key`.
  const uploadImageSetting = (file: File, key: string, max = 600) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        update(key, canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const handleWmUpload = (file: File) => uploadImageSetting(file, "wm_image");
  const handleStampUpload = (file: File) => uploadImageSetting(file, "company_stamp", 500);

  const handleIconUpload = async (file: File) => {
    setUploadingIcon(true);
    const form = new FormData();
    form.append("icon", file);
    try {
      const res = await fetch("/api/app-icon", { method: "POST", body: form });
      if (res.ok) setIconVer((v) => v + 1);
    } catch {} finally { setUploadingIcon(false); }
  };

  const handleIconDelete = async () => {
    const res = await fetch("/api/app-icon", { method: "DELETE" });
    if (res.ok) setIconVer((v) => v + 1);
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
            {t("settingsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("systemSettings")}</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? t("savingText") : saved ? t("savedMsg") : t("saveChangesBtn")}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          {t("companyLogo")}
        </h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
            {logo ? (
              <img src={logo} alt={t("companyLogo")} className="w-full h-full object-contain" />
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
              {uploadingLogo ? t("uploadingLogo") : t("uploadLogo")}
            </button>
            {logo && (
              <button onClick={handleLogoDelete}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                {t("deleteLogo")}
              </button>
            )}
            <p className="text-xs text-gray-400">{t("logoHint")}</p>
          </div>
        </div>
      </div>

      {/* App icon */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-gray-400" />
          {t("appIcon")}
        </h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden bg-gray-50">
            {/* iconVer busts the cache so a fresh upload shows immediately. */}
            <img src={`/api/app-icon?v=${iconVer}`} alt={t("appIcon")} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <input type="file" ref={iconRef} className="hidden" accept="image/png,image/jpeg,image/webp"
              onChange={(e) => { if (e.target.files?.[0]) { setIconFile(e.target.files[0]); e.target.value = ""; } }} />
            <button onClick={() => iconRef.current?.click()} disabled={uploadingIcon}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <Upload className="w-4 h-4" />
              {uploadingIcon ? t("uploadingLogo") : t("uploadIcon")}
            </button>
            <button onClick={handleIconDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
              {t("resetIcon")}
            </button>
            <p className="text-xs text-gray-400">{t("appIconHint")}</p>
          </div>
        </div>
      </div>

      {iconFile && (
        <AppIconEditor
          file={iconFile}
          saving={uploadingIcon}
          onCancel={() => setIconFile(null)}
          onSave={async (f) => { await handleIconUpload(f); setIconFile(null); }}
        />
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          {t("workflowSettings")}
        </h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.allow_self_approve !== "false"}
            onChange={(e) => update("allow_self_approve", e.target.checked ? "true" : "false")}
            className="mt-1 w-4 h-4 rounded" />
          <span>
            <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{t("allowSelfApprove")}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{t("allowSelfApproveHint")}</span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            {t("companyInfo")}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyName")}</label>
              <input type="text" value={settings.company_name || ""} onChange={(e) => update("company_name", e.target.value)}
                className="field" placeholder="Homex" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companySubtitle")}</label>
              <input type="text" value={settings.company_subtitle || ""} onChange={(e) => update("company_subtitle", e.target.value)}
                className="field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyFactory")}</label>
              <input type="text" value={settings.company_factory || ""} onChange={(e) => update("company_factory", e.target.value)}
                className="field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyPhone")}</label>
              <input type="tel" value={settings.company_phone || ""} onChange={(e) => update("company_phone", e.target.value)}
                className="field font-mono-en" placeholder="+968 XXXXXXXX" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyAddress")}</label>
              <input type="text" value={settings.company_address || ""} onChange={(e) => update("company_address", e.target.value)}
                className="field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("commercialReg")}</label>
              <input type="text" value={settings.company_cr || ""} onChange={(e) => update("company_cr", e.target.value)}
                className="field font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("vatNumber")}</label>
              <input type="text" value={settings.company_vat || ""} onChange={(e) => update("company_vat", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="OM..." />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyWebsite")}</label>
              <input type="url" value={settings.company_website || ""} onChange={(e) => update("company_website", e.target.value)}
                className="field font-mono-en" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyInstagram")}</label>
              <input type="text" value={settings.company_instagram || ""} onChange={(e) => update("company_instagram", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="https://instagram.com/username" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("companyMaps")}</label>
              <input type="url" value={settings.company_maps || ""} onChange={(e) => update("company_maps", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="https://maps.app.goo.gl/..." />
            </div>
          </div>
        </div>

        {/* Watermark customisation (new quotation document) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-1">{t("wmTitle")}</h2>
          <p className="text-xs text-gray-400 mb-4">{t("wmHint")}</p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={(settings.wm_enabled ?? "1") !== "0"}
              onChange={(e) => update("wm_enabled", e.target.checked ? "1" : "0")}
              className="w-4 h-4 accent-gray-900 dark:accent-gray-100" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t("wmEnable")}</span>
          </label>

          {/* Custom watermark image (falls back to the logo when empty) */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {settings.wm_image
              ? <img src={settings.wm_image} alt="watermark" className="w-14 h-14 object-contain border border-gray-200 dark:border-gray-700 rounded bg-gray-50" />
              : <div className="w-14 h-14 grid place-items-center border border-dashed border-gray-300 dark:border-gray-600 rounded text-[10px] text-gray-400 text-center">الشعار</div>}
            <input type="file" ref={wmRef} className="hidden" accept="image/png,image/webp,image/svg+xml,image/jpeg"
              onChange={(e) => { if (e.target.files?.[0]) handleWmUpload(e.target.files[0]); }} />
            <button onClick={() => wmRef.current?.click()}
              className="px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700">{t("wmUpload")}</button>
            {settings.wm_image && (
              <button onClick={() => update("wm_image", "")}
                className="px-3 h-10 rounded-lg border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50">{t("wmRemove")}</button>
            )}
            <span className="text-xs text-gray-400">{t("wmImageHint")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wmColor")}</label>
              <input type="color" value={settings.wm_color || "#3d3d3d"} onChange={(e) => update("wm_color", e.target.value)}
                className="w-full h-11 rounded border border-gray-200 dark:border-gray-700 bg-white cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wmOpacity")}</label>
              <input type="number" min={0} max={30} step={1} value={settings.wm_opacity ?? "5"} onChange={(e) => update("wm_opacity", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="5" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("wmSize")}</label>
              <input type="number" min={200} max={800} step={20} value={settings.wm_size ?? "560"} onChange={(e) => update("wm_size", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="560" />
            </div>
          </div>
        </div>

        {/* Company stamp + signature (shown on the new quotation document) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-1">{t("stampTitle")}</h2>
          <p className="text-xs text-gray-400 mb-4">{t("stampHint")}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {settings.company_stamp
              ? <img src={settings.company_stamp} alt="stamp" className="h-16 object-contain border border-gray-200 dark:border-gray-700 rounded bg-white px-2" style={{ filter: "grayscale(1) brightness(0.35) contrast(1.4)" }} />
              : <div className="w-16 h-16 grid place-items-center border border-dashed border-gray-300 dark:border-gray-600 rounded text-[10px] text-gray-400 text-center">لا يوجد</div>}
            <input type="file" ref={stampRef} className="hidden" accept="image/png,image/webp,image/jpeg"
              onChange={(e) => { if (e.target.files?.[0]) handleStampUpload(e.target.files[0]); }} />
            <button onClick={() => stampRef.current?.click()}
              className="px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700">{t("stampUpload")}</button>
            {settings.company_stamp && (
              <button onClick={() => update("company_stamp", "")}
                className="px-3 h-10 rounded-lg border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50">{t("wmRemove")}</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stampSize")}</label>
              <input type="number" min={30} max={180} step={2} value={settings.stamp_size ?? "120"} onChange={(e) => update("stamp_size", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="120" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stampPosH")}</label>
              <select value={settings.stamp_halign || "center"} onChange={(e) => update("stamp_halign", e.target.value)} className="field">
                <option value="right">{t("posRight")}</option>
                <option value="center">{t("posCenter")}</option>
                <option value="left">{t("posLeft")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stampPosV")}</label>
              <select value={settings.stamp_valign || "bottom"} onChange={(e) => update("stamp_valign", e.target.value)} className="field">
                <option value="top">{t("posTop")}</option>
                <option value="center">{t("posMiddle")}</option>
                <option value="bottom">{t("posBottom")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer signature size / position on the quotation */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-1">{t("signTitle")}</h2>
          <p className="text-xs text-gray-400 mb-4">{t("signHint")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("signSize")}</label>
              <input type="number" min={30} max={160} step={2} value={settings.sign_size ?? "70"} onChange={(e) => update("sign_size", e.target.value)}
                className="field font-mono-en" dir="ltr" placeholder="70" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stampPosH")}</label>
              <select value={settings.sign_halign || "center"} onChange={(e) => update("sign_halign", e.target.value)} className="field">
                <option value="right">{t("posRight")}</option>
                <option value="center">{t("posCenter")}</option>
                <option value="left">{t("posLeft")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stampPosV")}</label>
              <select value={settings.sign_valign || "bottom"} onChange={(e) => update("sign_valign", e.target.value)} className="field">
                <option value="top">{t("posTop")}</option>
                <option value="center">{t("posMiddle")}</option>
                <option value="bottom">{t("posBottom")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* WhatsApp message templates */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-1 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-gray-400" /> {t("stWaTitle")}</h2>
          <p className="text-xs text-gray-400 mb-4">
            {t("stWaHint")}{" "}
            <code className="font-mono-en" dir="ltr">{"{customer} {number} {total} {advance} {advancePct} {link} {date} {time} {location} {company} {companyPhone}"}</code>
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stWaQuote")}</label>
              <textarea rows={7} value={settings.wa_template_quote ?? ""} onChange={(e) => update("wa_template_quote", e.target.value)}
                className="field font-mono-en text-sm" dir="rtl" placeholder={DEFAULT_WA_QUOTE} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stWaDeliveryDate")}</label>
              <textarea rows={6} value={settings.wa_template_delivery ?? ""} onChange={(e) => update("wa_template_delivery", e.target.value)}
                className="field font-mono-en text-sm" dir="rtl" placeholder={DEFAULT_WA_DELIVERY} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stWaCompleted")}</label>
              <textarea rows={6} value={settings.wa_template_completed ?? ""} onChange={(e) => update("wa_template_completed", e.target.value)}
                className="field font-mono-en text-sm" dir="rtl" placeholder={DEFAULT_WA_COMPLETED} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stWaReady")}</label>
              <textarea rows={6} value={settings.wa_template_ready ?? ""} onChange={(e) => update("wa_template_ready", e.target.value)}
                className="field font-mono-en text-sm" dir="rtl" placeholder={DEFAULT_WA_READY} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("stWaDelivered")}</label>
              <textarea rows={6} value={settings.wa_template_delivered ?? ""} onChange={(e) => update("wa_template_delivered", e.target.value)}
                className="field font-mono-en text-sm" dir="rtl" placeholder={DEFAULT_WA_DELIVERED} />
            </div>
            <p className="text-[11px] text-gray-400">{t("stWaDefaultHint")}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-4">{t("financialSettings")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("vatRate")}</label>
              <input type="number" step={0.1} min={0} max={100} value={settings.vat_rate || "5"}
                onChange={(e) => update("vat_rate", e.target.value)}
                className="field font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("advancePercent")}</label>
              <input type="number" step={1} min={0} max={100} value={settings.advance_pct || "15"}
                onChange={(e) => update("advance_pct", e.target.value)}
                className="field font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("quoteValidity")}</label>
              <input type="number" min={1} value={settings.quote_validity_days || "30"}
                onChange={(e) => update("quote_validity_days", e.target.value)}
                className="field font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("currencyLabel")}</label>
              <input type="text" value={settings.currency || "ر.ع"} onChange={(e) => update("currency", e.target.value)}
                className="field" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mt-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-gray-400" />
          {t("termsTitle")}
        </h2>
        <p className="text-sm text-gray-500 mb-3">{t("termsHint")}</p>
        <textarea
          value={settings.terms_conditions || ""}
          onChange={(e) => update("terms_conditions", e.target.value)}
          rows={8}
          className="field-textarea leading-relaxed"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mt-6">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          {t("dataManagement")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a href="/api/export?type=quotations" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            {t("exportQuotations")}
          </a>
          <a href="/api/export?type=customers" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            {t("exportCustomers")}
          </a>
          <a href="/api/backup" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 text-purple-600" />
            {t("backupData")}
          </a>
          <a href="/api/export/xlsx" download
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {t("exportExcel")}
          </a>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold">{t("autoBackups")}</h3>
            <span className="text-xs text-gray-400">{backups.length}/14</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">{t("autoBackupInfo")}</p>
          {backups.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">{t("noBackupsYet")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {backups.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-en text-gray-700 dark:text-gray-300">
                      {new Date(b.createdAt).toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${b.source === "auto" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                      {b.source === "auto" ? t("backupAuto") : t("backupManual")}
                    </span>
                    <span className="text-xs text-gray-400 font-mono-en">{(b.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <a href={`/api/backup?id=${b.id}`} download
                    className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:underline">
                    <Download className="w-3.5 h-3.5" />
                    {t("downloadLabel")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
