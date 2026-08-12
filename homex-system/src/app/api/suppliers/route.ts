import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";
import { normalizePhone } from "@/lib/text";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { id: string; role: string };
  if (!(await userCan(user.role, "purchasing"))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
    return NextResponse.json(suppliers);
  } catch (e) {
    console.error("API error [/api/suppliers]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const phone = normalizePhone(String(body.phone || "")).slice(-8);
    if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!phone) return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });
    const supplier = await prisma.supplier.create({
      data: {
        name, phone,
        phoneCode: body.phoneCode || "+968",
        category: body.category || null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (e) {
    console.error("API error [/api/suppliers]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
