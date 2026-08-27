import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionHeading } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevKics } from "@/lib/devkics/store";
import type { VolunteerListItem, VolunteerRequirement } from "@/lib/devkics/types";

const VOLUNTEER_ROLES = ["Match official", "Media crew", "Matchday coordinator", "Comms & social"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error ?? "Request failed");
  return payload;
}

export function VolunteerOperationsManager() {
  const { tournaments } = useDevKics();
  const tournament = tournaments[0];
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>(VOLUNTEER_ROLES[0] ?? "Match official");
  const [requiredCount, setRequiredCount] = useState("1");

  const requirementsQuery = useQuery({
    queryKey: ["volunteer-requirements", tournament?.id],
    queryFn: () =>
      api<{ requirements: VolunteerRequirement[] }>(
        `/api/volunteer-requirements?tournamentId=${encodeURIComponent(tournament?.id ?? "")}`,
      ),
    enabled: Boolean(tournament?.id),
  });

  const volunteersQuery = useQuery({
    queryKey: ["volunteers", tournament?.id],
    queryFn: () =>
      api<{ volunteers: VolunteerListItem[] }>(
        `/api/volunteers?tournamentId=${encodeURIComponent(tournament?.id ?? "")}`,
      ),
    enabled: Boolean(tournament?.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["volunteer-requirements", tournament?.id] });
    void queryClient.invalidateQueries({ queryKey: ["volunteers", tournament?.id] });
  };

  const setRequirement = useMutation({
    mutationFn: () =>
      api("/api/volunteer-requirements", {
        method: "PUT",
        body: JSON.stringify({
          tournamentId: tournament?.id,
          role,
          requiredCount: Number(requiredCount),
        }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Requirement saved");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to save requirement"),
  });

  const checkIn = useMutation({
    mutationFn: (volunteerId: string) =>
      api(`/api/volunteers/${volunteerId}/check-ins`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      invalidate();
      toast.success("Attendance recorded");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to record attendance"),
  });

  if (!tournament) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a tournament before setting volunteer requirements or recording check-ins.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Volunteer operations"
        description="Set required headcounts per matchday role and check in approved volunteers on the day."
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setRequirement.mutate();
        }}
      >
        <div className="min-w-48 space-y-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOLUNTEER_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-2">
          <Input
            type="number"
            min={0}
            value={requiredCount}
            onChange={(event) => setRequiredCount(event.target.value)}
          />
        </div>
        <Button type="submit" className="rounded-full" disabled={setRequirement.isPending}>
          Save quota
        </Button>
      </form>

      <ul className="space-y-2">
        {requirementsQuery.data?.requirements.map((requirement) => (
          <li
            key={requirement.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <span className="font-medium">{requirement.role}</span>
            <span className="text-sm text-muted-foreground">
              {requirement.approvedCount} / {requirement.requiredCount} approved
            </span>
          </li>
        ))}
        {requirementsQuery.data?.requirements.length === 0 && (
          <li className="text-sm text-muted-foreground">No role quotas set yet.</li>
        )}
      </ul>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Matchday check-in</h3>
        <ul className="space-y-2">
          {volunteersQuery.data?.volunteers.map((volunteer) => (
            <li
              key={volunteer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{volunteer.applicant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {volunteer.role} · {volunteer.attendanceCount} check-in
                  {volunteer.attendanceCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => checkIn.mutate(volunteer.id)}
                disabled={checkIn.isPending}
              >
                Check in
              </Button>
            </li>
          ))}
          {volunteersQuery.data?.volunteers.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No approved volunteers assigned to this tournament yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
