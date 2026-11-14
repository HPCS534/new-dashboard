export type ReviewStatus = "review" | "accepted" | "rejected" | "retraining";

export type ReplicateQuality = "good" | "bad";

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
    replicateNo: number;
    replicateLabel: string;
    confidence: number | null;
    quality: ReplicateQuality;
    manuallyOverridden: boolean;
    capturedAt: string | null;
    submittedAt: string | null;
    processingSeconds: number | null;
}

export interface SampleRecord {
    season: string | null;
    indexNumber: string | null;
    selectionName: string | null;
    sampleNo: number | null;
    sampleId: string;
    replicateCount: number;
    goodCount: number;
    status: ReviewStatus;
    averageWeight: number | null;
    averagePercentage: number | null;
    averageGrade: string | null;
    meetsRecommendedValue: boolean | null;
    latestSubmittedAt: string | null;
    replicates: Replicate[];
}

export interface OverrideResult {
    id: string;
    manuallyOverridden: boolean;
    quality: ReplicateQuality;
    reviewStatus: ReviewStatus;
}