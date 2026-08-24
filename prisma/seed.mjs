import {
  PrismaClient,
  Role,
  CityStatus,
  OrganizerApplicationStatus,
  OrganizationStatus,
  TournamentStatus,
  TeamStatus,
  PlayerStatus,
  MatchStatus,
  MatchStage,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const cities = [
  {
    slug: "abuja",
    name: "Abuja",
    country: "Nigeria",
    countryCode: "NG",
    status: CityStatus.LIVE,
    teams: 8,
    players: 96,
    tagline: "The pilot city. Where DevKics kicked off.",
    accentImage: "abuja",
  },
  {
    slug: "lagos",
    name: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    status: CityStatus.APPLICATIONS_OPEN,
    teams: 0,
    players: 0,
    tagline: "Organizer applications open for Season 1.",
    accentImage: "lagos",
  },
  {
    slug: "nairobi",
    name: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    status: CityStatus.APPLICATIONS_OPEN,
    teams: 0,
    players: 0,
    tagline: "Building the East Africa chapter.",
    accentImage: "nairobi",
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    countryCode: "GB",
    status: CityStatus.COMING_SOON,
    teams: 0,
    players: 0,
    tagline: "Waitlist open for tech teams.",
    accentImage: "london",
  },
  {
    slug: "berlin",
    name: "Berlin",
    country: "Germany",
    countryCode: "DE",
    status: CityStatus.COMING_SOON,
    teams: 0,
    players: 0,
    tagline: "Scouting venues and partners.",
    accentImage: "berlin",
  },
  {
    slug: "toronto",
    name: "Toronto",
    country: "Canada",
    countryCode: "CA",
    status: CityStatus.COMING_SOON,
    teams: 0,
    players: 0,
    tagline: "Community interest growing fast.",
    accentImage: "toronto",
  },
];

const users = [
  { name: "Global Admin", email: "admin@devkics.com", role: Role.ADMIN, citySlug: "abuja" },
  {
    name: "Abuja Organizer",
    email: "organizer@devkics.com",
    role: Role.ORGANIZER,
    citySlug: "abuja",
  },
  { name: "Team Manager", email: "manager@devkics.com", role: Role.MANAGER, citySlug: "abuja" },
  { name: "Player One", email: "player@devkics.com", role: Role.PLAYER, citySlug: "abuja" },
];

async function main() {
  await prisma.awardAssignment.deleteMany();
  await prisma.award.deleteMany();
  await prisma.knockoutLink.deleteMany();
  await prisma.knockoutRound.deleteMany();
  await prisma.standing.deleteMany();
  await prisma.matchEvent.deleteMany();
  await prisma.match.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.group.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.organizerApplication.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.city.deleteMany();

  const createdCities = [];
  for (const city of cities) {
    const created = await prisma.city.create({ data: city });
    createdCities.push(created);
  }

  const passwordHash = await bcrypt.hash("devkics", 10);

  for (const user of users) {
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash,
        citySlug: user.citySlug,
      },
    });

    const city = createdCities.find((c) => c.slug === user.citySlug);
    await prisma.roleAssignment.create({
      data: {
        userId: created.id,
        role: user.role,
        cityId: city?.id,
        countryCode: city?.countryCode,
      },
    });
  }

  const abuja = createdCities.find((city) => city.slug === "abuja");
  const manager = await prisma.user.findUnique({ where: { email: "manager@devkics.com" } });

  if (abuja && manager) {
    const organization = await prisma.organization.create({
      data: {
        cityId: abuja.id,
        ownerUserId: manager.id,
        name: "Interswitch Engineering",
        slug: "interswitch-engineering",
        email: "interswitch@devkics.com",
        description: "Engineering organization behind one of the inaugural teams.",
        status: OrganizationStatus.APPROVED,
      },
    });

    const tournament = await prisma.tournament.create({
      data: {
        cityId: abuja.id,
        updatedByUserId: manager.id,
        name: "DevKics Abuja Cup",
        slug: "abuja-cup-season-1",
        season: "Season 1",
        format: "Group + Knockout",
        venue: "Jabi Astro Turf",
        summary: "Pilot tournament for DevKics city chapters.",
        status: TournamentStatus.ONGOING,
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-10-01T00:00:00.000Z"),
        tieBreakers: ["points", "goalDifference", "goalsFor"],
      },
    });

    const groupA = await prisma.group.create({
      data: {
        tournamentId: tournament.id,
        name: "A",
        sortOrder: 1,
      },
    });

    const teamOne = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: organization.id,
        groupId: groupA.id,
        managerUserId: manager.id,
        name: "Interswitch Devs",
        shortName: "ISW",
        company: "Interswitch",
        color: "green",
        founded: "2026",
        status: TeamStatus.APPROVED,
      },
    });

    const teamTwo = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: organization.id,
        groupId: groupA.id,
        managerUserId: manager.id,
        name: "Interswitch QA",
        shortName: "IQA",
        company: "Interswitch",
        color: "wine",
        founded: "2026",
        status: TeamStatus.APPROVED,
      },
    });

    const player = await prisma.player.create({
      data: {
        teamId: teamOne.id,
        userId: manager.id,
        fullName: "Manager Captain",
        email: manager.email,
        position: "MID",
        number: 10,
        role: "Software Engineer",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    const fixture = await prisma.fixture.create({
      data: {
        tournamentId: tournament.id,
        groupId: groupA.id,
        homeTeamId: teamOne.id,
        awayTeamId: teamTwo.id,
        stage: MatchStage.GROUP,
        matchday: 1,
        kickoffAt: new Date("2026-08-05T10:00:00.000Z"),
        venue: "Jabi Astro Turf",
        status: MatchStatus.COMPLETED,
        isPublished: true,
      },
    });

    await prisma.match.create({
      data: {
        fixtureId: fixture.id,
        homeScore: 2,
        awayScore: 1,
        reviewerUserId: manager.id,
        verifiedAt: new Date(),
      },
    });

    await prisma.matchEvent.createMany({
      data: [
        {
          matchId: (await prisma.match.findUnique({ where: { fixtureId: fixture.id } })).id,
          type: "GOAL",
          teamId: teamOne.id,
          playerId: player.id,
          period: "regular",
          minute: 12,
        },
        {
          matchId: (await prisma.match.findUnique({ where: { fixtureId: fixture.id } })).id,
          type: "GOAL",
          teamId: teamTwo.id,
          period: "regular",
          minute: 50,
        },
      ],
    });
  }

  await prisma.organizerApplication.create({
    data: {
      name: "Lagos Community Lead",
      email: "lead@lagostech.org",
      city: "Lagos",
      country: "Nigeria",
      detail: "We run a 1,000+ member engineering meetup and have two venues available.",
      proposedVenue: "Oniru 5-aside Center",
      status: OrganizerApplicationStatus.SUBMITTED,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
