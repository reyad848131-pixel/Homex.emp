"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html dir="rtl" lang="ar">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>⚠️</div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#171717",
              marginBottom: "0.5rem",
            }}
          >
            حدث خطأ غير متوقع
          </h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            عذراً، حدث خطأ في النظام. يرجى إعادة تحميل الصفحة.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#171717",
              color: "#fff",
              border: "none",
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
