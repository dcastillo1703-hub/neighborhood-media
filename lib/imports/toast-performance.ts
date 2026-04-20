"use client";

import type { ToastPerformanceImport, ToastImportedMetric, ToastImportFileType, WeeklyMetric } from "@/types";

type ParsedImportRow = Record<string, unknown>;

const headerAliases = {
  weekLabel: ["week", "week label", "date", "business date", "service date", "period", "label"],
  covers: ["covers", "guests", "guest count", "guest covers"],
  netSales: ["net sales", "sales", "revenue", "net revenue"],
  totalOrders: ["orders", "total orders", "checks", "tables", "transactions"],
  notes: ["notes", "note", "comments", "comment"],
  campaignAttribution: ["campaign attribution", "attribution", "campaign"],
  campaignId: ["campaign id"]
} satisfies Record<string, string[]>;

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeaderKey(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header)
  }));

  return normalizedHeaders.find((header) => aliases.includes(header.normalized))?.original;
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,%\s,]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function coerceString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function detectFileType(file: File): ToastImportFileType | null {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return "csv";
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return "xlsx";
  }

  if (lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

async function parseSpreadsheetRows(file: File) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json<ParsedImportRow>(sheet, {
    defval: "",
    raw: false
  });
}

async function parsePdfRows(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer)
  });
  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (pageText) {
      textParts.push(pageText);
    }
  }

  const joinedText = textParts.join("\n");
  const lineMatches = joinedText.match(/[A-Za-z]{3,9}\s+\d{1,2}[^\n]*?\d[\d,]*(?:\.\d{2})?[^\n]*/g) ?? [];
  const rows = lineMatches.map<ParsedImportRow>((line) => {
    const match =
      line.match(/^([A-Za-z]{3,9}\s+\d{1,2}.*?)\s+(\d{1,4})\s+\$?([\d,]+(?:\.\d{2})?)\s+(\d{1,4})/) ??
      line.match(/^([A-Za-z]{3,9}\s+\d{1,2}.*?)\s+(\d{1,4})\s+\$?([\d,]+(?:\.\d{2})?)/);

    return {
      weekLabel: match?.[1] ?? line,
      covers: match?.[2] ?? "",
      netSales: match?.[3] ?? "",
      totalOrders: match?.[4] ?? ""
    };
  });

  return {
    rows,
    textPreview: joinedText.slice(0, 600)
  };
}

function normalizeRowsToMetrics(rows: ParsedImportRow[]) {
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const weekLabelHeader = findHeaderKey(headers, headerAliases.weekLabel) ?? "weekLabel";
  const coversHeader = findHeaderKey(headers, headerAliases.covers) ?? "covers";
  const netSalesHeader = findHeaderKey(headers, headerAliases.netSales);
  const totalOrdersHeader = findHeaderKey(headers, headerAliases.totalOrders);
  const notesHeader = findHeaderKey(headers, headerAliases.notes);
  const campaignAttributionHeader = findHeaderKey(headers, headerAliases.campaignAttribution);
  const campaignIdHeader = findHeaderKey(headers, headerAliases.campaignId);

  const metrics = rows.reduce<ToastImportedMetric[]>((nextMetrics, row, index) => {
    const weekLabel = coerceString(row[weekLabelHeader]);
    const covers = coerceNumber(row[coversHeader]);

    if (!weekLabel || covers === undefined) {
      return nextMetrics;
    }

    nextMetrics.push({
      sourceRowNumber: index + 2,
      weekLabel,
      covers,
      netSales: netSalesHeader ? coerceNumber(row[netSalesHeader]) : undefined,
      totalOrders: totalOrdersHeader ? coerceNumber(row[totalOrdersHeader]) : undefined,
      notes: notesHeader ? coerceString(row[notesHeader]) : undefined,
      campaignAttribution: campaignAttributionHeader ? coerceString(row[campaignAttributionHeader]) : undefined,
      campaignId: campaignIdHeader ? coerceString(row[campaignIdHeader]) || undefined : undefined
    });

    return nextMetrics;
  }, []);

  return {
    metrics,
    missingFields: [
      netSalesHeader ? null : "Net sales",
      totalOrdersHeader ? null : "Total orders / tables"
    ].filter(Boolean) as string[]
  };
}

export function compareImportedMetrics(currentMetrics: WeeklyMetric[], importedMetrics: ToastImportedMetric[]) {
  const currentMap = new Map(currentMetrics.map((metric) => [metric.weekLabel, metric]));
  const importedMap = new Map(importedMetrics.map((metric) => [metric.weekLabel, metric]));

  const updatedMetrics = importedMetrics.filter((metric) => {
    const existing = currentMap.get(metric.weekLabel);

    if (!existing) {
      return false;
    }

    return (
      existing.covers !== metric.covers ||
      (existing.netSales ?? null) !== (metric.netSales ?? null) ||
      (existing.totalOrders ?? null) !== (metric.totalOrders ?? null) ||
      (existing.notes ?? "") !== (metric.notes ?? "")
    );
  });

  const addedMetrics = importedMetrics.filter((metric) => !currentMap.has(metric.weekLabel));
  const removedMetrics = currentMetrics.filter((metric) => !importedMap.has(metric.weekLabel));

  return {
    addedMetrics,
    updatedMetrics,
    removedMetrics
  };
}

export async function parseToastPerformanceFile(
  file: File,
  clientId: string,
  currentMetrics: WeeklyMetric[]
): Promise<ToastPerformanceImport> {
  const fileType = detectFileType(file);

  if (!fileType) {
    throw new Error("Only CSV, XLSX, XLS, and PDF files are supported.");
  }

  let rows: ParsedImportRow[] = [];
  const warnings: string[] = [];
  let textPreview: string | undefined;

  if (fileType === "pdf") {
    const parsed = await parsePdfRows(file);
    rows = parsed.rows;
    textPreview = parsed.textPreview;
    warnings.push("PDF parsing is best-effort only. Review every field before applying.");
  } else {
    rows = await parseSpreadsheetRows(file);
  }

  const { metrics, missingFields } = normalizeRowsToMetrics(rows);
  const comparison = compareImportedMetrics(currentMetrics, metrics);
  const totalCovers = metrics.reduce((sum, metric) => sum + metric.covers, 0);
  const totalNetSales = metrics.reduce((sum, metric) => sum + (metric.netSales ?? 0), 0);
  const totalOrders = metrics.reduce((sum, metric) => sum + (metric.totalOrders ?? 0), 0);

  if (!metrics.length) {
    warnings.push("No valid metric rows were detected. Check the file columns before applying.");
  }

  if (missingFields.length) {
    warnings.push("Some fields could not be detected automatically and will stay blank.");
  }

  const confidence =
    fileType === "pdf"
      ? "Low"
      : missingFields.length
        ? "Medium"
        : "High";

  const periodStart = metrics[0]?.weekLabel;
  const periodEnd = metrics[metrics.length - 1]?.weekLabel;

  return {
    id: `toast-import-${Date.now()}`,
    clientId,
    fileName: file.name,
    fileType,
    uploadedAt: new Date().toISOString(),
    status: "staged",
    reportingPeriodLabel:
      periodStart && periodEnd
        ? periodStart === periodEnd
          ? periodStart
          : `${periodStart} to ${periodEnd}`
        : `${rows.length} row${rows.length === 1 ? "" : "s"} detected`,
    rawSnapshot: {
      fileSize: file.size,
      rowCount: rows.length,
      textPreview
    },
    parsedSnapshot: {
      metrics,
      totals: {
        covers: totalCovers,
        netSales: totalNetSales,
        totalOrders
      }
    },
    review: {
      confidence,
      warnings,
      missingFields,
      addedCount: comparison.addedMetrics.length,
      updatedCount: comparison.updatedMetrics.length,
      removedCount: comparison.removedMetrics.length
    }
  };
}
