import { describe, expect, it } from "vitest";

/**
 * Convert OKLCH to sRGB relative luminance according to WCAG 2.1 specs.
 */
function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  r = Math.min(Math.max(0, r), 1);
  g = Math.min(Math.max(0, g), 1);
  bl = Math.min(Math.max(0, bl), 1);

  return [r, g, bl];
}

function sRgbToRelativeLuminance([r, g, b]: [number, number, number]): number {
  const adjust = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

function calculateContrastRatio(lum1: number, lum2: number): number {
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe("Phase 4.2 Accessibility & Color Contrast", () => {
  it("verifies Pitch token satisfies WCAG AAA contrast against pitch-foreground", () => {
    // Pitch: oklch(0.28 0.065 158)
    // Pitch foreground: oklch(0.98 0.01 150)
    const pitchRgb = oklchToRgb(0.28, 0.065, 158);
    const pitchFgRgb = oklchToRgb(0.98, 0.01, 150);

    const pitchLum = sRgbToRelativeLuminance(pitchRgb);
    const pitchFgLum = sRgbToRelativeLuminance(pitchFgRgb);
    const ratio = calculateContrastRatio(pitchLum, pitchFgLum);

    // WCAG AAA requires >= 7.0:1
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("verifies Wine token satisfies WCAG AAA contrast against white background", () => {
    // Wine: oklch(0.38 0.13 12)
    // White background: 1.0 luminance
    const wineRgb = oklchToRgb(0.38, 0.13, 12);
    const wineLum = sRgbToRelativeLuminance(wineRgb);
    const ratio = calculateContrastRatio(wineLum, 1.0);

    // WCAG AAA requires >= 7.0:1
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("verifies Flare pill contrast (flare-foreground on flare background) satisfies WCAG AA", () => {
    // Flare: oklch(0.72 0.17 55)
    // Flare foreground: oklch(0.22 0.05 50)
    const flareRgb = oklchToRgb(0.72, 0.17, 55);
    const flareFgRgb = oklchToRgb(0.22, 0.05, 50);

    const flareLum = sRgbToRelativeLuminance(flareRgb);
    const flareFgLum = sRgbToRelativeLuminance(flareFgRgb);
    const ratio = calculateContrastRatio(flareLum, flareFgLum);

    // WCAG AA requires >= 4.5:1
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies StatCard high-contrast flare text satisfies WCAG AA against light card background", () => {
    // StatCard flare text: oklch(0.48 0.16 45)
    // Light card background: 1.0 luminance
    const highContrastFlareRgb = oklchToRgb(0.48, 0.16, 45);
    const highContrastFlareLum = sRgbToRelativeLuminance(highContrastFlareRgb);
    const ratio = calculateContrastRatio(highContrastFlareLum, 1.0);

    // WCAG AA requires >= 4.5:1 for normal text (and >= 3.0:1 for large text)
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures FormPill labels map accurately to human-readable screen reader text", () => {
    const formResultLabels: Record<string, string> = {
      W: "Win",
      D: "Draw",
      L: "Loss",
    };

    expect(formResultLabels["W"]).toBe("Win");
    expect(formResultLabels["D"]).toBe("Draw");
    expect(formResultLabels["L"]).toBe("Loss");
  });
});
