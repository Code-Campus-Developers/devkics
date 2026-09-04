import { describe, expect, it } from "vitest";

import { toCsv, toExcelXml, toPdf } from "@/lib/server/reports";

const report = {
  title: "Teams report",
  columns: ["Team", "Status"],
  rows: [["=SUM(A1:A2)", "APPROVED"]],
};

describe("report serializers", () => {
  it("prevents spreadsheet formula execution in CSV and Excel exports", () => {
    expect(toCsv(report)).toContain("'=SUM(A1:A2)");
    expect(toExcelXml(report)).toContain("'=SUM(A1:A2)");
  });

  it("generates a PDF document for report rows", () => {
    expect(toPdf(report)).toMatch(/^%PDF-1\.4/);
  });
});
