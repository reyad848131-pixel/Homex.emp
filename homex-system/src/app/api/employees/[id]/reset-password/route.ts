import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { normalizeCredential } from "@/lib/text";
import bcrypt from "bcryptjs";

// Admin-only single-employee password reset: sets the password to the default
// scheme "Homex" + civil ID, clears any lockout/failed-attempt state, and
// returns the new password so the admin can hand it to that one employee — a
// safe, one-click recovery for the common "he can't log in" case.
export async function POST(
  _req: NextRequest,
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
    const emp = await prisma.employee.findFirst({ where: { id }, select: { id: true, name: true, civilId: true } });
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const password = `Homex${emp.civilId}`;
    const hashed = await bcrypt.hash(normalizeCredential(password), 10);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { password: hashed, failedAttempts: 0, lockedUntil: null },
    });

    await logAction(user.id, "reset_password", "employee", emp.id, `reset for ${emp.name}`);
    return NextResponse.json({ name: emp.name, civilId: emp.civilId, password });
  } catch (e) {
    console.error("API error [/api/employees/[id]/reset-password]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
