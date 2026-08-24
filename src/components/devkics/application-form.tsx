import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { submitApplication } = useDevKics();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", city: "Abuja", detail: "" });

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
            setForm({ name: "", email: "", city: "Abuja", detail: "" });
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
        try {
          await submitApplication({ kind, ...form });
          setDone(true);
          toast.success("Application submitted");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to submit application");
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ada Lovelace"
          />
        </Field>
        <Field label="Email">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>
      </div>
      <Field label="City">
        <Input
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Abuja"
        />
      </Field>
      <Field label={detailLabel}>
        <Textarea
          required
          rows={4}
          value={form.detail}
          onChange={(e) => setForm({ ...form, detail: e.target.value })}
          placeholder={detailPlaceholder}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full rounded-full">
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
