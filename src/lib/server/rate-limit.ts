type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Counter>();

function pruneExpired(now: number) {
  if (buckets.size < 5_000) return;

  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  return "unknown";
}

export function applyRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  pruneExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const next: Counter = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    buckets.set(key, next);
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt: next.resetAt,
    };
  }

  existing.count += 1;
  const remaining = Math.max(options.limit - existing.count, 0);
  return {
    allowed: existing.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: existing.resetAt,
  };
}

export function toRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const resetInSeconds = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 0);
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(resetInSeconds),
  };
}
