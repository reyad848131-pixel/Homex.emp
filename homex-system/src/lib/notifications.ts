import { prisma } from "@/lib/prisma";

export async function notify(
  employeeId: string,
  title: string,
  message: string,
  type: string = "info",
  link?: string
) {
  return prisma.notification.create({
    data: { employeeId, title, message, type, link },
  });
}

export async function notifyAdmins(title: string, message: string, type: string = "info", link?: string) {
  const admins = await prisma.employee.findMany({
    where: { role: { in: ["admin", "manager"] }, isActive: true },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: admins.map((a) => ({ employeeId: a.id, title, message, type, link })),
  });
}
