import Link from "next/link";

export default function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-neutral-50 p-4"
    >
      <div className="text-center max-w-md">
        <div className="text-7xl font-black text-neutral-200 mb-4">404</div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          الصفحة غير موجودة
        </h2>
        <p className="text-neutral-600 mb-6">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          href="/"
          className="inline-block bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
