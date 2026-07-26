"use client";

import { useState } from "react";
import { Check, X, Loader2, PenLine } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";

export function QuoteDecision({
  token,
  initialStatus,
  customerName = "",
}: {
  token: string;
  initialStatus: string;
  customerName?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [signing, setSigning] = useState(false);
  const [name, setName] = useState(customerName);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("ar-OM", { year: "numeric", month: "long", day: "numeric" });
  const decided = status === "accepted" || status === "declined";
  const closed = !["pending", "approved", "sent", "revised", "draft"].includes(status);

  const reject = async () => {
    if (!confirm("هل أنت متأكد من رفض العرض؟")) return;
    setBusy("reject");
    setError("");
    try {
      const res = await fetch(`/api/public/quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus("declined");
      else if (data.status) setStatus(data.status);
      else setError("تعذّر إتمام العملية، حاول مرة أخرى.");
    } catch {
      setError("تعذّر الاتصال، تحقّق من الإنترنت.");
    } finally {
      setBusy(null);
    }
  };

  const confirmSign = async () => {
    if (!name.trim()) return setError("الرجاء كتابة الاسم.");
    if (!signature) return setError("الرجاء التوقيع في المربّع.");
    setBusy("accept");
    setError("");
    try {
      const res = await fetch(`/api/public/quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", signerName: name.trim(), signatureData: signature }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus("accepted");
      else if (data.status) setStatus(data.status);
      else setError(data.error || "تعذّر إتمام العملية، حاول مرة أخرى.");
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
        <p className="font-bold text-emerald-800">تم قبول العرض وتوقيعه — شكراً لك! ✅</p>
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

  // Signing form (shown after the customer chooses to accept).
  if (signing) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="w-5 h-5 text-gray-700" />
          <p className="font-bold text-gray-800">توقيع العقد والموافقة</p>
        </div>

        <label className="block text-sm font-semibold text-gray-600 mb-1">الاسم الكامل</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الموقّع"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-3 text-sm"
        />

        <label className="block text-sm font-semibold text-gray-600 mb-1">التوقيع</label>
        <SignaturePad onChange={setSignature} />

        <p className="text-xs text-gray-500 mt-2">التاريخ: <span className="font-semibold font-mono-en">{today}</span></p>
        <p className="text-xs text-gray-400 mt-1">بالتوقيع فإنك توافق على بنود وشروط هذا العرض.</p>

        {error && <p className="text-red-500 text-sm text-center mt-3 font-semibold">{error}</p>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={confirmSign}
            disabled={busy !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {busy === "accept" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            تأكيد التوقيع والموافقة
          </button>
          <button
            onClick={() => { setSigning(false); setError(""); }}
            disabled={busy !== null}
            className="px-5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-center text-sm text-gray-500 mb-3">هل توافق على هذا العرض؟</p>
      <div className="flex gap-3">
        <button
          onClick={() => { setError(""); setSigning(true); }}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <PenLine className="w-5 h-5" />
          موافق وأوقّع
        </button>
        <button
          onClick={reject}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {busy === "reject" ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
          أرفض
        </button>
      </div>
      {error && <p className="text-red-500 text-sm text-center mt-3 font-semibold">{error}</p>}
    </div>
  );
}
