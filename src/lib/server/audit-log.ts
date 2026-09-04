import type { Prisma, PrismaClient } from "@prisma/client";

type AuditValue = Prisma.InputJsonObject;

type AuditLogInput = {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  cityId?: string | null;
  oldValue?: AuditValue;
  newValue?: AuditValue;
};

export function writeAuditLog(prisma: Pick<PrismaClient, "auditLog">, input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      cityId: input.cityId ?? null,
      ...(input.oldValue === undefined ? {} : { oldValue: input.oldValue }),
      ...(input.newValue === undefined ? {} : { newValue: input.newValue }),
    },
  });
}
