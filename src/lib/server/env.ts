export function getEnv() {
  const requiredEnv = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    DATABASE_URL: process.env["DATABASE_URL"] as string,
    JWT_ACCESS_SECRET: process.env["JWT_ACCESS_SECRET"] as string,
    JWT_REFRESH_SECRET: process.env["JWT_REFRESH_SECRET"] as string,
    ACCESS_TOKEN_TTL: process.env["ACCESS_TOKEN_TTL"] ?? "15m",
    REFRESH_TOKEN_TTL: process.env["REFRESH_TOKEN_TTL"] ?? "7d",
  };
}
