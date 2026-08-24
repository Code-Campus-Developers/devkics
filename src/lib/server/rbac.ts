import type { RoleAssignment, Role } from "@prisma/client";

export type ScopedRole = Lowercase<Role>;

type Scope = {
  cityId?: string | null;
  countryCode?: string | null;
  tournament?: string | null;
  teamScope?: string | null;
};

export function normalizeRole(role: Role): ScopedRole {
  return role.toLowerCase() as ScopedRole;
}

export function hasScopedRole(
  assignments: Pick<
    RoleAssignment,
    "role" | "cityId" | "countryCode" | "tournament" | "teamScope"
  >[],
  role: Role,
  scope?: Scope,
) {
  return assignments.some((assignment) => {
    if (assignment.role !== role) return false;
    if (!scope) return true;
    if (scope.cityId && assignment.cityId !== scope.cityId) return false;
    if (scope.countryCode && assignment.countryCode !== scope.countryCode) return false;
    if (scope.tournament && assignment.tournament !== scope.tournament) return false;
    if (scope.teamScope && assignment.teamScope !== scope.teamScope) return false;
    return true;
  });
}

export function requireScopedRole(
  assignments: Pick<
    RoleAssignment,
    "role" | "cityId" | "countryCode" | "tournament" | "teamScope"
  >[],
  role: Role,
  scope?: Scope,
) {
  if (!hasScopedRole(assignments, role, scope)) {
    throw new Error("Forbidden");
  }
}
