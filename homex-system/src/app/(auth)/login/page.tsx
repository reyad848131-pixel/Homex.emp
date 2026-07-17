"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [civilId, setCivilId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        civilId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("رقم مدني أو كلمة مرور غير صحيحة");
        setLoading(false);
      } else if (result?.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("خطأ في الاتصال بالسيرفر");
        setLoading(false);
      }
    } catch {
      setError("خطأ في الاتصال بالسيرفر");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e7e8e2] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">homex</h1>
          <p className="text-xs text-gray-500 tracking-[0.14em] uppercase mt-1 font-medium">
            Quotation Management System
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-gray-400 mb-2 font-medium">
              دخول الموظفين
            </p>
            <h2 className="text-xl font-bold text-gray-900">تسجيل الدخول</h2>
            <p className="text-sm text-gray-500 mt-1">أدخل الرقم المدني وكلمة المرور</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الرقم المدني</label>
              <input
                type="text"
                value={civilId}
                onChange={(e) => setCivilId(e.target.value)}
                className="w-full border border-gray-200 bg-white text-gray-900 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="••••"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 bg-white text-gray-900 rounded px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          Homex Internal System v2.0
        </p>
      </div>
    </div>
  );
}
