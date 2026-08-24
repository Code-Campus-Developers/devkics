import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Role, type RoleAssignment, type User } from "@prisma/client";
import { SignJWT, errors, jwtVerify } from "jose";

import { prisma } from "./db";
import { getEnv } from "./env";
import { normalizeRole } from "./rbac";

type AuthCookies = {
  access?: string;
  refresh?: string;
};

type AccessPayload = {
  sub: string;
  sid: string;
  activeRole: Lowercase<Role>;
  roles: Array<{ role: Lowercase<Role>; cityId: string | null }>;
};

type RefreshPayload = {
  sub: string;
  sid: string;
  jti: string;
};

const ACCESS_COOKIE = "devkics_access";
const REFRESH_COOKIE = "devkics_refresh";

function parseDurationSeconds(input: string): number {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return value;
  if (unit === "m") return value * 60;
  if (unit === "h") return value * 3600;
  return value * 86400;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getSecrets() {
  const env = getEnv();
  return {
    accessKey: new TextEncoder().encode(env.JWT_ACCESS_SECRET),
    refreshKey: new TextEncoder().encode(env.JWT_REFRESH_SECRET),
    accessTtl: parseDurationSeconds(env.ACCESS_TOKEN_TTL),
    refreshTtl: parseDurationSeconds(env.REFRESH_TOKEN_TTL),
  };
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookie(name: string) {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function parseCookies(request: Request): AuthCookies {
  const raw = request.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((part) => part.trim());
  const out: AuthCookies = {};
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx);
    const value = decodeURIComponent(part.slice(idx + 1));
    if (key === ACCESS_COOKIE) out.access = value;
    if (key === REFRESH_COOKIE) out.refresh = value;
  }
  return out;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function mapAssignments(assignments: RoleAssignment[]) {
  return assignments.map((assignment) => ({
    role: normalizeRole(assignment.role),
    cityId: assignment.cityId,
  }));
}

function pickActiveRole(assignments: RoleAssignment[]) {
  return normalizeRole(assignments[0]?.role ?? Role.PLAYER);
}

export function toPublicUser(user: User, assignments: RoleAssignment[]) {
  const activeRole = pickActiveRole(assignments);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    citySlug: user.citySlug,
    teamId: user.teamId,
    playerId: user.playerId,
    role: activeRole,
    activeRole,
    roles: mapAssignments(assignments),
  };
}

export async function issueSession(user: User, assignments: RoleAssignment[]) {
  const { accessKey, refreshKey, accessTtl, refreshTtl } = getSecrets();
  const sessionId = randomUUID();
  const refreshJti = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const accessPayload: AccessPayload = {
    sub: user.id,
    sid: sessionId,
    activeRole: pickActiveRole(assignments),
    roles: mapAssignments(assignments),
  };

  const accessToken = await new SignJWT(accessPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + accessTtl)
    .sign(accessKey);

  const refreshPayload: RefreshPayload = {
    sub: user.id,
    sid: sessionId,
    jti: refreshJti,
  };

  const refreshToken = await new SignJWT(refreshPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + refreshTtl)
    .sign(refreshKey);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshJti,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: new Date((now + refreshTtl) * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    accessCookie: serializeCookie(ACCESS_COOKIE, accessToken, accessTtl),
    refreshCookie: serializeCookie(REFRESH_COOKIE, refreshToken, refreshTtl),
  };
}

export function clearSessionCookies() {
  return [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE)];
}

async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { accessKey } = getSecrets();
    const verified = await jwtVerify(token, accessKey);
    return verified.payload as unknown as AccessPayload;
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return null;
    }
    return null;
  }
}

async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { refreshKey } = getSecrets();
    const verified = await jwtVerify(token, refreshKey);
    return verified.payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

export async function revokeSessionByRefreshToken(refreshToken: string) {
  const refreshPayload = await verifyRefreshToken(refreshToken);
  if (!refreshPayload) return;

  await prisma.session.updateMany({
    where: { id: refreshPayload.sid, userId: refreshPayload.sub, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const cookies = parseCookies(request);
  if (!cookies.access && !cookies.refresh) {
    return { user: null, assignments: [], headers: [] as string[] };
  }

  const access = cookies.access ? await verifyAccessToken(cookies.access) : null;
  if (access) {
    const user = await prisma.user.findUnique({ where: { id: access.sub } });
    if (!user) return { user: null, assignments: [], headers: [] as string[] };
    const assignments = await prisma.roleAssignment.findMany({ where: { userId: user.id } });
    return { user, assignments, headers: [] as string[] };
  }

  if (!cookies.refresh) {
    return { user: null, assignments: [], headers: clearSessionCookies() };
  }

  const refreshPayload = await verifyRefreshToken(cookies.refresh);
  if (!refreshPayload) {
    return { user: null, assignments: [], headers: clearSessionCookies() };
  }

  const session = await prisma.session.findUnique({ where: { id: refreshPayload.sid } });
  if (
    !session ||
    session.userId !== refreshPayload.sub ||
    session.refreshJti !== refreshPayload.jti ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.refreshTokenHash !== sha256(cookies.refresh)
  ) {
    return { user: null, assignments: [], headers: clearSessionCookies() };
  }

  const user = await prisma.user.findUnique({ where: { id: refreshPayload.sub } });
  if (!user) {
    return { user: null, assignments: [], headers: clearSessionCookies() };
  }
  const assignments = await prisma.roleAssignment.findMany({ where: { userId: user.id } });

  const issued = await issueSession(user, assignments);
  await prisma.session.updateMany({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return {
    user,
    assignments,
    headers: [issued.accessCookie, issued.refreshCookie],
  };
}
