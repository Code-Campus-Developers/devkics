# DevKics — Where Tech Comes to Play

DevKics is the global football platform for technology communities — engineers, designers, founders, product managers, and tech companies — organized city-by-city under a single digital platform. Founded and governed by **Code Campus International**, with Abuja running as the pilot tournament city.

The platform provides approved local organizers with tournament infrastructure — registration, squad vetting, fixtures, live scoring, standings, volunteer operations, sponsors, announcements, and media — while maintaining centralized brand, role-based access control (RBAC), and governance standards.

---

## Architecture & Tech Stack

- **Frontend & Full-Stack SSR:** [TanStack Start](https://tanstack.com/start) (React 19, Vite, TanStack Router with file-based routing)
- **Styling & UI:** Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com) primitives (Radix UI), Lucide icons
- **State & Data Hydration:** `@tanstack/react-query`
- **Database & ORM:** PostgreSQL 16 with [Prisma 7](https://www.prisma.io/) (`@prisma/client`, `@prisma/adapter-pg`)
- **Authentication & RBAC:** Secure HTTP-only cookie JWT auth (`jose`, `bcryptjs`) with scoped roles (`ADMIN`, `ORGANIZER`, `MANAGER`, `PLAYER`)
- **Testing:** Vitest (unit & integration) + Playwright (cross-browser E2E)
- **Containerization:** Multi-stage Dockerfile (`oven/bun:1.4`) and Docker Compose

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- PostgreSQL 16+ (or Docker)

### 1. Clone & Install

```bash
git clone https://github.com/Code-Campus-Developers/devkics.git
cd devkics
bun install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable                  | Description                             | Default / Example                                                     |
| :------------------------ | :-------------------------------------- | :-------------------------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string            | `postgresql://postgres:postgres@localhost:5432/devkics?schema=public` |
| `JWT_ACCESS_SECRET`       | Secret key for signing session tokens   | Secure random string (min 32 chars)                                   |
| `JWT_REFRESH_SECRET`      | Secret key for refresh tokens           | Secure random string (min 32 chars)                                   |
| `ACCESS_TOKEN_TTL`        | Access token lifespan                   | `15m`                                                                 |
| `REFRESH_TOKEN_TTL`       | Refresh token lifespan                  | `7d`                                                                  |
| `RESEND_API_KEY`          | Resend API key for transactional emails | `re_...` (optional for local dev)                                     |
| `RESEND_FROM_EMAIL`       | Verified sender email                   | `DevKics <notifications@your-domain.example>`                         |
| `SUPABASE_URL`            | Supabase project URL (media storage)    | `https://your-project.supabase.co` (optional)                         |
| `SUPABASE_SECRET_KEY`     | Supabase service-role secret key        | `your-supabase-service-role-key` (optional)                           |
| `SUPABASE_GALLERY_BUCKET` | Supabase storage bucket name            | `devkics-gallery`                                                     |
| `POSTGRES_DB`             | Docker PostgreSQL database name         | `devkics`                                                             |
| `POSTGRES_USER`           | Docker PostgreSQL user                  | `devkics`                                                             |
| `POSTGRES_PASSWORD`       | Docker PostgreSQL password              | `devkics`                                                             |

### 3. Database Setup & Seed

```bash
# Generate Prisma Client
bun run prisma:generate

# Apply migrations
bun run prisma:deploy

# Seed initial tournament data (Abuja pilot city, teams, fixtures, and demo users)
bun run prisma:seed
```

### 4. Run Development Server

```bash
bun run dev
```

Open `http://localhost:8080` in your browser.

---

## Docker Workflow

A production-like multi-container environment (App + PostgreSQL) is provided via Docker Compose:

```bash
# Build and start services in the background
bun run docker:up

# Follow live container logs
bun run docker:logs

# Stop services and preserve persistent database volume
bun run docker:down
```

The app container runs on port `8080` and depends on PostgreSQL passing healthy connectivity checks before starting.

---

## Database & Migrations

```bash
bun run prisma:generate     # Generate Prisma client bindings
bun run prisma:validate     # Validate schema integrity
bun run prisma:deploy       # Deploy pending migrations
bun run prisma:seed         # Seed database
bun run db:reset            # Force reset migrations (wipes data)
```

---

## Testing & Quality Gates

```bash
# Unit tests
bun run test:unit

# Integration tests (API endpoints, RBAC, legal gating, rate limits)
bun run test:integration

# Full Vitest suite
bun run test

# End-to-end suite (Playwright)
bun run e2e

# TypeScript verification
bun run typecheck

# Code formatting & linting
bun run lint
bun run format
```

---

## Production Build & Deployment

```bash
# Build standalone production artifacts
bun run build

# Preview production build locally
bun run preview
```

### Containerized Deployment

The multi-stage `Dockerfile` packages the Bun-based SSR server into an optimized runtime:

```bash
docker build -t devkics-app .
docker run -p 8080:8080 --env-file .env devkics-app
```

For production deployments, execute `bun run prisma:deploy` during the deployment pipeline before routing traffic.

---

## Project Structure

```
├── prisma/               # Prisma schema, migrations, and database seed
├── public/               # Static assets (favicons, manifest, robots.txt)
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── dashboards/   # Role-based dashboards (Admin, Organizer, Manager, Player)
│   │   ├── devkics/      # DevKics brand, match components, and layout shell
│   │   └── ui/           # shadcn/ui primitive components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions, client store, and server logic
│   │   ├── devkics/      # Client state, types, standings calculator
│   │   └── server/       # Database, auth, RBAC, API handlers, emails
│   ├── routes/           # TanStack Router file-based routes
│   ├── styles.css        # Tailwind CSS styles and custom brand tokens
│   └── server.ts         # Nitro SSR server entry point
├── tests/
│   ├── e2e/              # Playwright end-to-end specs
│   ├── integration/      # Vitest API integration tests
│   └── unit/             # Vitest unit tests
└── Docs/                 # Concept Note, PRD, and Implementation Roadmap
```

---

## Governance & Documentation

- [Docs/DevKics Global Concept Note.pdf](Docs/DevKics%20Global%20Concept%20Note.pdf) — Platform philosophy, mission, and international governance
- [Docs/DevKics Product Requirements Document.pdf](Docs/DevKics%20Product%20Requirements%20Document.pdf) — Complete functional and non-functional specifications
- [Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md](Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md) — Phased implementation roadmap
