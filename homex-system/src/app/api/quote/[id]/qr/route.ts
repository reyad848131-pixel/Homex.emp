import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The project's unified barcode as a PNG image, so it can be shown on-screen
// (foreman quote card, item details) and scanned straight off the display —
// no need to open the print view just to see it. Encodes "quote:<id>", which
// the in-app scanner resolves to the project page. Any signed-in user may view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  try {
    const png = await QRCode.toBuffer(`quote:${id}`, { margin: 1, width: 320, color: { dark: "#3d3d3d", light: "#ffffff" } });
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
    });
  } catch (e) {
    console.error("API error [/api/quote/[id]/qr]:", e);
    return new NextResponse("error", { status: 500 });
  }
}
