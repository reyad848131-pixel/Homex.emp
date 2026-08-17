import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// Real PDF of a quotation, rendered by headless Chromium from the same HTML the
// on-screen PDF page uses. Unlike a browser-side rasteriser, Chromium shapes
// Arabic correctly and keeps the text crisp/selectable. The "Send PDF" action
// fetches this and hands it to the native share sheet (WhatsApp on iPad).
export const runtime = "nodejs";
export const maxDuration = 60;

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

    // Reuse the exact HTML from the print route (same template, one source of truth).
    const origin = req.nextUrl.origin;
    const htmlRes = await fetch(`${origin}/api/quotations/${id}/pdf`, {
      headers: { cookie: req.headers.get("cookie") || "" },
    });
    if (!htmlRes.ok) return NextResponse.json({ error: "Render failed" }, { status: 502 });
    const html = await htmlRes.text();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 900, height: 1200, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // Give webfonts (Cairo) and any images a moment to settle before printing.
    try { await page.evaluateHandle("document.fonts.ready"); } catch { /* ignore */ }
    try { await page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }); } catch { /* ignore */ }
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
    console.error("API error [/api/quotations/[id]/pdf-file]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
