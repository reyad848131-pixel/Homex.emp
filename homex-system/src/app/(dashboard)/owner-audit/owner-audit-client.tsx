"use client";

import { useState } from "react";
import { ShieldCheck, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Report = {
  firstTime: boolean;
  summary: string;
  boardTotal: number;
  snapshotCount: number;
  unchanged: number;
  boardMonthNull: number;
  boardMonthNote: string;
  snapshotList: Array<{
    quoteNumber: string; customer: string; createdAt: string;
    quoteLocation: string; customerLocation: string;
  }>;
};

export function OwnerAuditClient() {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  const run = async () => {
    if (passcode.trim().length < 4) { setError("كلمة المرور 4 خانات على الأقل"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/location-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setReport(data); }
      else { setError(data.error || "تعذّر الفحص"); }
    } catch {
      setError("خطأ في الاتصال");
    } finally { setBusy(false); }
  };

  const clean = report && report.snapshotCount === 0;

  return (
    <div dir="rtl" className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
        <ShieldCheck className="w-6 h-6 text-teal-600" /> فحص المالك — تدقيق المواقع
      </h1>
      <p className="text-sm text-gray-500 mb-6">صفحة خاصة بك وحدك، محميّة بكلمة مرورك الخاصة.</p>

      {!report && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm">
          <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> كلمة المرور الخاصة
          </label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="أدخل كلمة المرور"
            className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent font-mono-en"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-2">أول مرة: كلمة المرور اللي تدخلها الآن تصير كلمتك الدائمة.</p>
          {error && <p className="text-sm text-red-500 mt-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</p>}
          <button
            onClick={run}
            disabled={busy}
            className="mt-4 w-full h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} عرض التقرير
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {report.firstTime && (
            <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 p-3 text-sm text-teal-800 dark:text-teal-200">
              ✅ تم تعيين كلمة مرورك الخاصة. استخدمها في كل مرة.
            </div>
          )}
          <div className={`rounded-2xl border p-5 ${clean ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800"}`}>
            <div className="flex items-start gap-2">
              {clean ? <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />}
              <p className="font-bold text-sm leading-relaxed">{report.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="إجمالي الطلبات" value={report.boardTotal} />
            <Stat label="بدون تغيير" value={report.unchanged} tone="green" />
            <Stat label="بموقع خاص جديد" value={report.snapshotCount} tone={report.snapshotCount ? "amber" : "gray"} />
          </div>

          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-600 dark:text-gray-300">
            {report.boardMonthNote}
          </div>

          {report.snapshotList.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs font-bold text-gray-500">الطلبات ذات الموقع الخاص (المُنشأة/المعدّلة حديثاً)</div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {report.snapshotList.map((q) => (
                  <div key={q.quoteNumber} className="px-4 py-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-mono-en font-bold">{q.quoteNumber}</span>
                    <span className="font-semibold">{q.customer}</span>
                    <span className="text-teal-600">موقع العرض: {q.quoteLocation}</span>
                    <span className="text-gray-400">موقع العميل: {q.customerLocation}</span>
                    <span className="text-xs text-gray-400 font-mono-en ms-auto">{new Date(q.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { setReport(null); setPasscode(""); }} className="text-sm font-bold text-gray-500 underline">إغلاق</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: "green" | "amber" | "gray" }) {
  const color = tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div className={`text-2xl font-bold font-mono-en ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
