import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const civilId = req.nextUrl.searchParams.get("id") || "2016";
    const password = req.nextUrl.searchParams.get("pw") || "2016";

    const employee = await prisma.employee.findUnique({
      where: { civilId },
      select: { id: true, name: true, civilId: true, role: true, password: true, isActive: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found", civilId });
    }

    const valid = await bcrypt.compare(password, employee.password);

    return NextResponse.json({
      found: true,
      name: employee.name,
      role: employee.role,
      isActive: employee.isActive,
      passwordMatch: valid,
      hashPreview: employee.password.substring(0, 10) + "...",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
