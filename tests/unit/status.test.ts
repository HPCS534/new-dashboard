import {describe, expect, it} from "vitest";
import {STATUS_COLUMNS, statusLabel} from "../../src/components/status";
import {patchReplicate} from "../../src/App";
import type {Replicate, SampleRecord} from "../../src/types";

describe("status helpers", () => {
    it("defines every supported review status", () => {
        expect(STATUS_COLUMNS.map((column) => column.key)).toEqual([
            "review",
            "accepted",
            "rejected",
            "retraining",
        ]);
    });

    it("returns display labels for supported statuses", () => {
        expect(statusLabel("review")).toBe("Review");
        expect(statusLabel("accepted")).toBe("Accepted");
        expect(statusLabel("rejected")).toBe("Rejected");
        expect(statusLabel("retraining")).toBe("Retraining");
    });

    it("updates the grouped sample status when a replicate status changes", () => {
        const replicate = (id: string, reviewStatus: Replicate["reviewStatus"]): Replicate => ({
            id,
            technicianName: "Test Technician",
            createdAt: "2026-11-16T08:00:00Z",
            sampleId: "2026WS-IND-001-S01",
            aiPredictedGrains: [],
            confirmedGrains: [],
            immatureWeight: 12,
            percentage: 40,
            grade: "G1",
            reviewStatus,
            imagePublicId: id,
            imageSecureUrl: "https://example.com/image.png",
            meetsRecommendedValue: true,
            season: "2026WS",
            indexNumber: "IND-001",
            selectionName: "Local Test Selection",
            sampleNo: 1,
            replicateNo: 1,
            replicateLabel: `2026WS-IND-001-S01-${id}`,
            confidence: 0.9,
            quality: "good",
            manuallyOverridden: false,
            capturedAt: null,
            submittedAt: null,
            processingSeconds: null,
        });

        const sample: SampleRecord = {
            season: "2026WS",
            indexNumber: "IND-001",
            selectionName: "Local Test Selection",
            sampleNo: 1,
            sampleId: "2026WS-IND-001-S01",
            replicateCount: 2,
            goodCount: 2,
            status: "accepted",
            averageWeight: 12,
            averagePercentage: 40,
            averageGrade: "G1",
            meetsRecommendedValue: true,
            latestSubmittedAt: null,
            replicates: [
                {...replicate("01", "accepted"), replicateNo: 1, replicateLabel: "2026WS-IND-001-S01-01"},
                {...replicate("02", "accepted"), replicateNo: 2, replicateLabel: "2026WS-IND-001-S01-02"},
            ],
        };

        const updated = patchReplicate([sample], "01", {reviewStatus: "rejected"});

        expect(updated[0].status).toBe("review");
        expect(updated[0].replicates[0].reviewStatus).toBe("rejected");
    });
});
