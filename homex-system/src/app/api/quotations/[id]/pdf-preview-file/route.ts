import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { GET as renderPreviewHtml } from "../pdf-preview/route";

// PREVIEW ONLY: a real Chromium-rendered PDF of the redesigned quotation, so
// the fixed watermark repeats centred on EVERY page (browser print on iOS does
// not repeat fixed elements; headless Chromium does).
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

chromium.setGraphicsMode = false;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: { id },
      select: { id: true, quoteNumber: true, employee: { select: { id: true } }, customer: { select: { name: true } } },
    });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "sales" && quotation.employee.id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const htmlRes = await renderPreviewHtml(req, { params: Promise.resolve({ id }) });
    if (!htmlRes.ok) return NextResponse.json({ error: "Render failed" }, { status: 502 });
    const html = await htmlRes.text();

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
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("API error [/api/quotations/[id]/pdf-preview-file]:", e);
    return NextResponse.json({ error: "Server error", detail: (e as Error)?.message || String(e) }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
