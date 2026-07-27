"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { STATUS_MAP } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { normalizeNumeric } from "@/components/quote-builders";
import { SignaturePad } from "@/components/signature-pad";
import {
  ArrowRight, Printer, Trash2, CheckCircle, XCircle, Send,
  Clock, FileText, User, MapPin, Phone, Pencil, Download, Copy, MessageCircle, CalendarDays,
  CreditCard, Plus, Banknote, RotateCcw, Receipt, MessageSquare, AlertCircle, Share2,
} from "lucide-react";
import Link from "next/link";

interface QuotationDetail {
  id: string;
  quoteNumber: string;
  status: string;
  statusComment: string | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  advancePct: number;
  advanceAmount: number;
  notes: string | null;
  managerEditNote: string | null;
  managerEditedAt: string | null;
  signatureData: string | null;
  signerName: string | null;
  signedAt: string | null;
  validUntil: string | null;
  deliveryDate: string | null;
  createdAt: string;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string; address: string | null };
  employee: { id: string; name: string; civilId: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    extras: number;
    lineTotal: number;
    category: { nameAr: string; nameEn: string };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    notes: string | null;
    paidAt: string;
    recorder: { name: string };
  }>;
  invoice: {
    id: string;
    invoiceNumber: string;
    issuedAt: string;
    issuer: { name: string };
  } | null;
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  draft: "statusDraft",
  pending: "statusPending",
  approved: "statusApproved",
  sent: "statusSent",
  accepted: "statusAccepted",
  revised: "statusRevised",
  declined: "statusDeclined",
  cancelled: "statusCancelled",
};

const PAYMENT_METHOD_KEYS: Record<string, TranslationKey> = {
  cash: "cash",
  bank_transfer: "bankTransfer",
  cheque: "cheque",
  card: "card",
};

export default function QuoteDetailClient({
  id,
  initialQuote,
  initialTerms,
  initialSelfApprove,
  initialMe,
}: {
  id: string;
  initialQuote: QuotationDetail | null;
  initialTerms: string;
  initialSelfApprove: boolean;
  initialMe: { id: string; role: string } | null;
}) {
  const router = useRouter();
  const { t, locale, dateLocale } = useI18n();
  const toast = useToast();
  // Initial data is provided by the server (SSR) so the page renders instantly
  // with no loading spinner and no client round-trips. Mutations below patch
  // this state locally, so no re-fetch on mount is needed.
  const [q, setQ] = useState<QuotationDetail | null>(initialQuote);
  const [terms, setTerms] = useState(initialTerms);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState<"approved" | "declined" | "revised" | null>(null);
  const [statusComment, setStatusComment] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [me] = useState<{ id: string; role: string } | null>(initialMe);
  const [selfApprove] = useState(initialSelfApprove);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  // Pending flags so action buttons respond instantly (spinner + disabled) on
  // click instead of appearing frozen while the server request is in flight.
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [whatsapping, setWhatsapping] = useState(false);

  const fmtCur = (n: number) => `${n.toFixed(3)} ${t("omr")}`;

  // Keep `terms` in sync if the server value changes across navigations.
  useEffect(() => { setTerms(initialTerms); }, [initialTerms]);

  const updateStatus = async (status: string, comment?: string) => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, statusComment: comment || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setQ((prev) => prev ? { ...prev, status: data.status, statusComment: data.statusComment } : prev);
        setShowStatusDialog(null);
        setStatusComment("");
        toast.success(t("statusUpdatedSuccess"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("operationFailed"));
      }
    } catch {
      toast.error(t("serverConnectionError"));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleStatusAction = (action: "approved" | "declined" | "revised") => {
    setStatusComment("");
    setShowStatusDialog(action);
  };

  const confirmStatusAction = () => {
    if (!showStatusDialog) return;
    if (showStatusDialog === "revised" && !statusComment.trim()) return;
    updateStatus(showStatusDialog, statusComment.trim());
  };

  const handleCreateInvoice = async () => {
    if (!q) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: q.id }),
      });
      if (res.ok) {
        const invoice = await res.json();
        setQ((prev) => prev ? { ...prev, invoice: { ...invoice, issuer: { name: "" } } } : prev);
        toast.success(t("invoiceIssuedSuccess"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("operationFailed"));
      }
    } catch {
      toast.error(t("serverConnectionError"));
    } finally { setCreatingInvoice(false); }
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteQuote"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("deletedSuccess"));
        router.push("/quotations");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("deleteFailed"));
        setDeleting(false);
      }
    } catch {
      toast.error(t("serverConnectionError"));
      setDeleting(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDuplicate = async () => {
    if (!q || duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/quotations/${data.id}/edit`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("operationFailed"));
        setDuplicating(false);
      }
    } catch {
      toast.error(t("serverConnectionError"));
      setDuplicating(false);
    }
  };

  // Generate (once) and return the public customer link.
  const ensureShareUrl = async () => {
    if (shareUrl) return shareUrl;
    const res = await fetch(`/api/quotations/${id}/share`, { method: "POST" });
    const data = await res.json();
    const url = `${window.location.origin}/q/${data.token}`;
    setShareUrl(url);
    return url;
  };

  const handleShare = async () => {
    setSharing(true);
    try { await ensureShareUrl(); } catch { toast.error(t("operationFailed")); }
    finally { setSharing(false); }
  };

  const handleWhatsApp = async () => {
    if (!q || whatsapping) return;
    setWhatsapping(true);
    let link = "";
    try { link = await ensureShareUrl(); } catch { /* fall back to summary only */ }
    setWhatsapping(false);
    const text = encodeURIComponent(
      `*${t("quotePrint")} - ${q.quoteNumber}*\n` +
      `${t("customer")}: ${q.customer.name}\n` +
      `${t("grandTotal")}: ${fmtCur(q.total)}\n` +
      `${t("advancePayment")} (${q.advancePct}%): ${fmtCur(q.advanceAmount)}\n` +
      (link ? `\n${t("viewAndApprove")}:\n${link}\n` : "") +
      `\n--- ${q.quoteNumber} ---`
    );
    const phone = q.customer.phone.replace(/\D/g, "");
    const code = (q.customer.phoneCode || "+968").replace(/\D/g, "");
    const fullPhone = phone.startsWith(code) ? phone : `${code}${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
  };

  const handleAddPayment = async () => {
    if (!q || !payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: q.id,
          amount: Number(payAmount),
          method: payMethod,
          reference: payRef || null,
          notes: payNotes || null,
        }),
      });
      if (res.ok) {
        const payment = await res.json();
        setQ((prev) => prev ? { ...prev, payments: [payment, ...prev.payments] } : prev);
        setPayAmount("");
        setPayRef("");
        setPayNotes("");
        setShowPayForm(false);
        toast.success(t("paymentAddedSuccess"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("operationFailed"));
      }
    } catch {
      toast.error(t("serverConnectionError"));
    } finally { setPaying(false); }
  };

  if (!q) return <div className="text-center py-20 text-red-500">{t("quoteNotFound")}</div>;

  const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
  const statusLabel = STATUS_KEYS[q.status] ? t(STATUS_KEYS[q.status]) : status.label;

  const groupedItems: Record<string, typeof q.items> = {};
  q.items.forEach((item) => {
    const cat = locale === "en" && item.category.nameEn ? item.category.nameEn : item.category.nameAr;
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });

  return (
    <>
      <div className="no-print">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/quotations" className="text-gray-400 hover:text-gray-600">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="font-mono-en">{q.quoteNumber}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${status.color}`}>{statusLabel}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {t("createdBy")} {q.employee.name} - {new Date(q.createdAt).toLocaleDateString(dateLocale)}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
              <Printer className="w-4 h-4" />
              {t("print")}
            </button>
            <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
              <Download className="w-4 h-4" />
              PDF
            </a>
            <button onClick={handleWhatsApp} disabled={whatsapping}
              className="flex items-center gap-2 px-4 py-2 border border-green-200 text-green-600 rounded text-sm font-bold hover:bg-green-50 disabled:opacity-50">
              {whatsapping ? <Clock className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {t("whatsapp")}
            </button>
            <button onClick={handleShare} disabled={sharing}
              className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded text-sm font-bold hover:bg-blue-50 disabled:opacity-50">
              <Share2 className="w-4 h-4" />
              {t("shareWithCustomer")}
            </button>
            <button onClick={handleDuplicate} disabled={duplicating}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 disabled:opacity-50">
              {duplicating ? <Clock className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              {t("duplicate")}
            </button>
            {(q.status === "draft" || q.status === "pending" || q.status === "revised" || me?.role !== "sales") && (
              <Link href={`/quotations/${id}/edit`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border rounded text-sm font-bold hover:bg-gray-50",
                  (q.invoice || q.payments.length > 0 || q.status === "accepted") && me?.role !== "sales"
                    ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20"
                    : "border-gray-200"
                )}>
                <Pencil className="w-4 h-4" />
                {(q.invoice || q.payments.length > 0 || q.status === "accepted") && me?.role !== "sales" ? t("managerEditLocked") : t("edit")}
              </Link>
            )}
            {(q.status === "draft" || q.status === "revised") && (
              <button onClick={() => updateStatus("pending")} disabled={statusBusy}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {statusBusy ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t("sendForReview")}
              </button>
            )}
            {selfApprove && me?.role === "sales" && (q.status === "draft" || q.status === "pending" || q.status === "revised") && (
              <button onClick={() => updateStatus("approved")} disabled={statusBusy}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                {statusBusy ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t("selfApproveBtn")}
              </button>
            )}
            {q.status === "pending" && me?.role !== "sales" && (
              <>
                <button onClick={() => handleStatusAction("approved")}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {t("approve")}
                </button>
                <button onClick={() => handleStatusAction("revised")}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded text-sm font-bold hover:bg-orange-600">
                  <RotateCcw className="w-4 h-4" />
                  {t("returnForEdit")}
                </button>
                <button onClick={() => handleStatusAction("declined")}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700">
                  <XCircle className="w-4 h-4" />
                  {t("decline")}
                </button>
              </>
            )}
            {q.status === "approved" && !q.invoice && (
              <button onClick={handleCreateInvoice} disabled={creatingInvoice}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                <Receipt className="w-4 h-4" />
                {creatingInvoice ? t("issuingInvoice") : t("issueInvoice")}
              </button>
            )}
            {q.invoice && (
              <a href={`/api/invoices/${q.invoice.id}/pdf`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-600 rounded text-sm font-bold hover:bg-emerald-50">
                <Receipt className="w-4 h-4" />
                {t("invoice")} {q.invoice.invoiceNumber}
              </a>
            )}
            {!(q.invoice || q.payments.length > 0 || q.status === "accepted") && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded text-sm font-bold hover:bg-red-50 disabled:opacity-50">
                {deleting ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {shareUrl && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 mt-4 no-print">
            <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> {t("shareLinkTitle")}
            </p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} dir="ltr" className="field flex-1 min-w-0 text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={() => { navigator.clipboard?.writeText(shareUrl); toast.success(t("copied")); }}
                className="flex items-center gap-1.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shrink-0">
                <Copy className="w-4 h-4" /> {t("copy")}
              </button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">{t("shareLinkHint")}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> {t("customerInfo")}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold">{q.customer.name}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone className="w-4 h-4" />
                <span className="font-mono-en">{q.customer.phoneCode} {q.customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                <span>{q.customer.governorate} - {q.customer.wilayat}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CalendarDays className="w-4 h-4" />
                <span>{t("validUntil")}: {q.validUntil ? new Date(q.validUntil).toLocaleDateString(dateLocale) : "—"}</span>
              </div>
              {q.deliveryDate && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>{t("deliveryDate")}: {new Date(q.deliveryDate).toLocaleDateString(dateLocale)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> {t("itemDetails")} ({q.items.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">#</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("item")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("quantity")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("price")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("extras")}</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-semibold">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedItems).map(([catName, catItems]) => (
                    <>
                      <tr key={catName}>
                        <td colSpan={6} className="py-2 bg-gray-50 px-3 font-bold text-xs text-gray-500 uppercase">
                          {catName}
                        </td>
                      </tr>
                      {catItems.map((item, i) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2.5 font-mono-en text-gray-400">{i + 1}</td>
                          <td className="py-2.5 font-semibold">{item.description}</td>
                          <td className="py-2.5 font-mono-en">{item.quantity}</td>
                          <td className="py-2.5 font-mono-en">{fmtCur(item.unitPrice)}</td>
                          <td className="py-2.5 font-mono-en">{item.extras > 0 ? fmtCur(item.extras) : "-"}</td>
                          <td className="py-2.5 font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 mt-4 pt-4 space-y-2 max-w-xs mr-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t("subtotal")}</span>
                <span className="font-bold font-mono-en">{fmtCur(q.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t("vat")} ({(q.vatRate * 100).toFixed(0)}%)</span>
                <span className="font-bold font-mono-en">{fmtCur(q.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
                <span className="font-bold">{t("grandTotal")}</span>
                <span className="font-black font-mono-en">{fmtCur(q.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t("advancePayment")} ({q.advancePct}%)</span>
                <span className="font-bold font-mono-en text-green-600">{fmtCur(q.advanceAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {q.statusComment && (q.status === "declined" || q.status === "revised" || q.status === "approved") && (
          <div className={cn(
            "border rounded p-4 mt-6 flex items-start gap-3",
            q.status === "declined" ? "bg-red-50 border-red-200" :
            q.status === "revised" ? "bg-orange-50 border-orange-200" :
            "bg-green-50 border-green-200"
          )}>
            <MessageSquare className={cn("w-5 h-5 mt-0.5 flex-shrink-0",
              q.status === "declined" ? "text-red-500" :
              q.status === "revised" ? "text-orange-500" : "text-green-500"
            )} />
            <div>
              <p className={cn("text-sm font-bold",
                q.status === "declined" ? "text-red-700" :
                q.status === "revised" ? "text-orange-700" : "text-green-700"
              )}>
                {q.status === "declined" ? t("declineReason") : q.status === "revised" ? t("revisionNote") : t("approvalNote")}
              </p>
              <p className="text-sm text-gray-700 mt-1">{q.statusComment}</p>
            </div>
          </div>
        )}

        {q.managerEditedAt && (
          <div className="border rounded p-4 mt-6 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{t("managerEditedBadge")}</p>
              {q.managerEditNote && <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{q.managerEditNote}</p>}
            </div>
          </div>
        )}

        {q.notes && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5 mt-6">
            <h2 className="text-sm font-bold text-gray-400 mb-2">{t("notes")}</h2>
            <p className="text-sm text-gray-700">{q.notes}</p>
          </div>
        )}

        {terms && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5 mt-6">
            <h2 className="text-sm font-bold text-gray-400 mb-3">{t("termsAndConditions")}</h2>
            <ul className="space-y-1.5">
              {terms.split("\n").filter(Boolean).map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 mt-0.5">•</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contract signature: show the signed record, or let the rep capture
            it in person on this device. */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-5 mt-6 no-print">
          <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> {t("contractSignature")}
          </h2>
          {q.signedAt ? (
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs text-gray-400 mb-1">{t("signerName")}</p>
                <p className="font-bold text-gray-800 dark:text-gray-100">{q.signerName}</p>
                <p className="text-xs text-gray-400 mt-2 font-mono-en">
                  {new Date(q.signedAt).toLocaleString(locale === "ar" ? "ar-OM" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              {q.signatureData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.signatureData} alt="signature" className="h-20 bg-white border border-gray-200 rounded px-2" />
              )}
            </div>
          ) : (
            <SignCapture id={id} onSigned={(u) => setQ((prev) => prev ? { ...prev, ...u } : prev)} />
          )}
        </div>

        {q.status === "approved" && (() => {
          const totalPaid = q.payments.reduce((s, p) => s + p.amount, 0);
          const remaining = q.total - totalPaid;
          const paidPct = q.total > 0 ? (totalPaid / q.total) * 100 : 0;
          return (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded mt-6">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Banknote className="w-4 h-4" /> {t("payments")}
                </h2>
                <button onClick={() => setShowPayForm(!showPayForm)}
                  className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors">
                  <Plus className="w-4 h-4" /> {t("recordPayment")}
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono-en text-green-600">{paidPct.toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-xs text-gray-400">{t("grandTotal")}</p>
                    <p className="font-bold font-mono-en">{fmtCur(q.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t("paid")}</p>
                    <p className="font-bold font-mono-en text-green-600">{fmtCur(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t("remaining")}</p>
                    <p className="font-bold font-mono-en text-red-600">{fmtCur(remaining)}</p>
                  </div>
                </div>

                {showPayForm && remaining > 0 && (
                  <div className="border border-gray-200 rounded p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("amount")} *</label>
                        <input type="text" inputMode="decimal" dir="ltr"
                          value={payAmount}
                          onChange={(e) => setPayAmount(normalizeNumeric(e.target.value))}
                          className="field font-mono-en"
                          placeholder={`${t("maxAmount")} ${remaining.toFixed(3)}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("paymentMethod")}</label>
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                          className="field">
                          {Object.entries(PAYMENT_METHOD_KEYS).map(([k, lk]) => <option key={k} value={k}>{t(lk)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t("reference")}</label>
                      <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                        className="field font-mono-en" placeholder={t("optional")} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t("notes")}</label>
                      <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                        className="field" placeholder={t("optional")} />
                    </div>
                    <button onClick={handleAddPayment} disabled={paying || !payAmount || Number(payAmount) <= 0}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                      <CreditCard className="w-4 h-4" />
                      {paying ? t("recording") : t("recordPaymentBtn")}
                    </button>
                  </div>
                )}

                {q.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-right py-2 text-xs text-gray-400">{t("amount")}</th>
                          <th className="text-right py-2 text-xs text-gray-400">{t("method")}</th>
                          <th className="text-right py-2 text-xs text-gray-400">{t("reference")}</th>
                          <th className="text-right py-2 text-xs text-gray-400">{t("by")}</th>
                          <th className="text-right py-2 text-xs text-gray-400">{t("date")}</th>
                          <th className="text-right py-2 text-xs text-gray-400"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.payments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-2 font-mono-en font-bold text-green-600">{fmtCur(p.amount)}</td>
                            <td className="py-2 text-gray-500">{PAYMENT_METHOD_KEYS[p.method] ? t(PAYMENT_METHOD_KEYS[p.method]) : p.method}</td>
                            <td className="py-2 font-mono-en text-gray-400 text-xs">{p.reference || "—"}</td>
                            <td className="py-2 text-gray-500 text-xs">{p.recorder.name}</td>
                            <td className="py-2 font-mono-en text-gray-400 text-xs">{new Date(p.paidAt).toLocaleDateString(dateLocale)}</td>
                            <td className="py-2">
                              <a href={`/api/payments/${p.id}/pdf`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900" title={t("receiptLabel")}>
                                <Receipt className="w-3.5 h-3.5" />
                                {t("receiptLabel")}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">{t("noPayments")}</p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Print View */}
      <div className="hidden print:block p-8" dir="rtl">
        <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
          <h1 className="text-3xl font-black">HOMEX</h1>
          <p className="text-sm text-gray-500 mt-1">{t("quotePrint")}</p>
          <p className="text-xs text-gray-400 mt-2 font-mono-en">{q.quoteNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div>
            <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">{t("customerInfo")}</h3>
            <p className="font-bold text-lg">{q.customer.name}</p>
            <p className="text-gray-600">{q.customer.phoneCode} {q.customer.phone}</p>
            <p className="text-gray-600">{q.customer.governorate} - {q.customer.wilayat}</p>
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">{t("quoteDetails")}</h3>
            <p>{t("date")}: {new Date(q.createdAt).toLocaleDateString(dateLocale)}</p>
            <p>{t("validUntil")}: {q.validUntil ? new Date(q.validUntil).toLocaleDateString(dateLocale) : "-"}</p>
            {q.deliveryDate && <p>{t("deliveryDate")}: {new Date(q.deliveryDate).toLocaleDateString(dateLocale)}</p>}
            <p>{t("employee")}: {q.employee.name}</p>
          </div>
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-right p-2 border">#</th>
              <th className="text-right p-2 border">{t("item")}</th>
              <th className="text-right p-2 border">{t("quantity")}</th>
              <th className="text-right p-2 border">{t("unitPrice")}</th>
              <th className="text-right p-2 border">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={item.id} className="border">
                <td className="p-2 border">{i + 1}</td>
                <td className="p-2 border font-semibold">{item.description}</td>
                <td className="p-2 border text-center">{item.quantity}</td>
                <td className="p-2 border font-mono-en">{fmtCur(item.unitPrice)}</td>
                <td className="p-2 border font-mono-en font-bold">{fmtCur(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>{t("subtotal")}</span><span className="font-bold font-mono-en">{fmtCur(q.subtotal)}</span></div>
            <div className="flex justify-between"><span>{t("tax")} ({(q.vatRate * 100).toFixed(0)}%)</span><span className="font-mono-en">{fmtCur(q.vatAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 text-lg">
              <span className="font-bold">{t("grandTotal")}</span>
              <span className="font-black font-mono-en">{fmtCur(q.total)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>{t("advancePayment")} ({q.advancePct}%)</span>
              <span className="font-bold font-mono-en">{fmtCur(q.advanceAmount)}</span>
            </div>
          </div>
        </div>

        {terms && (
          <div className="mt-8 pt-4 border-t">
            <h3 className="font-bold text-sm mb-2">{t("termsAndConditions")}:</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              {terms.split("\n").filter(Boolean).map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 pt-4 border-t text-center text-xs text-gray-400">
          <p>Homex - Quotation Management System</p>
        </div>
      </div>

      {showStatusDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print" onClick={() => setShowStatusDialog(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              {showStatusDialog === "approved" && <><CheckCircle className="w-5 h-5 text-green-600" /> {t("approveQuote")}</>}
              {showStatusDialog === "declined" && <><XCircle className="w-5 h-5 text-red-600" /> {t("declineQuote")}</>}
              {showStatusDialog === "revised" && <><RotateCcw className="w-5 h-5 text-orange-500" /> {t("returnForEditTitle")}</>}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {showStatusDialog === "revised" ? t("revisionRequired") : t("addCommentOptional")}
            </p>
            <textarea
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              rows={3}
              className="field-textarea mb-4"
              placeholder={showStatusDialog === "revised" ? "" : ""}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowStatusDialog(null)}
                className="px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50">
                {t("cancel")}
              </button>
              <button onClick={confirmStatusAction}
                disabled={statusBusy || (showStatusDialog === "revised" && !statusComment.trim())}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded text-sm font-bold text-white disabled:opacity-50",
                  showStatusDialog === "approved" ? "bg-green-600 hover:bg-green-700" :
                  showStatusDialog === "revised" ? "bg-orange-500 hover:bg-orange-600" :
                  "bg-red-600 hover:bg-red-700"
                )}>
                {statusBusy && <Clock className="w-4 h-4 animate-spin" />}
                {showStatusDialog === "approved" ? t("confirmApprove") :
                 showStatusDialog === "revised" ? t("returnForEdit") : t("confirmDecline")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// In-person signing widget on the detail page: the customer signs on the rep's
// device. Posts to the internal sign endpoint and reports the stored fields
// back so the parent updates without a reload.
function SignCapture({
  id,
  onSigned,
}: {
  id: string;
  onSigned: (u: { signatureData: string; signerName: string; signedAt: string; status: string }) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return toast.error(t("nameRequired"));
    if (!sig) return toast.error(t("signatureRequired"));
    // Optimistic: show the signed record instantly and save in the background.
    // On failure, reload to fall back to the true (unsigned) server state.
    onSigned({ signatureData: sig, signerName: name.trim(), signedAt: new Date().toISOString(), status: "accepted" });
    setOpen(false);
    fetch(`/api/quotations/${id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: name.trim(), signatureData: sig }),
    })
      .then(async (res) => {
        if (res.ok) { toast.success(t("signedSuccess")); return; }
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("errorOccurred"));
        setTimeout(() => window.location.reload(), 1200);
      })
      .catch(() => {
        toast.error(t("errorOccurred"));
        setTimeout(() => window.location.reload(), 1200);
      });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold px-4 py-2.5 rounded-lg text-sm">
        <Pencil className="w-4 h-4" /> {t("signInPerson")}
      </button>
    );
  }

  return (
    <div className="max-w-md">
      <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">{t("signerName")}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("signerName")}
        className="field mb-3" />
      <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">{t("signature")}</label>
      <SignaturePad onChange={setSig} clearLabel={t("clear")} />
      <div className="flex gap-2 mt-3">
        <button onClick={submit}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" /> {t("confirmSignature")}
        </button>
        <button onClick={() => setOpen(false)}
          className="px-4 py-2.5 rounded-lg text-sm font-bold border border-gray-300 text-gray-600">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
