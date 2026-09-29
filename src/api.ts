import type {Replicate, ReviewStatus} from "./types";

const BASE_URL = import.meta.env.DEV ? "" : import.meta.env.VITE_BACKEND_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

async function responseError(response: Response, fallback: string): Promise<Error> {
    const detail = await response.text();
    return new Error(detail || fallback);
}

export async function fetchReplicates(): Promise<Replicate[]> {
    const response = await fetch(`${BASE_URL}/api/replicates`, {headers: {"X-API-Key": API_KEY,},});
    if (!response.ok) {
        throw await responseError(response, "Failed to fetch replicates");
    }
    return (await response.json()) as Replicate[];
}

export async function fetchImage(replicateId: string): Promise<string> {
    const response = await fetch(`${BASE_URL}/api/images/${encodeURIComponent(replicateId)}`, {headers: {"X-API-Key": API_KEY,},},);
    if (!response.ok) {
        throw await responseError(response, "Failed to fetch image");
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

export async function updateStatus(replicateId: string, status: ReviewStatus,): Promise<Pick<Replicate, "id" | "reviewStatus">> {
    const response = await fetch(`${BASE_URL}/api/replicates/${encodeURIComponent(replicateId)}/status`, {
        method: "PATCH",
        headers: {"X-API-Key": API_KEY, "Content-Type": "application/json",},
        body: JSON.stringify({status}),
    },);
    if (!response.ok) {
        throw await responseError(response, "Failed to update status");
    }
    return (await response.json()) as { id: string; reviewStatus: ReviewStatus; };
}