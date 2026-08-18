import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { buildQuotationPdfHtml } from "../../../../quotations/[id]/pdf/route";

// Public (token-gated, no login) real PDF of a shared quotation, so the
// customer can download the official document straight from the accept/sign
// page. Same headless-Chromium pipeline and the exact same brand design as the
// authenticated PDF — it just renders without the on-screen toolbar.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

chromium.setGraphicsMode = false;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const { token } = await params;
    // Throttle: rendering spins up Chromium, so cap public hits per client/token.
    if (!rateLimit(`quote-pdf:${clientIp(req)}:${token}`, 20, 60_000)) {
      return NextResponse.json({ error: "محاولات كثيرة، حاول لاحقاً" }, { status: 429 });
    }

    const quotation = await prisma.quotation.findFirst({
      where: { publicToken: token },
      include: {
        customer: true,
        employee: { select: { id: true, name: true } },
        items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const s = await getSettings();
    const html = await buildQuotationPdfHtml(quotation, s); // no on-screen toolbar

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    try { await page.evaluateHandle("document.fonts.ready"); } catch { /* ignore */ }
    try { await page.waitForNetworkIdle({ idleTime: 400, timeout: 6000 }); } catch { /* ignore */ }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
    await browser.close();
    browser = null;

    const name = `${quotation.quoteNumber} - ${quotation.customer?.name || ""}`.trim().replace(/[\\/:*?"<>|]/g, " ");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("API error [/api/public/quote/[token]/pdf-file]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
