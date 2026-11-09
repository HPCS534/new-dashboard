import type {Replicate, ReviewStatus} from "./types";
import {supabase} from "./supabase";

const BASE_URL = import.meta.env.DEV ? "" : import.meta.env.VITE_BACKEND_URL;

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const {data} = await supabase.auth.getSession();
    return {
        ...(data.session ? {Authorization: `Bearer ${data.session.access_token}`} : {}),
        ...extra,
    };
}

async function responseError(response: Response, fallback: string): Promise<Error> {
    const detail = await response.text();
    return new Error(detail || fallback);
}

export async function fetchReplicates(): Promise<Replicate[]> {
    const response = await fetch(`${BASE_URL}/api/replicates`, {headers: await authHeaders()});
    if (!response.ok) {
        throw await responseError(response, "Failed to fetch replicates");
    }
    return (await response.json()) as Replicate[];
}

function fileNameFromDisposition(header: string | null): string | null {
    if (!header) return null;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
    return match ? decodeURIComponent(match[1].trim()) : null;
}

export async function downloadReplicatesCsv(): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/replicates/export`, {headers: await authHeaders()});
    if (!response.ok) {
        throw await responseError(response, "Failed to export CSV");
    }
    const blob = await response.blob();
    const fallbackName = `granular-records-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
    const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export async function updateStatus(replicateId: string, status: ReviewStatus,): Promise<Pick<Replicate, "id" | "reviewStatus">> {
    const response = await fetch(`${BASE_URL}/api/replicates/${encodeURIComponent(replicateId)}/status`, {
        method: "PATCH",
        headers: await authHeaders({"Content-Type": "application/json"}),
        body: JSON.stringify({status}),
    },);
    if (!response.ok) {
        throw await responseError(response, "Failed to update status");
    }
    return (await response.json()) as { id: string; reviewStatus: ReviewStatus; };
}
