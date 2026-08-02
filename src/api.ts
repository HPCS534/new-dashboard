import type { Replicate } from "./types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

export async function fetchReplicates(): Promise<Replicate[]> {
  const response = await fetch(`${BASE_URL}/api/replicates`, {
    headers: { "X-API-Key": API_KEY },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch replicates");
  }

  return response.json() as Promise<Replicate[]>;
}

export function imageUrl(replicateId: string): string {
  return `${BASE_URL}/api/images/${replicateId}?api_key=${API_KEY}`;
}

export async function updateStatus(
  replicateId: string,
  status: "accepted" | "denied",
): Promise<Pick<Replicate, "id" | "reviewStatus">> {
  const response = await fetch(`${BASE_URL}/api/replicates/${replicateId}/status`, {
    method: "PATCH",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Failed to update status");
  }

  return response.json() as Promise<Pick<Replicate, "id" | "reviewStatus">>;
}
