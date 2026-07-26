import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

// Admin-only one-click reset: sets every OTHER employee's password to the
// default scheme "Homex" + their civil ID (e.g. Homex1383). The acting admin
// is excluded so they can't lock themselves out. Returns the resulting
// credentials so the admin can hand them out.
export async function POST() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      where: { id: { not: user.id } },
      select: { id: true, name: true, civilId: true },
      orderBy: { createdAt: "asc" },
    });

    const results: Array<{ name: string; civilId: string; password: string }> = [];
    for (const emp of employees) {
      const password = `Homex${emp.civilId}`;
      const hashed = await bcrypt.hash(password, 10);
      await prisma.employee.update({
        where: { id: emp.id },
        // Also clear any lockout/failed-attempt state so they can log in now.
        data: { password: hashed, failedAttempts: 0, lockedUntil: null },
      });
      results.push({ name: emp.name, civilId: emp.civilId, password });
    }

    await logAction(user.id, "reset_passwords", "employee", "bulk", `count=${results.length}`);
    return NextResponse.json({ count: results.length, employees: results });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
