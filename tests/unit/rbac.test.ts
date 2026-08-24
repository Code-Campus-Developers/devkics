import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hasScopedRole } from "@/lib/server/rbac";

describe("hasScopedRole", () => {
  it("returns true when role matches globally", () => {
    const result = hasScopedRole(
      [{ role: Role.ADMIN, cityId: null, countryCode: null, tournament: null, teamScope: null }],
      Role.ADMIN,
    );

    expect(result).toBe(true);
  });

  it("enforces city scope when provided", () => {
    const assignments = [
      {
        role: Role.ORGANIZER,
        cityId: "city-1",
        countryCode: "NG",
        tournament: null,
        teamScope: null,
      },
    ];

    expect(hasScopedRole(assignments, Role.ORGANIZER, { cityId: "city-1" })).toBe(true);
    expect(hasScopedRole(assignments, Role.ORGANIZER, { cityId: "city-2" })).toBe(false);
  });
});
