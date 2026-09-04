import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionHeading } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevKics } from "@/lib/devkics/store";

const reportOptions = [
  { value: "organizations", label: "Organizations" },
  { value: "teams", label: "Teams" },
  { value: "players", label: "Players" },
  { value: "volunteers", label: "Volunteers" },
  { value: "sponsors", label: "Sponsors" },
  { value: "fixtures", label: "Fixtures & results" },
  { value: "standings", label: "Standings" },
] as const;

type ReportType = (typeof reportOptions)[number]["value"];
type ReportFormat = "csv" | "excel" | "pdf";

export function ReportsManager() {
  const { cities } = useDevKics();
  const [type, setType] = useState<ReportType>("teams");
  const [citySlug, setCitySlug] = useState("all");
  const [downloading, setDownloading] = useState<ReportFormat | null>(null);

  const downloadUrl = (format: ReportFormat) => {
    const params = new URLSearchParams({ type, format });
    if (citySlug !== "all") params.set("citySlug", citySlug);
    return `/api/reports/export?${params.toString()}`;
  };

  const download = async (format: ReportFormat) => {
    setDownloading(format);
    try {
      const response = await fetch(downloadUrl(format), { credentials: "include" });
      if (!response.ok) throw new Error("Unable to download report");
      const content = await response.blob();
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `devkics-${type}.${format === "excel" ? "xls" : format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download report");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reports"
        description="Download current operational data filtered to a city when needed."
      />
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="report-type">
            Report
          </label>
          <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
            <SelectTrigger id="report-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reportOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="report-city">
            City
          </label>
          <Select value={citySlug} onValueChange={setCitySlug}>
            <SelectTrigger id="report-city">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accessible cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.slug} value={city.slug}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={downloading !== null}
            onClick={() => void download("csv")}
          >
            <FileDown className="size-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={downloading !== null}
            onClick={() => void download("excel")}
          >
            <FileDown className="size-4" />
            Excel
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={downloading !== null}
            onClick={() => void download("pdf")}
          >
            <FileDown className="size-4" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
