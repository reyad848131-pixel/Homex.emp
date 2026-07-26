"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

export function QuoteDecision({ token, initialStatus }: { token: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState("");

  const decided = status === "accepted" || status === "declined";
  const closed = !["pending", "approved", "sent", "revised", "draft"].includes(status);

  const act = async (action: "accept" | "reject") => {
    if (action === "reject" && !confirm("هل أنت متأكد من رفض العرض؟")) return;
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/public/quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(action === "accept" ? "accepted" : "declined");
      } else if (data.status) {
        setStatus(data.status);
      } else {
        setError("تعذّر إتمام العملية، حاول مرة أخرى.");
      }
    } catch {
      setError("تعذّر الاتصال، تحقّق من الإنترنت.");
    } finally {
      setBusy(null);
    }
  };

  if (status === "accepted") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <p className="font-bold text-emerald-800">تم قبول العرض — شكراً لك! ✅</p>
        <p className="text-sm text-emerald-700 mt-1">سيتواصل معك فريقنا لإتمام الطلب.</p>
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="font-bold text-red-700">تم رفض العرض</p>
        <p className="text-sm text-red-600 mt-1">شكراً لوقتك، نتمنى خدمتك مستقبلاً.</p>
      </div>
    );
  }
  if (closed && !decided) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
        <p className="font-bold text-gray-600">هذا العرض لم يعد متاحاً للرد.</p>
        <p className="text-sm text-gray-500 mt-1">يرجى التواصل مع الشركة.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-center text-sm text-gray-500 mb-3">هل توافق على هذا العرض؟</p>
      <div className="flex gap-3">
        <button onClick={() => act("accept")} disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
          {busy === "accept" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          موافق على العرض
        </button>
        <button onClick={() => act("reject")} disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
          {busy === "reject" ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
          أرفض
        </button>
      </div>
      {error && <p className="text-red-500 text-sm text-center mt-3 font-semibold">{error}</p>}
    </div>
  );
}
