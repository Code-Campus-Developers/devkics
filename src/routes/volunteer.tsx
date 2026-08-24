import { createFileRoute } from "@tanstack/react-router";
import { Camera, ClipboardList, Megaphone, Flag } from "lucide-react";

import { PageHeader } from "@/components/devkics/brand";
import { ApplicationForm } from "@/components/devkics/application-form";

export const Route = createFileRoute("/volunteer")({
  head: () => ({
    meta: [
      { title: "Volunteer with DevKics" },
      {
        name: "description",
        content:
          "Referee, shoot, report or coordinate on DevKics matchdays. Apply to volunteer with your city chapter.",
      },
      { property: "og:title", content: "Volunteer with DevKics" },
      {
        property: "og:description",
        content: "Join the DevKics matchday crew — officiating, media, logistics and comms.",
      },
    ],
  }),
  component: VolunteerPage,
});

const roles = [
  {
    icon: Flag,
    title: "Match official",
    body: "Referee or assist on matchday. Training provided.",
  },
  { icon: Camera, title: "Media crew", body: "Shoot photos and highlights for the city gallery." },
  {
    icon: ClipboardList,
    title: "Matchday coordinator",
    body: "Run check-in, kits and timekeeping.",
  },
  { icon: Megaphone, title: "Comms & social", body: "Live scores, recaps and community updates." },
];

function VolunteerPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <PageHeader
        eyebrow="Get involved"
        title="Volunteer on matchday"
        description="DevKics runs on its community. Pick a role, give a few Saturdays, and get right into the middle of the action."
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {roles.map((r) => (
            <div key={r.title} className="card-lift rounded-2xl border border-border bg-card p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{r.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>

        <ApplicationForm
          kind="volunteer"
          detailLabel="Which role, and when are you available?"
          detailPlaceholder="e.g. Match official — free most Saturdays, NFF grassroots certified."
          submitLabel="Submit volunteer application"
        />
      </div>
    </div>
  );
}
