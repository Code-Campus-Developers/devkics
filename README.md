# DevKics Play Hub

Build the first working MVP prototype for DevKics — “Where Tech Comes to Play”, based on the provided DevKics Concept Note and PRD.

Create a premium, modern sports-tech platform with a distinct DevKics identity. Do not copy Goalazo, MyCup, or TorMatch; use them only as UX inspiration.

Product direction

DevKics is a global technology-community football platform, starting with Abuja as the pilot city.

Design the architecture/UI so additional cities can later use /abuja, /lagos, /london, etc.

Keep the first version simple, clean and focused. Avoid information overload, excessive statistics, dense dashboards, or unnecessary text.

Visual identity

Use CodeCampus green + white as the primary palette, with carefully balanced wine and orange accents.
The result should feel:

Premium

Athletic

Modern

Tech-focused

Trustworthy

Community-driven

Use strong typography, generous whitespace, polished cards, subtle motion, excellent responsive behavior, and high-quality football imagery/placeholders. Avoid generic template/SaaS aesthetics.

MVP pages

Build the complete clickable experience for:

Public

Home

Find a City

Abuja City Portal

Tournament Overview

Teams

Players

Fixtures

Results

Standings

Sponsors

News/Announcements

Media/Gallery

Volunteer Application

Become a City Organizer

Login/Register

Authenticated

Global Admin Dashboard

City Organizer Dashboard

Team Manager Dashboard

Player Dashboard

Core prototype flows

Make these flows actually work using local/mock data:

Find Abuja → view tournament → teams → fixtures → standings.

Register/login → access the appropriate dashboard.

Team manager → create/manage team → add/invite players.

Organizer → manage tournament → teams → fixtures → results.

Organizer → review city/team/player/volunteer applications.

Match result updates should immediately reflect in results and standings.

Engineering requirements

Use Next.js + TypeScript + Tailwind CSS + shadcn/ui.

Keep components reusable and routes/data models clean.

Separate mock data/services from UI so the frontend can later be connected to a real API/backend without restructuring the application.

Use realistic seed data for DevKics Abuja.

No real payment integration, streaming, AI features, chat, or other post-MVP functionality.

Do not over-engineer the prototype.

The goal is to produce a convincing, polished, working DevKics MVP prototype that can be reviewed by the founder and then handed to a backend engineer/Copilot for API, PostgreSQL, Prisma and JWT integration.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2801c9bd-33f9-45ec-8d0f-59ce9e5195b2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
