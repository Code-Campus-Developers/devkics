import "dotenv/config";
import { PrismaClient, Role, CityStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for production seeding");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const baselineCities = [
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

async function seedCities() {
  console.log("Upserting baseline cities...");
  for (const city of baselineCities) {
    const upserted = await prisma.city.upsert({
      where: { slug: city.slug },
      update: {
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        status: city.status,
        tagline: city.tagline,
        accentImage: city.accentImage,
      },
      create: {
        slug: city.slug,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        status: city.status,
        teams: city.teams,
        players: city.players,
        tagline: city.tagline,
        accentImage: city.accentImage,
      },
    });
    console.log(`  ✓ City [${upserted.slug}]: ${upserted.status}`);
  }
}

async function seedAdmin() {
  const adminEmail = process.env.PROD_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.PROD_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      "PROD_ADMIN_EMAIL and PROD_ADMIN_PASSWORD not set; skipping admin account provisioning.",
    );
    return;
  }

  console.log(`Upserting initial platform administrator: ${adminEmail}`);
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      isEmailVerified: true,
    },
    create: {
      name: process.env.PROD_ADMIN_NAME?.trim() || "DevKics Administrator",
      email: adminEmail,
      passwordHash,
      isEmailVerified: true,
      citySlug: "abuja",
    },
  });

  const abujaCity = await prisma.city.findUnique({ where: { slug: "abuja" } });

  const existingAssignment = await prisma.roleAssignment.findFirst({
    where: {
      userId: adminUser.id,
      role: Role.ADMIN,
    },
  });

  if (!existingAssignment) {
    await prisma.roleAssignment.create({
      data: {
        userId: adminUser.id,
        role: Role.ADMIN,
        cityId: abujaCity?.id,
        countryCode: abujaCity?.countryCode ?? "NG",
      },
    });
    console.log(`  ✓ Created ADMIN role assignment for ${adminEmail}`);
  } else {
    console.log(`  ✓ ADMIN role assignment already exists for ${adminEmail}`);
  }
}

async function main() {
  console.log("=== DevKics Production Seed Started ===");
  await seedCities();
  await seedAdmin();
  console.log("=== DevKics Production Seed Finished (0 records deleted) ===");
}

main()
  .catch((error) => {
    console.error("Production seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
