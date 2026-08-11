"use client";

import { useEffect } from "react";
import { useToast } from "@/components/toast";
import { useI18n } from "@/lib/i18n";

// Watches every app API call for a 401 (expired / missing login session) and,
// instead of leaving a cryptic "Unauthorized" toast, shows a clear message and
// sends the user to the login page. Installed once for the app's lifetime.
export function SessionGuard() {
  const toast = useToast();
  const { t } = useI18n();

  useEffect(() => {
    const w = window as unknown as { __sessionGuard?: boolean };
    if (w.__sessionGuard) return;
    w.__sessionGuard = true;

    const orig = window.fetch.bind(window);
    let redirecting = false;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await orig(input, init);
      if (!redirecting && res.status === 401) {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
        // Only our own API (not the auth/login endpoints, which handle their own
        // 401s during sign-in).
        if (url && url.includes("/api/") && !url.includes("/api/auth") && !url.includes("/api/login")) {
          redirecting = true;
          try { toast.error(t("sessionExpired")); } catch {}
          setTimeout(() => { window.location.href = "/login?expired=1"; }, 700);
        }
      }
      return res;
    }) as typeof window.fetch;
  }, [toast, t]);

  return null;
}
