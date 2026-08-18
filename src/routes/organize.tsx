import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { ApplicationForm } from "@/components/devkics/application-form";
import pitchTop from "@/assets/pitch-top.jpg";

export const Route = createFileRoute("/organize")({
  head: () => ({
    meta: [
      { title: "Become a City Organizer — DevKics" },
      {
        name: "description",
        content:
          "Launch DevKics in your city. Get the playbook, the platform and sponsorship support for your first season.",
      },
      { property: "og:title", content: "Become a City Organizer — DevKics" },
      {
        property: "og:description",
        content: "Bring the DevKics tech football league to your city.",
      },
    ],
  }),
  component: OrganizePage,
});

const steps = [
  ["Apply", "Tell us about your community, your city and the pitches you can access."],
  ["Review call", "A 30-minute call with the DevKics core team to align on scope and timing."],
  ["Onboarding", "You get the playbook, organizer dashboard access and a launch checklist."],
  ["Kick-off", "Recruit six or more teams and run your first season with our support."],
];

function OrganizePage() {
  return (
    <div>
      <div className="relative isolate overflow-hidden">
        <img
          src={pitchTop}
          alt="Aerial view of an astro turf pitch"
          width={1400}
          height={800}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-[oklch(0.22_0.05_158/0.86)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pitch-foreground/60">
            City expansion
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold text-pitch-foreground sm:text-5xl">
            Bring DevKics to your city
          </h1>
          <p className="mt-4 max-w-xl text-pitch-foreground/75">
            We are opening chapters in Lagos, Nairobi, London, Berlin and Toronto. Organizers get
            the full DevKics playbook and platform.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <PageHeader eyebrow="Process" title="How it works" />
            <ol className="mt-8 space-y-6">
              {steps.map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ApplicationForm
            kind="city-organizer"
            detailLabel="Tell us about your community and city"
            detailPlaceholder="e.g. Lagos — a 1,200-member engineering community, two turf venues secured, targeting 8 teams."
            submitLabel="Apply to organize"
          />
        </div>
      </div>
    </div>
  );
}
