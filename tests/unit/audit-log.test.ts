import { describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "@/lib/server/audit-log";

describe("writeAuditLog", () => {
  it("persists actor, resource scope, and before/after snapshots", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });

    await writeAuditLog({ auditLog: { create } } as never, {
      actorId: "user-1",
      action: "team.reviewed",
      resourceType: "team",
      resourceId: "team-1",
      cityId: "city-1",
      oldValue: { status: "SUBMITTED" },
      newValue: { status: "APPROVED" },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "team.reviewed",
        resourceType: "team",
        resourceId: "team-1",
        cityId: "city-1",
        oldValue: { status: "SUBMITTED" },
        newValue: { status: "APPROVED" },
      },
    });
  });
});
