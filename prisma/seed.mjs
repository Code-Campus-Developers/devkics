import { PrismaClient, Role, CityStatus, OrganizerApplicationStatus } from "@prisma/client";
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
