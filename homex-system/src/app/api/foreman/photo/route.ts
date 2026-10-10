import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { uploadPhoto, deletePhoto, cloudinaryReady } from "@/lib/cloudinary";

export const runtime = "nodejs";

const KINDS = ["design", "result"];

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) return { error: NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 }) };
  return { user };
}

// Upload (or replace) one of an item's two photos. { quoteItemId, kind, dataUrl }
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    if (!cloudinaryReady()) {
      return NextResponse.json({ error: "لم يتم ربط Cloudinary بعد — أضف المفاتيح في Vercel", code: "no_storage" }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const quoteItemId = String(body.quoteItemId || "");
    const kind = String(body.kind || "");
    const dataUrl = String(body.dataUrl || "");
    if (!quoteItemId || !KINDS.includes(kind) || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    // Guard against oversized payloads (base64 ~1.37x raw) — ~8MB base64 cap.
    if (dataUrl.length > 8 * 1024 * 1024) return NextResponse.json({ error: "حجم الصورة كبير جداً" }, { status: 413 });

    const item = await prisma.quoteItem.findUnique({ where: { id: quoteItemId }, select: { id: true } });
    if (!item) return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });

    const existing = await prisma.itemPhoto.findUnique({ where: { quoteItemId_kind: { quoteItemId, kind } } });
    const { url, publicId } = await uploadPhoto(dataUrl);
    if (existing) await deletePhoto(existing.publicId); // remove the old file

    const saved = await prisma.itemPhoto.upsert({
      where: { quoteItemId_kind: { quoteItemId, kind } },
      update: { url, publicId, uploadedBy: (g.user as any).id },
      create: { quoteItemId, kind, url, publicId, uploadedBy: (g.user as any).id },
    });
    return NextResponse.json({ id: saved.id, kind, url });
  } catch (e) {
    console.error("API error [/api/foreman/photo POST]:", e);
    return NextResponse.json({ error: "تعذّر رفع الصورة" }, { status: 500 });
  }
}

// Delete one photo. ?id=
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const photo = await prisma.itemPhoto.findUnique({ where: { id } });
    if (photo) {
      await deletePhoto(photo.publicId);
      await prisma.itemPhoto.delete({ where: { id } });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("API error [/api/foreman/photo DELETE]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
