export type ReviewStatus = "review" | "accepted" | "rejected" | "retraining";

export interface GrainBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number | null;
  action: "kept" | "removed" | "added" | null;
}

export interface Replicate {
  id: string;
  technicianName: string;
  createdAt: string;
  sampleId: string;
  aiPredictedGrains: GrainBox[];
  confirmedGrains: GrainBox[];
  immatureWeight: number;
  percentage: number;
  grade: string;
  reviewStatus: ReviewStatus;
  imagePublicId: string;
  imageSecureUrl: string;
  meetsRecommendedValue: boolean;
  season: string | null;
  indexNumber: string | null;
  selectionName: string | null;
  sampleNo: number | null;
  capturedAt: string | null;
  submittedAt: string | null;
  processingSeconds: number | null;
}
