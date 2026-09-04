import type { PrismaClient } from "@prisma/client";

export const reportTypes = [
  "organizations",
  "teams",
  "players",
  "volunteers",
  "sponsors",
  "fixtures",
  "standings",
] as const;

export type ReportType = (typeof reportTypes)[number];
export type ReportFormat = "csv" | "excel" | "pdf";

type Cell = string | number | null;

export type ReportScope = {
  cityIds?: string[];
  countryCode?: string;
  tournamentId?: string;
  organizationId?: string;
  teamId?: string;
  playerId?: string;
  volunteerId?: string;
  sponsorId?: string;
  from?: Date;
  to?: Date;
};

export type Report = {
  title: string;
  columns: string[];
  rows: Cell[][];
};

function inDateRange(value: Date, scope: ReportScope) {
  if (scope.from && value < scope.from) return false;
  if (scope.to && value > scope.to) return false;
  return true;
}

function isAllowedCity(cityId: string, scope: ReportScope) {
  return !scope.cityIds || scope.cityIds.includes(cityId);
}

export async function buildReport(
  prisma: PrismaClient,
  type: ReportType,
  scope: ReportScope,
): Promise<Report> {
  if (type === "organizations") {
    const organizations = await prisma.organization.findMany({
      include: { city: true, teams: { select: { id: true } } },
      orderBy: { submittedAt: "desc" },
    });
    const rows = organizations
      .filter(
        (item) =>
          isAllowedCity(item.cityId, scope) &&
          (!scope.countryCode || item.city.countryCode === scope.countryCode) &&
          (!scope.organizationId || item.id === scope.organizationId) &&
          inDateRange(item.createdAt, scope),
      )
      .map((item) => [
        item.name,
        item.city.name,
        item.city.countryCode,
        item.status,
        item.teams.length,
        item.submittedAt.toISOString(),
      ]);
    return {
      title: "Organizations report",
      columns: ["Organization", "City", "Country", "Status", "Teams", "Submitted at"],
      rows,
    };
  }

  if (type === "teams") {
    const teams = await prisma.team.findMany({
      include: { organization: true, tournament: { include: { city: true } }, players: true },
      orderBy: { submittedAt: "desc" },
    });
    const rows = teams
      .filter(
        (item) =>
          isAllowedCity(item.tournament.cityId, scope) &&
          (!scope.countryCode || item.tournament.city.countryCode === scope.countryCode) &&
          (!scope.tournamentId || item.tournamentId === scope.tournamentId) &&
          (!scope.organizationId || item.organizationId === scope.organizationId) &&
          (!scope.teamId || item.id === scope.teamId) &&
          inDateRange(item.createdAt, scope),
      )
      .map((item) => [
        item.name,
        item.shortName,
        item.organization.name,
        item.tournament.name,
        item.tournament.city.name,
        item.status,
        item.players.length,
        item.submittedAt.toISOString(),
      ]);
    return {
      title: "Teams report",
      columns: [
        "Team",
        "Short name",
        "Organization",
        "Tournament",
        "City",
        "Status",
        "Players",
        "Submitted at",
      ],
      rows,
    };
  }

  if (type === "players") {
    const players = await prisma.player.findMany({
      include: {
        team: { include: { organization: true, tournament: { include: { city: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
    const rows = players
      .filter(
        (item) =>
          isAllowedCity(item.team.tournament.cityId, scope) &&
          (!scope.countryCode || item.team.tournament.city.countryCode === scope.countryCode) &&
          (!scope.tournamentId || item.team.tournamentId === scope.tournamentId) &&
          (!scope.organizationId || item.team.organizationId === scope.organizationId) &&
          (!scope.teamId || item.teamId === scope.teamId) &&
          (!scope.playerId || item.id === scope.playerId) &&
          inDateRange(item.createdAt, scope),
      )
      .map((item) => [
        item.fullName,
        item.position,
        item.number,
        item.team.name,
        item.team.organization.name,
        item.team.tournament.name,
        item.status,
        item.submittedAt.toISOString(),
      ]);
    return {
      title: "Players report",
      columns: [
        "Player",
        "Position",
        "Number",
        "Team",
        "Organization",
        "Tournament",
        "Status",
        "Submitted at",
      ],
      rows,
    };
  }

  if (type === "volunteers") {
    const volunteers = await prisma.volunteer.findMany({
      include: { city: true, tournament: true, application: true },
      orderBy: { assignedAt: "desc" },
    });
    const rows = volunteers
      .filter(
        (item) =>
          isAllowedCity(item.cityId, scope) &&
          (!scope.countryCode || item.city.countryCode === scope.countryCode) &&
          (!scope.tournamentId || item.tournamentId === scope.tournamentId) &&
          (!scope.volunteerId || item.id === scope.volunteerId) &&
          inDateRange(item.assignedAt, scope),
      )
      .map((item) => [
        item.application.name,
        item.role,
        item.city.name,
        item.tournament?.name ?? "Unassigned",
        item.attendanceCount,
        item.assignedAt.toISOString(),
      ]);
    return {
      title: "Volunteers report",
      columns: ["Volunteer", "Role", "City", "Tournament", "Check-ins", "Assigned at"],
      rows,
    };
  }

  if (type === "sponsors") {
    const sponsorships = await prisma.sponsorship.findMany({
      include: { sponsor: true, city: true, tournament: true },
      orderBy: [{ tier: "asc" }, { sortOrder: "asc" }],
    });
    const rows = sponsorships
      .filter(
        (item) =>
          isAllowedCity(item.cityId, scope) &&
          (!scope.countryCode || item.city.countryCode === scope.countryCode) &&
          (!scope.tournamentId || item.tournamentId === scope.tournamentId) &&
          (!scope.sponsorId || item.sponsorId === scope.sponsorId) &&
          inDateRange(item.createdAt, scope),
      )
      .map((item) => [
        item.sponsor.name,
        item.tier,
        item.city.name,
        item.tournament?.name ?? "All tournaments",
        item.isPublished ? "Published" : "Draft",
        item.startsAt?.toISOString() ?? null,
        item.endsAt?.toISOString() ?? null,
      ]);
    return {
      title: "Sponsors report",
      columns: ["Sponsor", "Tier", "City", "Tournament", "Publication", "Starts at", "Ends at"],
      rows,
    };
  }

  if (type === "fixtures") {
    const fixtures = await prisma.fixture.findMany({
      include: {
        tournament: { include: { city: true } },
        homeTeam: true,
        awayTeam: true,
        match: true,
      },
      orderBy: { kickoffAt: "asc" },
    });
    const rows = fixtures
      .filter(
        (item) =>
          isAllowedCity(item.tournament.cityId, scope) &&
          (!scope.countryCode || item.tournament.city.countryCode === scope.countryCode) &&
          (!scope.tournamentId || item.tournamentId === scope.tournamentId) &&
          (!scope.teamId || item.homeTeamId === scope.teamId || item.awayTeamId === scope.teamId) &&
          inDateRange(item.kickoffAt, scope),
      )
      .map((item) => [
        item.tournament.name,
        item.tournament.city.name,
        item.homeTeam.name,
        item.awayTeam.name,
        item.matchday,
        item.kickoffAt.toISOString(),
        item.venue,
        item.status,
        item.match?.homeScore ?? null,
        item.match?.awayScore ?? null,
      ]);
    return {
      title: "Fixtures report",
      columns: [
        "Tournament",
        "City",
        "Home",
        "Away",
        "Matchday",
        "Kickoff",
        "Venue",
        "Status",
        "Home score",
        "Away score",
      ],
      rows,
    };
  }

  const standings = await prisma.standing.findMany({
    include: { team: { include: { tournament: { include: { city: true } } } } },
    orderBy: [{ tournamentId: "asc" }, { rank: "asc" }],
  });
  const rows = standings
    .filter(
      (item) =>
        isAllowedCity(item.team.tournament.cityId, scope) &&
        (!scope.countryCode || item.team.tournament.city.countryCode === scope.countryCode) &&
        (!scope.tournamentId || item.tournamentId === scope.tournamentId) &&
        (!scope.teamId || item.teamId === scope.teamId) &&
        inDateRange(item.updatedAt, scope),
    )
    .map((item) => [
      item.team.tournament.name,
      item.team.name,
      item.rank,
      item.played,
      item.won,
      item.drawn,
      item.lost,
      item.goalDifference,
      item.points,
    ]);
  return {
    title: "Standings report",
    columns: [
      "Tournament",
      "Team",
      "Rank",
      "Played",
      "Won",
      "Drawn",
      "Lost",
      "Goal difference",
      "Points",
    ],
    rows,
  };
}

function safeCell(value: Cell) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function toCsv(report: Report) {
  const row = (values: Cell[]) =>
    values.map((value) => `"${safeCell(value).replaceAll('"', '""')}"`).join(",");
  return [row(report.columns), ...report.rows.map(row)].join("\r\n");
}

function xmlEscape(value: Cell) {
  return safeCell(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toExcelXml(report: Report) {
  const xmlRow = (values: Cell[]) =>
    `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join("")}</Row>`;
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>${xmlRow(report.columns)}${report.rows.map(xmlRow).join("")}</Table></Worksheet></Workbook>`;
}

function pdfEscape(value: Cell) {
  return safeCell(value)
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function toPdf(report: Report) {
  const pageRows = 55;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(report.rows.length / pageRows)) },
    (_, index) => report.rows.slice(index * pageRows, (index + 1) * pageRows),
  );
  const fontObjectId = 3 + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];
  pages.forEach((rows, index) => {
    const contentObjectId = 4 + index * 2;
    const lines = [
      report.title,
      report.columns.join(" | "),
      ...rows.map((row) => row.map(pdfEscape).join(" | ")),
    ];
    const body = `BT /F1 9 Tf 48 760 Td (${pdfEscape(lines[0] ?? "")}) Tj\n${lines
      .slice(1)
      .map((line) => `0 -12 Td (${pdfEscape(line)}) Tj`)
      .join("\n")}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
