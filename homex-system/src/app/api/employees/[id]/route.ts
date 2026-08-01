import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { parseBody, employeeUpdateSchema } from "@/lib/schemas";
import { getAllRoles } from "@/lib/permissions";
import { normalizeDigits } from "@/lib/login-guard";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const parsed = parseBody(employeeUpdateSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    const body = parsed.data;

    const target = await prisma.employee.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.role !== undefined) {
      const roles = await getAllRoles();
      const roleDef = roles.find((r) => r.key === body.role);
      if (!roleDef) {
        return NextResponse.json({ error: "رتبة غير معروفة", code: "invalid" }, { status: 400 });
      }
      // A singleton role (e.g. CEO) may be held by only one employee — allow it
      // only if no *other* employee already has it.
      if (roleDef.singleton) {
        const others = await prisma.employee.count({ where: { role: body.role, id: { not: id } } });
        if (others > 0) {
          return NextResponse.json({ error: `رتبة "${roleDef.label}" مخصّصة لشخص واحد فقط`, code: "singleton" }, { status: 409 });
        }
      }
    }

    const demoting = body.role !== undefined && body.role !== "admin";
    const deactivating = body.isActive === false;

    // An admin cannot demote or deactivate their own account (self-lockout).
    if (id === user.id && (demoting || deactivating)) {
      return NextResponse.json(
        { error: "لا يمكنك تخفيض دورك أو تعطيل حسابك", code: "self_lock" },
        { status: 400 }
      );
    }

    // Never remove the last active admin from the system.
    if (target.role === "admin" && (demoting || deactivating)) {
      const activeAdmins = await prisma.employee.count({
        where: { role: "admin", isActive: true },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "لا يمكن تعطيل أو تخفيض آخر مدير في النظام", code: "last_admin" },
          { status: 400 }
        );
      }
    }

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.phoneCode !== undefined) data.phoneCode = body.phoneCode;
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.password = await bcrypt.hash(normalizeDigits(String(body.password).trim()), 10);

    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: { id: true, name: true, civilId: true, phone: true, phoneCode: true, role: true, isActive: true },
    });

    await logAction(user.id, "update", "employee", id, JSON.stringify(body.password ? { ...body, password: "[changed]" } : body));
    return NextResponse.json(employee);
  } catch (e) {
    console.error("API error [/api/employees/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
