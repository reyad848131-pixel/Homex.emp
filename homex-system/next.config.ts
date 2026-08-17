import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. 'unsafe-inline' is required for Next.js hydration
// bootstrap scripts, the inline theme script, and Tailwind's injected styles.
// 'unsafe-eval' is only added in development for React Fast Refresh (HMR);
// production runs without it. Everything else is locked to same-origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Keep the headless-Chromium packages out of the bundle (large native binary);
  // they're required at runtime by the server-side PDF route instead.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The Chromium binary is loaded from the package's bin/ folder via a dynamic
  // path the file tracer can't detect, so force-include it in the PDF route's
  // function — otherwise it fails with "bin directory does not exist". Keys are
  // picomatch globs: "[id]" would be read as a character class, so match the
  // dynamic segment with "*" instead.
  outputFileTracingIncludes: {
    "/api/quotations/*/pdf-file": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
