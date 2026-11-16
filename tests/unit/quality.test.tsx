import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";
import {formatConfidence, QualityBadge, qualityLabel, replicateSuffix} from "../../src/components/Quality";

describe("quality helpers", () => {
    it("formats quality labels and confidence percentages", () => {
        expect(qualityLabel("good")).toBe("Good");
        expect(qualityLabel("bad")).toBe("Bad");
        expect(formatConfidence(0.856)).toBe("86%");
        expect(formatConfidence(null)).toBe("—");
    });

    it("formats replicate suffixes with two digits", () => {
        expect(replicateSuffix({replicateNo: 1})).toBe("-01");
        expect(replicateSuffix({replicateNo: 12})).toBe("-12");
    });

    it("shows a manual override marker", () => {
        render(<QualityBadge record={{quality: "good", manuallyOverridden: true}}/>);

        expect(screen.getByText("Good (override)")).toBeInTheDocument();
    });
});
