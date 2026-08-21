# DevKics MVP Implementation Roadmap

Derived from `Docs/DevKics Global Concept Note.pdf`, `Docs/DevKics Product Requirements Document.pdf`, and the completed frontend audit. This document is planning only — no implementation is included or authorized by it.

---

## Phase 1 — Foundation

**Objective:** Stand up the real backend/database, authentication, multi-role RBAC, city management, and organizer-application lifecycle; replace the mock `store.tsx` context with API-backed data access; ship functioning Admin/Organizer/Manager/Player dashboards against real data.

**Key work**

- _Backend/DB:_ Provision Postgres + Prisma schema for `User, Role, Permission, Country, City, CityApplication, CityOrganizer, AuditLog` (PRD §11). JWT auth (access + refresh tokens), password hashing, email verification, password reset. Role/permission model must support **multiple roles per user, scoped by city/team/tournament** (PRD §9.2) — not the single-scalar `role` field currently in `types.ts`.
- _Backend:_ City CRUD + approve/suspend/archive/publish endpoints; City Organizer Application endpoints with full status machine (Draft/Submitted/Under Review/More Info Required/Approved/Rejected/Suspended/Withdrawn — PRD §9.4), file uploads (city banner), admin review notes, email notifications on status change.
- _Frontend:_ Replace `DevKicsProvider`/`localStorage` state with `react-query` (already mounted in `src/routes/__root.tsx` but unused) for all reads; add mutations for auth/city/application actions. Rebuild `/auth` with `zod` + `react-hook-form` (installed, currently unused) for register/login schemas, field errors, password rules. Add `beforeLoad` route guards for `/dashboard` and role-gated sections (extending the pattern already used in `src/routes/$city.tsx` for live-city checks) instead of the current client-only `useEffect` redirect. Rebuild Admin/Organizer dashboards (`src/components/dashboards/admin.tsx`, `src/components/dashboards/organizer.tsx`) against real city/application data; keep existing UI/layout, swap data source.
- _Security:_ Remove plaintext password handling identified in the audit; session expiration; rate limiting and spam protection on auth/application forms.

**Dependencies:** None (first phase). Blocks all subsequent phases (every later phase needs auth + city context).

**Deliverables**

- Deployed Postgres + Prisma schema, migrated.
- JWT auth (register/login/logout/reset/verify) working end-to-end from `/auth`.
- City creation → application → admin approval → City Lead Organizer assignment flow, fully wired.
- Role/city/tournament-scoped permission checks enforced server-side (not just client-rendered).
- Admin and Organizer dashboards reading live data via `react-query`.

**Mandatory validation gates** _(all required before Phase 2 starts)_

1. Unit tests — auth utils, RBAC permission resolver, city-application state machine.
2. Integration tests — auth endpoints, city application lifecycle, permission enforcement (cross-city access denial).
3. Production build succeeds (frontend + backend).
4. Lint/type checks clean (`eslint`, `tsc`, Prisma schema validate).
5. Real browser smoke test with Playwright: load `/`, `/auth`, `/cities`, `/dashboard`, zero console errors.
6. Relevant Playwright E2E coverage: register → verify → login → city application submit → admin approve → organizer dashboard access; negative test for cross-city access denial.
7. Manual verification of affected flows: token refresh/expiry, password reset email, role-switch behavior for a multi-role test user.
8. No unresolved critical/blocking issues.

---

## Phase 2 — Tournament Operations

**Objective:** Implement the full tournament lifecycle — organizations, teams, players, approvals, fixtures/scheduling, results/match events, standings, knockout brackets, and core statistics — replacing the current hardcoded-Abuja mock logic.

**Key work**

- _DB/Backend:_ Add missing entities per PRD §11: `Organization` (currently absent — audit gap), `Tournament` (Draft/Registration Open/Closed/Fixtures Published/Ongoing/Completed/Postponed/Cancelled/Archived — PRD §9.5), `Team` with approval workflow (approve/reject/request changes/suspend/disqualify/lock squad — §9.7), `Player` with full registration fields (DOB, gender, emergency contact, medical declaration, waiver acceptance, statuses Invited/Registration Incomplete/Pending Approval/Approved/Suspended/Withdrawn/Disqualified — §9.8), `Fixture`, `Match`, `MatchEvent`, `Group`, `Standing`, `KnockoutRound`, `Award`.
- _Backend:_ Fixture generation (manual + automatic group/round-robin/knockout), standings computation service (move `computeStandings` logic server-side, keep configurable tie-breakers per §9.11), match-result entry supporting goals/scorers/assists/cards/subs/half-time/extra-time/penalties (audit found `Fixture.scorers` is currently unused dead field), knockout bracket auto-advancement, awards assignment (§9.14).
- _Frontend:_ Add Organization registration UI (new — no equivalent exists today). Extend team-manager flow (`src/components/dashboards/manager.tsx`) with organization selection, squad-approval status display, consent/waiver step for player registration. Extend organizer's `ResultsManager`/`ScheduleForm` (`src/components/dashboards/organizer.tsx`) with full match-event entry (scorers, cards, subs) instead of final-score-only. Build knockout bracket visualization (no current UI). Add `zod` schemas for team/player/organization/fixture/result forms. Remove hardcoded `tournamentId: "t-abuja-s1"` / venue strings identified in the audit; drive from selected tournament context so a second city/tournament works without code changes.
- _Frontend loading/empty states:_ Add skeleton/error states for all newly-async list/detail views (fixtures, teams, players, standings) — audit noted these are almost entirely absent today since data was synchronous mock state.

**Dependencies:** Phase 1 (auth, RBAC, city context, `react-query` wiring) must be complete.

**Deliverables**

- Organization → Team → Player registration chain with organizer approval gates at each step.
- Tournament creation → fixture generation → publish → result entry → auto-standings → knockout advancement → champion, fully functioning for at least one live tournament.
- Player/team statistics derived from actual match events, not seeded static numbers.
- Awards creation/assignment visible on tournament/team/player/city pages.

**Mandatory validation gates**

1. Unit tests — standings calculator (incl. tie-breakers), fixture generator, bracket-advancement logic, statistics aggregation.
2. Integration tests — full registration chain (org → team → player → approval), result-entry → standings-update pipeline, knockout progression.
3. Production build succeeds.
4. Lint/type checks clean.
5. Real browser smoke test with Playwright across all `/$city/*` tournament pages, zero console errors.
6. Relevant Playwright E2E coverage: organizer creates tournament → approves team/players → publishes fixtures → enters results → standings and bracket update correctly; manager registers team/players end-to-end.
7. Manual verification of affected flows: statistics accuracy against a hand-computed sample season; mobile check of bracket/standings tables.
8. No unresolved critical/blocking issues.

---

## Phase 3 — Community & Content

**Objective:** Deliver volunteer management, sponsor/sponsorship-enquiry workflows, announcements/news, media galleries, and notifications.

**Key work**

- _DB/Backend:_ `Volunteer`, `VolunteerApplication` (roles, required numbers, approval, attendance — §9.15), `Sponsor`/`Sponsorship` (tiers, duration, city/tournament linking, publish/unpublish, reorder — §9.16), `Announcement`/`NewsArticle` (headline, featured image, author, categories, draft/published — §9.17), `Gallery`/`MediaFile` (albums, captions, credits, cover image — §9.18), `Notification` (email + in-platform — §9.19).
- _Backend:_ Sponsorship enquiry endpoint + notification to admin (audit found current sponsors page is `mailto:`-only — explicit PRD gap). Notification triggers for account verification, application status changes, team/player invitations/approvals, fixture publication/change, registration deadlines, volunteer approval.
- _Frontend:_ Add in-app sponsorship enquiry form (replace `mailto:` link in `src/routes/$city.sponsors.tsx`) using `zod`/`react-hook-form`. Wire volunteer application review into organizer dashboard (extend existing `ApplicationQueue` component — already reusable per audit). Add in-platform notification center (bell/list) — new, no current equivalent. Wire announcements/news CRUD for organizer/admin roles (currently public-read-only in `src/routes/$city.news.tsx`). Add media upload UI for gallery (currently static bundled images only, per audit).

**Dependencies:** Phase 1 (auth/roles) and Phase 2 (tournament/team context that sponsors/announcements attach to).

**Deliverables**

- Volunteer application → organizer review → approval/assignment flow.
- Sponsor profiles with enquiry form, tier display, city/tournament linking, publish toggle.
- Organizer-authored announcements/news with draft/published states.
- Media gallery supporting real uploads with captions/credits.
- Email + in-platform notifications firing on the events listed in PRD §9.19.

**Mandatory validation gates**

1. Unit tests — notification dispatch logic, sponsorship tier assignment, content publish/draft state transitions.
2. Integration tests — volunteer application → approval, sponsorship enquiry → admin notification, announcement publish → visible on public page.
3. Production build succeeds.
4. Lint/type checks clean.
5. Real browser smoke test with Playwright: volunteer/organize/sponsors/news/gallery pages, zero console errors.
6. Relevant Playwright E2E coverage: submit volunteer application → organizer approves → applicant notified; submit sponsorship enquiry → appears in admin queue; publish announcement → appears on public news page.
7. Manual verification of affected flows: notification email content/delivery, media upload size/type handling.
8. No unresolved critical/blocking issues.

---

## Phase 4 — MVP Hardening & Launch

**Objective:** Close remaining MVP-scope gaps identified in the audit — audit logging, reporting, security/privacy, accessibility, performance, SEO, responsiveness — and confirm all 20 PRD §20 MVP Acceptance Criteria before launch.

**Key work**

- _Backend:_ Administrative audit trail (§10) recording user/action/timestamp/before-after values for role changes, approvals, suspensions, fixture/result/standing corrections (audit found none exists today). Reporting endpoints with CSV/Excel/PDF export by city/country/tournament/organization/team/player/volunteer/sponsor/date range (§15). Data backups, encryption in transit, session expiration, optional 2FA for admins (§13).
- _Frontend:_ Accessibility pass — audit found only a single `aria-label` in the entire `components/devkics` folder; add labels, keyboard navigation checks (`Sheet` mobile menu, `Tabs`), color-contrast verification of custom pitch/wine/flare tokens (§12.5). Complete loading/error/empty states across all remaining views (audit found these largely absent, since original build was synchronous mock data). Performance pass: image optimization, caching, live-result updates without full reloads (§12.2). SEO: sitemap generation, canonical URLs (per-route meta/OG tags already exist per audit — extend, don't rebuild) (§16). Legal/consent flows: Terms of Use, Privacy Policy, Code of Conduct, Player Waiver, Media Consent, Organizer Agreement acceptance (§14 — currently absent).
- _Cross-cutting:_ Security review against OWASP Top 10 (auth, file uploads, rate limiting, XSS/CSRF on all forms introduced in Phases 1–3). Sensitive-field protection audit (DOB, medical, emergency contact never publicly exposed, per §13).

**Dependencies:** Phases 1–3 complete (audit log needs all mutating actions to exist first; reporting needs all entities populated).

**Deliverables**

- Audit log capturing all administrative actions from Phases 1–3.
- Downloadable reports (CSV/Excel/PDF) for the key report types in §15.
- Accessibility compliance pass (keyboard nav, contrast, labels, screen-reader spot-check).
- Sitemap + canonical URLs + verified Open Graph sharing.
- Legal consent gating on registration/application/participation flows.
- Full sign-off against PRD §20 MVP Acceptance Criteria (all 20 items).

**Mandatory validation gates**

1. Unit tests — audit-log writer, report generators, consent-gating logic.
2. Integration tests — audit trail correctness across a full sample workflow (city approval → team approval → result correction), report export correctness.
3. Production build succeeds (optimized/minified).
4. Lint/type checks clean; accessibility linting (axe or equivalent) clean.
5. Real browser smoke test with Playwright across every route on mobile + desktop viewports, zero console errors.
6. Relevant Playwright E2E coverage: full regression suite covering Phase 1–3 flows plus audit-log/report generation.
7. Manual verification of affected flows: run through all 20 PRD §20 acceptance criteria explicitly, one by one, with sign-off.
8. No unresolved critical/blocking issues. **MVP launch gate.**

---

## Phase 5 — Post-MVP / Future Scale

Documented only because explicitly identified in the PRD/Concept Note as future work. Not in MVP implementation scope.

- Native Android/iOS applications.
- Live video streaming; AI-powered highlights/commentary.
- Wearable-device integration.
- Ticketing and merchandise sales.
- Online payments in multiple currencies.
- Fantasy football.
- Public discussion forums; direct messaging between users.
- Global player transfer system.
- Advanced referee management; automated identity verification.
- Global team ranking algorithm; public global rankings.
- Country Administrator role (introduced once multiple cities are active in one country).
- Automated fixture generation improvements; live match timeline; fan voting; match predictions; Player of the Match voting.
- QR-code player/volunteer check-in; digital player cards.
- SMS/WhatsApp/push notifications.
- Multi-language/internationalization (currencies, date formats, time zones, local terminology).
- National, Continental, and Global Cup championship structures; DevKics Universities/Youth/Women/All-Stars editions; annual DevKics Awards.
