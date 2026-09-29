import type { Replicate, ReviewStatus } from "./types";

const BASE_URL = import.meta.env.DEV ? "" : import.meta.env.VITE_BACKEND_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

type BackendReviewStatus = ReviewStatus | "unreviewed" | "denied";
type BackendReplicate = Omit<Replicate, "reviewStatus"> & { reviewStatus: BackendReviewStatus };

function normalizeStatus(status: BackendReviewStatus): ReviewStatus {
  if (status === "unreviewed") return "review";
  if (status === "denied") return "rejected";
  return status;
}

function toBackendStatus(status: ReviewStatus): BackendReviewStatus {
  return status;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const detail = await response.text();
  return new Error(detail || fallback);
}

export async function fetchReplicates(): Promise<Replicate[]> {
  const response = await fetch(`${BASE_URL}/api/replicates`, {
    headers: { "X-API-Key": API_KEY },
  });

  if (!response.ok) throw await responseError(response, "Failed to fetch replicates");

  const records = await response.json() as BackendReplicate[];
  return records.map((record) => ({ ...record, reviewStatus: normalizeStatus(record.reviewStatus) }));
}

export function imageUrl(replicateId: string): string {
  return `${BASE_URL}/api/images/${encodeURIComponent(replicateId)}`;
}

export async function fetchImage(replicateId: string): Promise<string> {
  const response = await fetch(imageUrl(replicateId), {
    headers: { "X-API-Key": API_KEY },
  });

  if (!response.ok) throw await responseError(response, "Failed to fetch image");

  return URL.createObjectURL(await response.blob());
}

export async function updateStatus(
  replicateId: string,
  status: ReviewStatus,
): Promise<Pick<Replicate, "id" | "reviewStatus">> {
  const response = await fetch(`${BASE_URL}/api/replicates/${replicateId}/status`, {
    method: "PATCH",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });

  if (!response.ok) throw await responseError(response, "Failed to update status");

  const updated = await response.json() as { id: string; reviewStatus: BackendReviewStatus };
  return { ...updated, reviewStatus: normalizeStatus(updated.reviewStatus) };
}
