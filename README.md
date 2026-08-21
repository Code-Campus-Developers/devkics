# DevKics

**Where Tech Comes to Play**

DevKics is a global, community-led football platform for technology communities — engineers, designers, founders, students, startups, and tech companies — organized city by city under a single digital platform. It is founded and owned by **Code Campus International**, with Abuja running as the pilot city.

Football is the medium; community is the outcome. DevKics gives approved local volunteers everything they need to run an official DevKics tournament in their city — registration, team and player management, fixtures, live scores, standings, sponsors, volunteers, media and reporting — while the central DevKics organization maintains brand, governance, and platform standards across every city.

## Purpose

This repository contains the DevKics web platform: a multi-city tournament and community management product with a dedicated portal per city (e.g. `/abuja`, `/lagos`, `/london`) sitting under one global site. The product requirements are defined in full in [`Docs/DevKics Global Concept Note.pdf`](Docs/DevKics%20Global%20Concept%20Note.pdf) and [`Docs/DevKics Product Requirements Document.pdf`](Docs/DevKics%20Product%20Requirements%20Document.pdf).

## Current status: MVP frontend prototype

This codebase is a working, clickable **frontend MVP prototype** built against local/mock data, covering:

**Public**
Home · Find a City · City Portal (Abuja) · Tournament Overview · Teams · Players · Fixtures · Results · Standings · Sponsors · News/Announcements · Media/Gallery · Volunteer Application · Become a City Organizer · Login/Register

**Authenticated dashboards**
Global Admin · City Organizer · Team Manager · Player

Core flows work end-to-end against local state: find Abuja → tournament → teams → fixtures → standings; register/login → role-based dashboard; team manager creates a team and adds players; organizer manages fixtures, results and applications; match results update standings immediately.

The frontend has undergone a full audit against the Concept Note and PRD. The path from this prototype to a production-ready MVP (real backend, database, authentication, RBAC enforcement, and the remaining PRD workflows) is documented in **[Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md](Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md)**, phased as:

1. Foundation — auth, JWT, multi-role RBAC, city management, organizer applications, dashboards
2. Tournament Operations — organizations, teams, players, fixtures, results, standings, brackets
3. Community & Content — volunteers, sponsors, announcements, media, notifications
4. MVP Hardening & Launch — audit logging, reporting, security, accessibility, SEO, production readiness
5. Post-MVP / Future Scale — future work explicitly identified in the PRD, out of MVP scope

## Tech stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19, file-based routing via TanStack Router)
- **Language:** TypeScript (strict mode)
- **Styling/UI:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
- **Data (prototype stage):** local seed data and React Context (`src/lib/devkics/store.tsx`), persisted to `localStorage`; `@tanstack/react-query` is already wired in for the API integration phase
- **Package manager:** [Bun](https://bun.sh)
- **Build tool:** Vite

## Project structure

```
src/
  routes/            File-based routes (TanStack Router) — public pages + /$city/* portal pages
  components/
    devkics/          DevKics-specific UI (brand, site shell, match/standings, application form)
    dashboards/        Role dashboards (admin, organizer, manager, player)
    ui/                shadcn/ui primitives
  lib/devkics/         Mock data (seed.ts), types (types.ts), and the state/service layer (store.tsx)
Docs/                  Concept Note, PRD, and implementation roadmap
```

## Local setup

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/Code-Campus-Developers/devkics.git
cd devkics
bun install
bun run dev
```

The app runs at `http://localhost:8080`.

### Other scripts

```sh
bun run build       # production build
bun run preview     # preview a production build
bun run lint        # eslint
bun run format      # prettier --write
```

## Documentation

- [Docs/DevKics Global Concept Note.pdf](Docs/DevKics%20Global%20Concept%20Note.pdf) — vision, mission, platform philosophy, governance
- [Docs/DevKics Product Requirements Document.pdf](Docs/DevKics%20Product%20Requirements%20Document.pdf) — full functional and non-functional requirements
- [Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md](Docs/DEVKICS_IMPLEMENTATION_ROADMAP.md) — phased plan from this prototype to a launched MVP
