import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getSettings, setSetting } from "@/lib/settings";
import { getAllRoles, getRolePermissions, PERMISSIONS, SYSTEM_ROLES, CUSTOM_ROLES_KEY, type RoleDef, type Permission } from "@/lib/permissions";

// Only users whose role grants the "employees" permission may manage roles.
async function canManage(role: string): Promise<boolean> {
  return (await getRolePermissions(role)).includes("employees");
}

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canManage(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ roles: await getAllRoles(), permissions: PERMISSIONS });
  } catch (e) {
    console.error("API error [/api/roles]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canManage(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.trim() : "";
    let key = typeof body.key === "string" ? body.key.trim() : "";
    const permissions: Permission[] = (Array.isArray(body.permissions) ? body.permissions : []).filter(
      (p: string): p is Permission => (PERMISSIONS as readonly string[]).includes(p)
    );
    if (!label) return NextResponse.json({ error: "اسم الرتبة مطلوب" }, { status: 400 });

    // Derive a stable key from the label for new roles; never touch system keys.
    if (!key) key = "role_" + Date.now().toString(36);
    if (SYSTEM_ROLES.some((r) => r.key === key)) {
      return NextResponse.json({ error: "لا يمكن تعديل رتبة النظام" }, { status: 400 });
    }

    const s = await getSettings();
    let custom: RoleDef[] = [];
    try { custom = s[CUSTOM_ROLES_KEY] ? JSON.parse(s[CUSTOM_ROLES_KEY]) : []; } catch { custom = []; }

    const idx = custom.findIndex((r) => r.key === key);
    const entry: RoleDef = { key, label, permissions };
    if (idx >= 0) custom[idx] = entry;
    else custom.push(entry);

    await setSetting(CUSTOM_ROLES_KEY, JSON.stringify(custom));
    await logAction(user.id, idx >= 0 ? "update" : "create", "role", key, JSON.stringify({ label, permissions }));
    return NextResponse.json({ role: entry });
  } catch (e) {
    console.error("API error [/api/roles POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canManage(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const key = new URL(req.url).searchParams.get("key") || "";
    if (SYSTEM_ROLES.some((r) => r.key === key)) {
      return NextResponse.json({ error: "لا يمكن حذف رتبة النظام" }, { status: 400 });
    }

    // Block deletion while employees still hold the role.
    const inUse = await prisma.employee.count({ where: { role: key } });
    if (inUse > 0) {
      return NextResponse.json({ error: `الرتبة مستخدمة من ${inUse} موظف — غيّر رتبتهم أولاً`, code: "in_use" }, { status: 409 });
    }

    const s = await getSettings();
    let custom: RoleDef[] = [];
    try { custom = s[CUSTOM_ROLES_KEY] ? JSON.parse(s[CUSTOM_ROLES_KEY]) : []; } catch { custom = []; }
    custom = custom.filter((r) => r.key !== key);
    await setSetting(CUSTOM_ROLES_KEY, JSON.stringify(custom));
    await logAction(user.id, "delete", "role", key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/roles DELETE]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
