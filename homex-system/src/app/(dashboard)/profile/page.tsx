"use client";

import { useState, useEffect } from "react";
import { User, Phone, Shield, Calendar, Lock, Save, Check } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const ROLE_KEYS: Record<string, TranslationKey> = {
  admin: "roleAdmin",
  manager: "roleManager",
  sales: "roleSales",
};

interface Profile {
  id: string;
  name: string;
  civilId: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { t, dateLocale } = useI18n();

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setPhone(data.phone || "");
      });
  }, []);

  const handleSavePhone = async () => {
    setSavingPhone(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword) {
      setPasswordError(t("enterPasswords"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("passwordTooShort"));
      return;
    }

    setSavingPassword(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change-password", currentPassword, newPassword }),
    });

    const data = await res.json();
    setSavingPassword(false);

    if (!res.ok) {
      setPasswordError(data.error);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  if (!profile) return <div className="p-12 text-center text-gray-400">{t("loading")}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          {t("profileTitle")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("profileDescription")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-4">{t("basicInfo")}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded">
              <div className="w-14 h-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
                {profile.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">{profile.name}</p>
                <p className="text-sm text-gray-500">{ROLE_KEYS[profile.role] ? t(ROLE_KEYS[profile.role]) : profile.role}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">{t("civilIdLabel")}:</span>
                <span className="font-mono-en font-bold">{profile.civilId}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">{t("creationDate")}:</span>
                <span className="font-mono-en">{new Date(profile.createdAt).toLocaleDateString(dateLocale)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                <Phone className="w-3.5 h-3.5 inline ml-1" />
                {t("phoneNumber")}
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneSaved(false); }}
                  className="flex-1 border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en"
                  placeholder="+968 XXXXXXXX"
                />
                <button
                  onClick={handleSavePhone}
                  disabled={savingPhone}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {phoneSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savingPhone ? "..." : phoneSaved ? t("done") : t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            {t("changePassword")}
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("currentPassword")}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("newPassword")}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("confirmNewPassword")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <p className="text-red-600 text-sm font-medium">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-green-600 text-sm font-medium">{t("passwordChanged")}</p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm"
            >
              {savingPassword ? t("changingPassword") : t("changePassword")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
