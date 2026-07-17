import { prisma } from "./prisma";

export async function logAction(
  employeeId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  await prisma.auditLog.create({
    data: { employeeId, action, entity, entityId, details },
  });
}
