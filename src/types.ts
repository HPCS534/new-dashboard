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
  reviewStatus: "unreviewed" | "accepted" | "denied";
}
