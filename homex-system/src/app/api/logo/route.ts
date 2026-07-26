import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

const MAX_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logo = await getSetting("company_logo", "");
    return NextResponse.json({ logo });
  } catch (e) {
    console.error("API error [/api/logo]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف كبير جداً. الحد الأقصى 500KB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    await setSetting("company_logo", base64);
    return NextResponse.json({ logo: base64 });
  } catch (e) {
    console.error("API error [/api/logo]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    await setSetting("company_logo", "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/logo]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
