import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { normalizePhone, stripInvisible } from "@/lib/text";

// Public (no-login) intake for the company website's "request a quote" form.
// The website lives on a different origin (Vercel), so this endpoint is
// CORS-enabled for the known site origins. Enquiries land as Lead rows (kept
// out of the real customer list) and notify staff. Hardened against casual
// abuse: honeypot field, per-IP rate limit, size caps, and strict validation.

// Origins allowed to POST here. Extend via env WEBSITE_ORIGINS (comma-separated)
// when the site moves to a custom domain (e.g. https://homex.om).
const ALLOWED_ORIGINS = new Set(
  [
    "https://homex-om.vercel.app",
    "https://homex-web.vercel.app",
    ...(process.env.WEBSITE_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]
);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? stripInvisible(v).trim().slice(0, max) : "";

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: cors });

  try {
    // Throttle: max 5 submissions per IP per minute.
    if (!rateLimit(`lead:${clientIp(req)}`, 5, 60_000)) {
      return json({ error: "محاولات كثيرة، حاول بعد قليل" }, 429);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Honeypot: real users never fill this hidden field; bots do.
    if (clean(body.company, 100)) return json({ ok: true }); // silently accept & drop

    const name = clean(body.name, 120);
    if (!name) return json({ error: "الاسم مطلوب" }, 400);

    const phone = normalizePhone(String(body.phone ?? "")).slice(0, 20) || null;
    const message = clean(body.message, 2000) || null;
    if (!phone && !message) {
      return json({ error: "أدخل رقم تواصل أو رسالة" }, 400);
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        governorate: clean(body.governorate, 60) || null,
        wilayat: clean(body.wilayat, 60) || null,
        service: clean(body.service, 60) || null,
        message,
        source: "website",
        status: "new",
      },
      select: { id: true },
    });

    // Alert staff so a hot lead isn't missed.
    await notifyAdmins(
      "طلب جديد من الموقع",
      `${name}${phone ? ` — ${phone}` : ""}${
        body.service ? ` · ${clean(body.service, 60)}` : ""
      }`,
      "info",
      "/leads"
    ).catch(() => {});

    return json({ ok: true, id: lead.id });
  } catch {
    return json({ error: "تعذّر إرسال الطلب، حاول لاحقاً" }, 500);
  }
}
