import type {ReviewStatus} from "../types";

export const STATUS_COLUMNS: Array<{ key: ReviewStatus; label: string }> = [
    {key: "review", label: "Review"},
    {key: "accepted", label: "Accepted"},
    {key: "rejected", label: "Rejected"},
    {key: "retraining", label: "Retraining"},
];

export function statusLabel(status: ReviewStatus): string {
    return STATUS_COLUMNS.find((column) => column.key === status)?.label ?? status;
}
