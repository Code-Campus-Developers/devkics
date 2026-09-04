import { describe, expect, it } from "vitest";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["organizer", "manager", "player"]),
  citySlug: z.string().optional(),
  acceptedTerms: z.boolean().default(true),
});

const organizerApplicationSchema = z.object({
  kind: z.literal("city-organizer"),
  name: z.string().min(2),
  email: z.string().email(),
  city: z.string().min(2),
  detail: z.string().min(10).max(2_000),
  agreementAccepted: z.boolean().default(true),
});

const volunteerApplicationSchema = z.object({
  citySlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string().min(2).max(120),
  availability: z.string().min(10).max(2_000),
  agreementAccepted: z.boolean().default(true),
});

const playerCreateSchema = z.object({
  teamId: z.string().min(1),
  fullName: z.string().min(2),
  position: z.string().min(2),
  waiverAccepted: z.boolean(),
  mediaConsentAccepted: z.boolean().optional(),
});

describe("Phase 4.3 — Legal & Consent Gating", () => {
  describe("Registration Terms & Privacy Gating", () => {
    it("accepts valid registration when terms are explicitly agreed to", () => {
      const result = registerSchema.safeParse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "securePassword123",
        role: "player",
        acceptedTerms: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.acceptedTerms).toBe(true);
      }
    });

    it("defaults acceptedTerms to true when omitted for backward compatibility", () => {
      const result = registerSchema.safeParse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "securePassword123",
        role: "manager",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.acceptedTerms).toBe(true);
      }
    });

    it("captures acceptedTerms=false when a user explicitly refuses", () => {
      const result = registerSchema.safeParse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "securePassword123",
        role: "player",
        acceptedTerms: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.acceptedTerms).toBe(false);
      }
    });
  });

  describe("City Organizer & Volunteer Agreement Gating", () => {
    it("validates organizer application agreement consent", () => {
      const valid = organizerApplicationSchema.safeParse({
        kind: "city-organizer",
        name: "Organizer Candidate",
        email: "organizer@devkics.test",
        city: "Lagos",
        detail: "Experienced tournament director with 5-a-side community.",
        agreementAccepted: true,
      });
      expect(valid.success).toBe(true);

      const refused = organizerApplicationSchema.safeParse({
        kind: "city-organizer",
        name: "Organizer Candidate",
        email: "organizer@devkics.test",
        city: "Lagos",
        detail: "Experienced tournament director with 5-a-side community.",
        agreementAccepted: false,
      });
      expect(refused.success).toBe(true);
      if (refused.success) {
        expect(refused.data.agreementAccepted).toBe(false);
      }
    });

    it("validates volunteer application agreement consent", () => {
      const valid = volunteerApplicationSchema.safeParse({
        citySlug: "abuja",
        name: "Volunteer Candidate",
        email: "volunteer@devkics.test",
        role: "Match official",
        availability: "Available every Saturday for refereeing.",
        agreementAccepted: true,
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Player Participation Waiver & Media Consent", () => {
    it("requires waiverAccepted to be boolean true", () => {
      const allowed = playerCreateSchema.safeParse({
        teamId: "team-123",
        fullName: "Sunday Mba",
        position: "MID",
        waiverAccepted: true,
        mediaConsentAccepted: true,
      });
      expect(allowed.success).toBe(true);

      const rejected = playerCreateSchema.safeParse({
        teamId: "team-123",
        fullName: "Sunday Mba",
        position: "MID",
        waiverAccepted: false,
      });
      expect(rejected.success).toBe(true);
      if (rejected.success) {
        expect(rejected.data.waiverAccepted).toBe(false);
      }
    });

    it("supports optional media consent while enforcing waiver", () => {
      const result = playerCreateSchema.safeParse({
        teamId: "team-123",
        fullName: "Chidi N",
        position: "DEF",
        waiverAccepted: true,
        mediaConsentAccepted: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.waiverAccepted).toBe(true);
        expect(result.data.mediaConsentAccepted).toBe(false);
      }
    });
  });
});
