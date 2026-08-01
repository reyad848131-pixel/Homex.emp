import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { parseBody, employeeCreateSchema } from "@/lib/schemas";
import { getAllRoles } from "@/lib/permissions";
import { normalizeCredential } from "@/lib/login-guard";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      select: {
        id: true, name: true, civilId: true, phone: true, phoneCode: true,
        role: true, isActive: true, createdAt: true,
        _count: { select: { quotations: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(employees);
  } catch (e) {
    console.error("API error [/api/employees]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const parsed = parseBody(employeeCreateSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    const { name, phone, phoneCode, role } = parsed.data;
    // Fold Arabic-Indic digits to ASCII so a civil ID / password entered on an
    // Arabic keyboard is stored the same way it will be typed at login.
    const civilId = normalizeCredential(parsed.data.civilId);
    const password = normalizeCredential(parsed.data.password);

    const roles = await getAllRoles();
    const roleDef = roles.find((r) => r.key === role);
    if (!roleDef) {
      return NextResponse.json({ error: "رتبة غير معروفة", code: "invalid" }, { status: 400 });
    }
    // A singleton role (e.g. CEO) may be held by only one employee.
    if (roleDef.singleton && (await prisma.employee.count({ where: { role } })) > 0) {
      return NextResponse.json({ error: `رتبة "${roleDef.label}" مخصّصة لشخص واحد فقط`, code: "singleton" }, { status: 409 });
    }

    const existing = await prisma.employee.findUnique({ where: { civilId } });
    if (existing) {
      return NextResponse.json({ error: "Civil ID already exists" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({
      data: { name, civilId, phone: phone || null, phoneCode: phoneCode || "+968", role, password: hashedPassword },
      select: { id: true, name: true, civilId: true, phone: true, phoneCode: true, role: true, isActive: true },
    });

    await logAction(user.id, "create", "employee", employee.id, JSON.stringify({ name, civilId, role }));
    return NextResponse.json(employee, { status: 201 });
  } catch (e) {
    console.error("API error [/api/employees]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
