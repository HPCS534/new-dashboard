import type {Replicate, ReplicateQuality} from "../types";

const EM_DASH = "\u2014";

export function qualityLabel(quality: ReplicateQuality): string {
    return quality === "good" ? "Good" : "Bad";
}

export function formatConfidence(confidence: number | null): string {
    return confidence == null ? EM_DASH : `${Math.round(confidence * 100)}%`;
}

export function replicateSuffix(record: Pick<Replicate, "replicateNo">): string {
    return `-${String(record.replicateNo).padStart(2, "0")}`;
}

export function QualityBadge({record}: { record: Pick<Replicate, "quality" | "manuallyOverridden"> }) {
    return <span className={`quality-badge ${record.quality}`}>
        {qualityLabel(record.quality)}{record.manuallyOverridden && " (override)"}
    </span>;
}