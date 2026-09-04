import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, FileText, HeartHandshake, Award, ScrollText } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canonicalLink, seoMeta } from "@/lib/seo";

type LegalTab = "terms" | "privacy" | "conduct" | "waiver" | "agreements";

export const Route = createFileRoute("/legal")({
  validateSearch: (search: Record<string, unknown>): { tab?: LegalTab } => {
    const validTabs: LegalTab[] = ["terms", "privacy", "conduct", "waiver", "agreements"];
    const tabVal = search["tab"];
    const tab =
      typeof tabVal === "string" && validTabs.includes(tabVal as LegalTab)
        ? (tabVal as LegalTab)
        : "terms";
    return { tab };
  },
  head: () => ({
    links: [canonicalLink("/legal")],
    meta: seoMeta({
      title: "Legal, Privacy & Consent — DevKics",
      description:
        "Official Terms of Use, Privacy Policy, Code of Conduct, Player Waiver, Media Consent, and Participant Agreements for DevKics.",
      path: "/legal",
    }),
  }),
  component: LegalPage,
});

function LegalPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activeTab, setActiveTab] = useState<LegalTab>(search.tab || "terms");

  const handleTabChange = (val: string) => {
    const tab = val as LegalTab;
    setActiveTab(tab);
    void navigate({ search: { tab }, replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <PageHeader
        eyebrow="Governance & Compliance"
        title="Legal, Privacy & Consent"
        description="Official platform terms, privacy policy, code of conduct, player participation waivers, and community agreements."
      />

      <div className="mt-10">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList
            className="grid w-full grid-cols-2 gap-1 rounded-2xl p-1 sm:grid-cols-5"
            aria-label="Legal document categories"
          >
            <TabsTrigger value="terms" className="rounded-xl text-xs sm:text-sm">
              <FileText className="mr-1.5 size-4" />
              Terms
            </TabsTrigger>
            <TabsTrigger value="privacy" className="rounded-xl text-xs sm:text-sm">
              <ShieldCheck className="mr-1.5 size-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="conduct" className="rounded-xl text-xs sm:text-sm">
              <HeartHandshake className="mr-1.5 size-4" />
              Conduct
            </TabsTrigger>
            <TabsTrigger value="waiver" className="rounded-xl text-xs sm:text-sm">
              <Award className="mr-1.5 size-4" />
              Waiver
            </TabsTrigger>
            <TabsTrigger value="agreements" className="rounded-xl text-xs sm:text-sm">
              <ScrollText className="mr-1.5 size-4" />
              Agreements
            </TabsTrigger>
          </TabsList>

          {/* Terms of Use */}
          <TabsContent value="terms" className="mt-8 space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Section 14.1
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">Terms of Use</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Last revised: September 2026 · Governing Entity: Code Campus International
                </p>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Welcome to DevKics. By registering an account, submitting an application, or
                  participating in any DevKics-organized tournament, you agree to be bound by these
                  Terms of Use and all applicable rules and guidelines.
                </p>

                <h3 className="font-semibold text-foreground">1. Eligibility & Accounts</h3>
                <p>
                  Participants must be at least 18 years of age or possess authorized
                  parental/guardian consent if youth divisions are established. You are responsible
                  for maintaining the confidentiality of your login credentials and for all
                  activities that occur under your account.
                </p>

                <h3 className="font-semibold text-foreground">2. Tournament Participation</h3>
                <p>
                  DevKics provides amateur football leagues for technology and engineering
                  communities. All team rosters, player additions, match events, and results are
                  subject to validation by appointed match officials and city organizers. Code
                  Campus International maintains central oversight of platform operations.
                </p>

                <h3 className="font-semibold text-foreground">3. Platform Integrity & Fair Play</h3>
                <p>
                  Users must not submit fraudulent profile information, manipulate tournament
                  results, or tamper with system data. Any unauthorized attempt to bypass role-based
                  access controls or falsify records will result in account suspension and
                  disqualification.
                </p>

                <h3 className="font-semibold text-foreground">4. Limitation of Liability</h3>
                <p>
                  DevKics and Code Campus International provide match coordination software and
                  league frameworks. Participation in sports involves inherent physical risks, which
                  are voluntarily assumed by players under our Participation Waiver.
                </p>
              </div>
            </article>
          </TabsContent>

          {/* Privacy Policy */}
          <TabsContent value="privacy" className="mt-8 space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Section 14.2 & Section 13
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">Privacy Policy</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Data Protection & Privacy Architecture · Participant Privacy Principles
                </p>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  DevKics is committed to protecting your personal data and upholding the highest
                  standards of confidentiality, especially regarding sensitive participant records.
                </p>

                <h3 className="font-semibold text-foreground">1. Information We Collect</h3>
                <p>
                  We collect account information (name, email address, password hash), role
                  assignments, team membership, city affiliation, and athletic performance records
                  (goals, assists, discipline, and match appearances).
                </p>

                <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                  <h4 className="font-semibold text-foreground">
                    Strict Protection of Sensitive Data (§13)
                  </h4>
                  <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                    Pursuant to Section 13 of the DevKics Product Requirements, sensitive
                    participant details including <strong>Date of Birth</strong>,{" "}
                    <strong>Emergency Contact Name and Phone</strong>, and{" "}
                    <strong>Medical Declarations</strong> are strictly protected. These fields are
                    never displayed on public player profiles, public standings, or public API
                    endpoints. Access is restricted solely to authorized managers and emergency
                    administrators.
                  </p>
                </div>

                <h3 className="font-semibold text-foreground">2. Audit Logging & Security</h3>
                <p>
                  All administrative actions—such as role modifications, approvals, suspensions, and
                  score revisions—are recorded in an immutable administrative audit log with
                  timestamps, actor identities, and before/after values to ensure transparency and
                  accountability.
                </p>

                <h3 className="font-semibold text-foreground">3. Your Data Rights</h3>
                <p>
                  You have the right to request access to your personal data, update inaccuracies,
                  or request deletion upon cessation of active tournament participation by
                  contacting your city organizer or our privacy administration team.
                </p>
              </div>
            </article>
          </TabsContent>

          {/* Code of Conduct */}
          <TabsContent value="conduct" className="mt-8 space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Section 14.3
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">Community Code of Conduct</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Standards of Respect, Fair Play & Professionalism on and off the Pitch
                </p>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  DevKics brings tech communities together to celebrate football, fitness, and
                  networking. We foster a competitive yet welcoming environment founded on mutual
                  respect.
                </p>

                <h3 className="font-semibold text-foreground">
                  1. Respect for Opponents & Officials
                </h3>
                <p>
                  Match officials exercise final authority on all in-game decisions. Dissent,
                  aggressive confrontation, and abusive language directed at referees, linesmen,
                  organizers, or opponents will not be tolerated.
                </p>

                <h3 className="font-semibold text-foreground">
                  2. Zero Tolerance for Discrimination
                </h3>
                <p>
                  DevKics strictly prohibits discrimination, harassment, hate speech, or derogatory
                  remarks based on race, ethnicity, gender, sexual orientation, disability, or
                  religion. Violations result in immediate match ejection and prospective tournament
                  ban.
                </p>

                <h3 className="font-semibold text-foreground">3. Safety & Dangerous Play</h3>
                <p>
                  Tackles from behind, reckless challenges, and violent conduct violate the spirit
                  of the league. Players are tech professionals who have work on Monday morning;
                  player safety is paramount.
                </p>

                <h3 className="font-semibold text-foreground">4. Disciplinary Sanctions</h3>
                <p>
                  Yellow and red cards are recorded and carry automatic match suspensions. Severe
                  infractions are reviewed by the City Organizing Committee and may lead to
                  organizational or individual bans.
                </p>
              </div>
            </article>
          </TabsContent>

          {/* Player Waiver & Media Consent */}
          <TabsContent value="waiver" className="mt-8 space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Section 14.4 & Section 14.5
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  Player Participation Waiver & Media Consent
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Assumption of Athletic Risk, Health Declaration & Media Release
                </p>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <h3 className="font-semibold text-foreground">1. Assumption of Risk</h3>
                <p>
                  Football is a contact sport involving rigorous physical exertion and risk of
                  bodily injury. By participating in DevKics matches, players confirm they are
                  medically fit to play, carry personal health coverage, and voluntarily assume all
                  risks of injury, loss, or damage arising from match participation.
                </p>

                <h3 className="font-semibold text-foreground">2. Release of Liability</h3>
                <p>
                  Participants release Code Campus International, city organizers, venue operators,
                  and match officials from claims, damages, or liabilities arising out of standard
                  tournament gameplay, except in cases of gross negligence.
                </p>

                <h3 className="font-semibold text-foreground">
                  3. Media Consent & Photography Release
                </h3>
                <p>
                  DevKics volunteer media crews and official partners capture photos, audio, and
                  video footage during matchdays. Participants grant DevKics a non-exclusive license
                  to use their likeness in match highlights, social media recaps, live score
                  streams, and promotional league archives.
                </p>

                <p>
                  Participants who require media accommodation or wish to request removal of a
                  specific public photograph may submit a request to the city media team.
                </p>
              </div>
            </article>
          </TabsContent>

          {/* Agreements */}
          <TabsContent value="agreements" className="mt-8 space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Section 14.6 & Section 14.7
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  City Organizer & Volunteer Agreements
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chapter Governance, Brand Licensing, and Matchday Operational Protocols
                </p>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <h3 className="font-semibold text-foreground">City Organizer Agreement</h3>
                <p>
                  City organizers operate local DevKics tournaments under license from Code Campus
                  International. Organizers commit to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Deploying the standard DevKics digital platform for fixtures, tables, and
                    scoring.
                  </li>
                  <li>Securing safe, reputable turf facilities equipped with basic first aid.</li>
                  <li>
                    Ensuring qualified officiating and strict enforcement of the Code of Conduct.
                  </li>
                  <li>
                    Managing tournament finances, sponsorships, and player waivers transparently.
                  </li>
                  <li>Upholding the DevKics brand identity and community guidelines.</li>
                </ul>

                <h3 className="mt-6 font-semibold text-foreground">Volunteer Agreement</h3>
                <p>
                  Volunteers (referees, media crew, coordinators, reporters) power the DevKics
                  matchday experience. Volunteers agree to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Perform assigned duties punctually, impartially, and conscientiously.</li>
                  <li>Safeguard sensitive participant and operational information.</li>
                  <li>Respect players, managers, spectators, and fellow volunteers.</li>
                </ul>
              </div>
            </article>
          </TabsContent>
        </Tabs>

        <p className="mt-12 text-center text-xs text-muted-foreground/75">
          Notice: These policies establish the operating rules, community standards, and participant
          expectations for DevKics amateur sports leagues and are provided for product governance
          purposes.
        </p>
      </div>
    </div>
  );
}
