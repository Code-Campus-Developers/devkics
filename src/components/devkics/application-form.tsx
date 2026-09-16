import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDevKics } from "@/lib/devkics/store";
import type { ApplicationKind } from "@/lib/devkics/types";

export function ApplicationForm({
  kind,
  detailLabel,
  detailPlaceholder,
  submitLabel,
}: {
  kind: ApplicationKind;
  detailLabel: string;
  detailPlaceholder: string;
  submitLabel: string;
}) {
  const { cities, submitApplication, submitVolunteerApplication } = useDevKics();
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    city: "Abuja",
    role: "Match official",
    detail: "",
  });

  if (done) {
    return (
      <div className="rounded-3xl border border-primary/25 bg-primary/[0.05] p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <h3 className="mt-4 text-xl font-bold">Application received</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          A DevKics organizer will review your submission and reply by email. You can track it in
          the organizer review queue.
        </p>
        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => {
            setDone(false);
            setForm({ name: "", email: "", city: "Abuja", role: "Match official", detail: "" });
          }}
        >
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 rounded-3xl border border-border bg-card p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!agreementAccepted) {
          toast.error("You must accept the agreement and Code of Conduct before submitting.");
          return;
        }
        setIsSubmitting(true);
        try {
          if (kind === "volunteer") {
            const citySlug = cities.find(
              (city) => city.name.toLowerCase() === form.city.trim().toLowerCase(),
            )?.slug;
            if (!citySlug) throw new Error("Choose a listed DevKics city.");
            await submitVolunteerApplication({
              citySlug,
              name: form.name,
              email: form.email,
              role: form.role,
              availability: form.detail,
            });
          } else {
            await submitApplication({ kind, ...form });
          }
          setDone(true);
          toast.success("Application submitted");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to submit application");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" id="app-name">
          <Input
            id="app-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ada Lovelace"
          />
        </Field>
        <Field label="Email" id="app-email">
          <Input
            id="app-email"
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>
      </div>
      <Field label="City" id="app-city">
        <Input
          id="app-city"
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Abuja"
        />
      </Field>
      {kind === "volunteer" && (
        <Field label="Volunteer role" id="app-role">
          <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
            <SelectTrigger id="app-role" aria-label="Volunteer role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Match official">Match official</SelectItem>
              <SelectItem value="Media crew">Media crew</SelectItem>
              <SelectItem value="Matchday coordinator">Matchday coordinator</SelectItem>
              <SelectItem value="Comms & social">Comms & social</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label={detailLabel} id="app-detail">
        <Textarea
          id="app-detail"
          required
          rows={4}
          value={form.detail}
          onChange={(e) => setForm({ ...form, detail: e.target.value })}
          placeholder={detailPlaceholder}
        />
      </Field>
      <div className="flex items-start space-x-3 pt-1">
        <Checkbox
          id="app-agreement"
          checked={agreementAccepted}
          onCheckedChange={(c) => setAgreementAccepted(c === true)}
        />
        <Label
          htmlFor="app-agreement"
          className="text-xs font-normal leading-relaxed text-muted-foreground"
        >
          {kind === "volunteer" ? (
            <>
              I agree to the{" "}
              <Link
                to="/legal"
                search={{ tab: "agreements" }}
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Volunteer Agreement
              </Link>{" "}
              and commit to the DevKics{" "}
              <Link
                to="/legal"
                search={{ tab: "conduct" }}
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Code of Conduct
              </Link>
              .
            </>
          ) : (
            <>
              I agree to the{" "}
              <Link
                to="/legal"
                search={{ tab: "agreements" }}
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                City Organizer Agreement
              </Link>{" "}
              and commit to the DevKics{" "}
              <Link
                to="/legal"
                search={{ tab: "conduct" }}
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Code of Conduct
              </Link>
              .
            </>
          )}
        </Label>
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full rounded-full"
        loading={isSubmitting}
        loadingText="Submitting application..."
        disabled={
          isSubmitting ||
          !agreementAccepted ||
          !form.name.trim() ||
          !form.email.trim() ||
          !form.city.trim() ||
          !form.detail.trim()
        }
      >
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
