FROM oven/bun:1.4 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=postgresql://devkics:devkics@localhost:5432/devkics?schema=public bun run prisma:generate

FROM deps AS build
COPY . .
# Cloudflare's default nitro preset emits a WASM import shape the Bun runtime can't instantiate.
RUN NITRO_PRESET=bun bun run build

FROM deps AS development
COPY . .
EXPOSE 8080
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/.output ./.output
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
CMD ["sh", "-c", "bun run prisma:deploy && bun .output/server/index.mjs"]
