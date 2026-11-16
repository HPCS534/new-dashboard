import {describe, expect, it} from "vitest";
import {STATUS_COLUMNS, statusLabel} from "../../src/components/status";

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
});
