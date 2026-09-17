import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { Button } from "@/components/ui/button";

describe("Phase 1 — Button Loading & Submission Protection", () => {
  it("renders standard button without loading attributes when loading is false", () => {
    const html = renderToString(React.createElement(Button, null, "Save Changes"));
    expect(html).toContain("Save Changes");
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain('disabled=""');
  });

  it("applies disabled and aria-busy when loading is true", () => {
    const html = renderToString(React.createElement(Button, { loading: true }, "Submit"));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-spin");
    expect(html).toContain("Submit");
  });

  it("renders loadingText in place of children when provided", () => {
    const html = renderToString(
      React.createElement(
        Button,
        { loading: true, loadingText: "Submitting organization..." },
        "Submit for review",
      ),
    );
    expect(html).toContain("Submitting organization...");
    expect(html).not.toContain("Submit for review");
    expect(html).toContain("animate-spin");
    expect(html).toContain('disabled=""');
  });

  it("preserves explicit disabled prop even when loading is false", () => {
    const html = renderToString(React.createElement(Button, { disabled: true }, "Disabled Button"));
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain("animate-spin");
  });
});
