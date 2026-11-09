import type {Replicate} from "./types";

const CSV_COLUMNS: Array<{label: string; value: (record: Replicate) => string | number | boolean | null | undefined}> = [
    {label: "ID", value: (record) => record.id},
    {label: "Sample ID", value: (record) => record.sampleId},
    {label: "Season", value: (record) => record.season},
    {label: "Index Number", value: (record) => record.indexNumber},
    {label: "Selection Name", value: (record) => record.selectionName},
    {label: "Sample Number", value: (record) => record.sampleNo},
    {label: "Technician", value: (record) => record.technicianName},
    {label: "Captured At", value: (record) => record.capturedAt},
    {label: "Submitted At", value: (record) => record.submittedAt},
    {label: "Saved At", value: (record) => record.createdAt},
    {label: "Immature Weight", value: (record) => record.immatureWeight},
    {label: "Percentage", value: (record) => record.percentage},
    {label: "Grade", value: (record) => record.grade},
    {label: "Meets Recommended Value", value: (record) => record.meetsRecommendedValue},
    {label: "Review Status", value: (record) => record.reviewStatus},
    {label: "AI Predicted Grains", value: (record) => JSON.stringify(record.aiPredictedGrains)},
    {label: "Confirmed Grains", value: (record) => JSON.stringify(record.confirmedGrains)},
];

function quoteCsv(value: string | number | boolean | null | undefined): string {
    const text = value == null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(records: Replicate[]): void {
    const rows = [
        CSV_COLUMNS.map((column) => quoteCsv(column.label)).join(","),
        ...records.map((record) => CSV_COLUMNS.map((column) => quoteCsv(column.value(record))).join(",")),
    ];
    const blob = new Blob(["\uFEFF", rows.join("\r\n") + "\r\n"], {type: "text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    link.href = url;
    link.download = `granular-records-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
