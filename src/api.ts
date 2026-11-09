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