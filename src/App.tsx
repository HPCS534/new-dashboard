import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {
    ArrowDownAZ,
    ArrowUpAZ,
    Columns3,
    Download,
    GripVertical,
    LayoutList,
    LogOut,
    Minus,
    Plus,
    Search,
    X
} from "lucide-react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {downloadReplicatesCsv, fetchSamples, setManualOverride, updateStatus} from "./api";
import {AuthGate} from "./AuthGate";
import {supabase} from "./supabase";
import type {GrainBox, Replicate, ReviewStatus, SampleRecord} from "./types";
import {StatusPicker, StatusPill, type StatusPickerState} from "./components/StatusPicker";
import {STATUS_COLUMNS, statusLabel} from "./components/status";
import {formatConfidence, QualityBadge, qualityLabel, replicateSuffix} from "./components/Quality.tsx";
import "./App.css";

type View = "row" | "kanban";
type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";
type Filter = "all" | ReviewStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
    {key: "all", label: "All"},
    {key: "review", label: "Review"},
    {key: "accepted", label: "Accepted"},
    {key: "rejected", label: "Has rejected"},
    {key: "retraining", label: "Has retraining"},
];

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

const EM_DASH = "\u2014";

function captureTime(record: Replicate): string {
    return record.capturedAt ?? record.createdAt;
}

function formatOptionalDate(value: string | null): string {
    return value ? formatDate(value) : EM_DASH;
}

function formatSampleNo(record: { sampleNo: number | null }): string {
    return record.sampleNo ? `${record.sampleNo} of 2` : EM_DASH;
}

function formatProcessing(record: Replicate): string {
    if (!record.capturedAt || !record.submittedAt) return EM_DASH;
    const total = (new Date(record.submittedAt).getTime() - new Date(record.capturedAt).getTime()) / 1000;
    if (!Number.isFinite(total) || total < 0) return EM_DASH;
    if (total < 60) return `${total.toFixed(1)} s`;
    const minutes = Math.floor(total / 60);
    return `${minutes} min ${(total - minutes * 60).toFixed(0)} s`;
}

function formatGrade(grade: string): string {
    return grade === "Below Standard" ? "Not classified" : grade;
}

function sampleKey(sample: SampleRecord): string {
    return `${sample.season ?? ""}|${sample.indexNumber ?? ""}|${sample.sampleNo ?? ""}`;
}

function sampleCaptureTime(sample: SampleRecord): string {
    return sample.replicates.map(captureTime).reduce((latest, value) => new Date(value).getTime() > new Date(latest).getTime() ? value : latest);
}

function sampleTechnicians(sample: SampleRecord): string {
    return [...new Set(sample.replicates.map((record) => record.technicianName))].join(", ");
}

function formatSampleResult(sample: SampleRecord): string {
    if (sample.averageGrade == null || sample.averagePercentage == null) return "Pending";
    return `${formatGrade(sample.averageGrade)} \u00b7 ${sample.averagePercentage.toFixed(1)}%`;
}

function matchesFilter(sample: SampleRecord, filter: Filter): boolean {
    if (filter === "all") return true;
    if (filter === "review" || filter === "accepted") return sample.status === filter;
    return sample.replicates.some((record) => record.reviewStatus === filter);
}

function findSiblingSample(sample: SampleRecord, samples: SampleRecord[]): SampleRecord | null {
    if (!sample.season || !sample.indexNumber) return null;
    return samples.find((other) => sampleKey(other) !== sampleKey(sample) && other.season === sample.season && other.indexNumber === sample.indexNumber) ?? null;
}

export function patchReplicate(samples: SampleRecord[] = [], id: string, patch: Partial<Replicate>): SampleRecord[] {
    return samples.map((sample) => {
        if (!sample.replicates.some((record) => record.id === id)) return sample;

        const replicates = sample.replicates.map((record) => record.id === id ? {...record, ...patch} : record);
        const acceptedCount = replicates.filter((record) => record.reviewStatus === "accepted").length;

        return {
            ...sample,
            replicates,
            status: acceptedCount >= 2 ? "accepted" : "review",
        };
    });
}

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6];

function GrainCanvas({image, grains, color, zoom}: {
    image: HTMLImageElement;
    grains: GrainBox[];
    color?: string;
    zoom: number
}) {
    const width = image.naturalWidth || image.width || 1;
    const height = image.naturalHeight || image.height || 1;

    return <div className="grain-stage"
                style={{
                    position: "relative",
                    width: `${zoom * 100}%`,
                    aspectRatio: `${width} / ${height}`,
                    justifySelf: "start",
                    alignSelf: "start"
                }}>
        <img src={image.src} alt=""
             style={{display: "block", width: "100%", height: "100%", objectFit: "contain", background: "#000"}}/>
        {grains.map((grain, index) => {
            const left = (grain.x / width) * 100;
            const top = (grain.y / height) * 100;
            const boxWidth = (grain.width / width) * 100;
            const boxHeight = (grain.height / height) * 100;

            return <div key={`${grain.x}-${grain.y}-${index}`}
                        title={grain.confidence != null ? `${Math.round(grain.confidence * 100)}% immature` : (grain.action ?? undefined)}
                        style={{
                            position: "absolute",
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${boxWidth}%`,
                            height: `${boxHeight}%`,
                            border: `${zoom > 1 ? 2 : 1}px solid ${color ?? "#2f6f5e"}`,
                            boxSizing: "border-box",
                            borderRadius: 2,
                            background: "transparent",
                        }}/>;
        })}
    </div>;
}

function TierPanel({image, failed, grains, color, caption}: {
    image: HTMLImageElement | null;
    failed: boolean;
    grains: GrainBox[];
    color?: string;
    caption: string
}) {
    const [zoomIndex, setZoomIndex] = useState(0);
    const zoom = ZOOM_LEVELS[zoomIndex];
    const frameRef = useRef<HTMLDivElement>(null);
    const center = useRef<{ x: number; y: number } | null>(null);

    const changeZoom = (next: number) => {
        const frame = frameRef.current;
        if (frame) {
            center.current = {
                x: (frame.scrollLeft + frame.clientWidth / 2) / frame.scrollWidth,
                y: (frame.scrollTop + frame.clientHeight / 2) / frame.scrollHeight,
            };
        }
        setZoomIndex(next);
    };
    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame || !center.current) return;
        frame.scrollLeft = center.current.x * frame.scrollWidth - frame.clientWidth / 2;
        frame.scrollTop = center.current.y * frame.scrollHeight - frame.clientHeight / 2;
        center.current = null;
    }, [zoomIndex]);

    const width = image ? image.naturalWidth || image.width || 1 : 1;
    const height = image ? image.naturalHeight || image.height || 1 : 1;

    return <figure className="tier-cell">
        <div className="tier-viewport">
            <div className="tier-frame" ref={frameRef}
                 style={image ? {aspectRatio: `${width} / ${height}`} : undefined}>
                {failed ? <p className="image-message">Image unavailable</p>
                    : !image ? <p className="image-message">Loading image...</p>
                        : <GrainCanvas image={image} grains={grains} color={color} zoom={zoom}/>}
            </div>
            {image && <div className="zoom-controls" role="group" aria-label={`Zoom ${caption}`}>
                <button className="zoom-button" type="button" aria-label="Zoom out" disabled={zoomIndex === 0}
                        onClick={() => changeZoom(zoomIndex - 1)}><Minus size={16}/></button>
                <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button className="zoom-button" type="button" aria-label="Zoom in"
                        disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                        onClick={() => changeZoom(zoomIndex + 1)}><Plus size={16}/></button>
            </div>}
        </div>
        <figcaption>{caption}</figcaption>
    </figure>;
}

function ImageTiers({record}: { record: Replicate }) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let cancelled = false;

        setImage(null);
        setFailed(false);

        const source = new Image();
        source.onload = () => {
            if (!cancelled) setImage(source);
        };
        source.onerror = () => {
            if (!cancelled) setFailed(true);
        };
        source.src = record.imageSecureUrl;

        return () => {
            cancelled = true;
            source.onload = null;
            source.onerror = null;
        };
    }, [record.imageSecureUrl]);

    const correctedGrains = record.confirmedGrains.filter((grain) => grain.action !== "removed");
    return (<>
        <div className="overlay-legend" aria-label="Bounding-box legend"><span> <i className="legend-swatch ai"/> AI box </span>
            <span> <i className="legend-swatch reviewer"/> Reviewer correction </span></div>
        <div className="tier-grid">
            <TierPanel image={image} failed={failed} grains={[]} caption="Raw input"/>
            <TierPanel image={image} failed={failed} grains={record.aiPredictedGrains} color="#2f6f5e"
                       caption={`AI prediction (${record.aiPredictedGrains.length})`}/>
            <TierPanel image={image} failed={failed} grains={correctedGrains} color="#b5750d"
                       caption={`Reviewer correction (${correctedGrains.length})`}/>
        </div>
    </>);
}

function PhotoChips({sample}: { sample: SampleRecord }) {
    return <div className="photo-chips">
        {sample.replicates.map((record) => {
            const text = [replicateSuffix(record), qualityLabel(record.quality), formatGrade(record.grade), formatConfidence(record.confidence)].join(" \u00b7 ");
            return <span key={record.id} className={`photo-chip ${record.quality}`}
                         title={`${record.replicateLabel}: ${text}`}>{text}</span>;
        })}
    </div>;
}

function SampleStatusBadge({sample}: { sample: SampleRecord }) {
    return <span className={`status-pill static ${sample.status}`}>{statusLabel(sample.status)}</span>;
}

function DetailOverlay({
                           sample,
                           record,
                           sibling,
                           isOverriding,
                           onClose,
                           onOpenStatus,
                           onSelectReplicate,
                           onToggleOverride,
                           onOpenSibling
                       }: {
    sample: SampleRecord;
    record: Replicate;
    sibling: SampleRecord | null;
    isOverriding: boolean;
    onClose: () => void;
    onOpenStatus: (anchor: HTMLElement, record: Replicate) => void;
    onSelectReplicate: (record: Replicate) => void;
    onToggleOverride: (record: Replicate) => void;
    onOpenSibling: (sample: SampleRecord) => void;
}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);
    return <div className="detail-overlay open" role="presentation" onMouseDown={onClose}>
        <section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title"
                 onMouseDown={(event) => event.stopPropagation()}>
            <header className="detail-header">
                <div><h2 id="detail-title">Sample detail</h2><p>{sample.sampleId}</p></div>
                <button className="icon-button" type="button" aria-label="Close sample detail" onClick={onClose}><X
                    size={20} aria-hidden="true"/></button>
            </header>
            <div className="detail-body">
                <h3 className="section-title">Sample summary</h3>
                <dl className="record-metadata">
                    <div>
                        <dt>Sample ID</dt>
                        <dd>{sample.sampleId}</dd>
                    </div>
                    <div>
                        <dt>Sample</dt>
                        <dd>{formatSampleNo(sample)}</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd><SampleStatusBadge sample={sample}/></dd>
                    </div>
                    <div>
                        <dt>Season</dt>
                        <dd>{sample.season ?? EM_DASH}</dd>
                    </div>
                    <div>
                        <dt>Index no.</dt>
                        <dd>{sample.indexNumber ?? EM_DASH}</dd>
                    </div>
                    <div>
                        <dt>Selection name</dt>
                        <dd>{sample.selectionName ?? EM_DASH}</dd>
                    </div>
                    <div>
                        <dt>Photos</dt>
                        <dd>{sample.replicateCount} ({sample.goodCount} good)</dd>
                    </div>
                    <div>
                        <dt>Average weight</dt>
                        <dd>{sample.averageWeight == null ? EM_DASH : `${sample.averageWeight} g`}</dd>
                    </div>
                    <div>
                        <dt>Average percentage</dt>
                        <dd>{sample.averagePercentage == null ? EM_DASH : `${sample.averagePercentage.toFixed(1)}%`}</dd>
                    </div>
                    <div>
                        <dt>Average grade</dt>
                        <dd>{sample.averageGrade == null ? "Pending" : formatGrade(sample.averageGrade)}</dd>
                    </div>
                    <div>
                        <dt>Recommended value</dt>
                        <dd>{sample.meetsRecommendedValue == null ? EM_DASH : sample.meetsRecommendedValue ? "Meets (below 2.0%)" : "Does not meet"}</dd>
                    </div>
                </dl>
                {sample.status !== "accepted" && <p className="override-hint">
                    The average is calculated automatically once the sample has 2 good (or manually overridden) photos.
                </p>}

                <h3 className="section-title">Photos</h3>
                <div className="photo-tabs" role="tablist" aria-label="Photos of this sample">
                    {sample.replicates.map((photo) => <button key={photo.id} type="button" role="tab"
                                                              aria-selected={photo.id === record.id}
                                                              className={`photo-tab ${photo.id === record.id ? "active" : ""}`}
                                                              onClick={() => onSelectReplicate(photo)}>
                        <span>{replicateSuffix(photo)}</span><QualityBadge record={photo}/>
                    </button>)}
                </div>

                <ImageTiers key={record.id} record={record}/>
                <dl className="record-metadata">
                    <div>
                        <dt>Replicate</dt>
                        <dd>{record.replicateLabel}</dd>
                    </div>
                    <div>
                        <dt>Quality</dt>
                        <dd><QualityBadge record={record}/></dd>
                    </div>
                    <div>
                        <dt>Confidence</dt>
                        <dd>{formatConfidence(record.confidence)}</dd>
                    </div>
                    <div>
                        <dt>Grade</dt>
                        <dd>{formatGrade(record.grade)}</dd>
                    </div>
                    <div>
                        <dt>Immature weight</dt>
                        <dd>{record.immatureWeight} g</dd>
                    </div>
                    <div>
                        <dt>Percentage</dt>
                        <dd>{record.percentage.toFixed(1)}%</dd>
                    </div>
                    <div>
                        <dt>Technician</dt>
                        <dd>{record.technicianName}</dd>
                    </div>
                    <div>
                        <dt>Captured</dt>
                        <dd>{formatOptionalDate(record.capturedAt)}</dd>
                    </div>
                    <div>
                        <dt>Submitted</dt>
                        <dd>{formatOptionalDate(record.submittedAt)}</dd>
                    </div>
                    <div>
                        <dt>Processing time</dt>
                        <dd>{formatProcessing(record)}</dd>
                    </div>
                    <div>
                        <dt>Saved</dt>
                        <dd>{formatDate(record.createdAt)}</dd>
                    </div>
                    <div>
                        <dt>Recommended value</dt>
                        <dd>{record.meetsRecommendedValue == null ? EM_DASH : record.meetsRecommendedValue ? "Meets (below 2.0%)" : "Does not meet"}</dd>
                    </div>
                    <div>
                        <dt>Record ID</dt>
                        <dd>{record.id}</dd>
                    </div>
                </dl>
                <button className={`override-button ${record.manuallyOverridden ? "active" : ""}`} type="button"
                        aria-pressed={record.manuallyOverridden} disabled={isOverriding}
                        onClick={() => onToggleOverride(record)}>
                    {record.manuallyOverridden ? "Remove manual override" : "Override: mark this photo as good"}
                </button>
                <p className="override-hint">A photo is good when its confidence is high enough or it has been manually
                    overridden.</p>
                {sibling && <button className="sibling-link" type="button" onClick={() => onOpenSibling(sibling)}>
                    View other sample of this entry ({formatSampleNo(sibling)}: {sibling.sampleId})
                </button>}
            </div>
            <footer className="detail-footer"><span>Photo status ({replicateSuffix(record)})</span><StatusPill
                record={record} onOpen={onOpenStatus}/>
            </footer>
        </section>
    </div>;
}

function SampleCard({sample, onOpen}: { sample: SampleRecord; onOpen: (sample: SampleRecord) => void }) {
    return <article className="record-card" tabIndex={0} onClick={() => onOpen(sample)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(sample);
        }
    }}>
        <div className="record-card-top"><strong>{sample.sampleId}</strong><SampleStatusBadge sample={sample}/></div>
        <p>{sampleTechnicians(sample)}</p>
        {sample.indexNumber && <p>{sample.season} · Index {sample.indexNumber} · Sample {formatSampleNo(sample)}</p>}
        <p>Result: {formatSampleResult(sample)}</p>
        <PhotoChips sample={sample}/>
        <span>{formatDate(sampleCaptureTime(sample))}</span>
    </article>;
}

function KanbanCard({record, onOpen, onOpenStatus, onDragStart, onDragEnd}: {
    record: Replicate;
    onOpen: (record: Replicate) => void;
    onOpenStatus: (anchor: HTMLElement, record: Replicate) => void;
    onDragStart: (event: React.DragEvent<HTMLElement>, record: Replicate) => void;
    onDragEnd: () => void;
}) {
    const didDrag = useRef(false);
    return <article className="kanban-card" draggable tabIndex={0} onDragStart={(event) => {
        didDrag.current = true;
        onDragStart(event, record);
    }} onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
            didDrag.current = false;
        }, 0);
    }} onClick={(event) => {
        if (didDrag.current || (event.target as HTMLElement).closest(".kanban-card-move")) return;
        onOpen(record);
    }} onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(record);
    }}>
        <div className="kanban-card-title"><GripVertical size={15}
                                                         aria-hidden="true"/><strong>{record.replicateLabel}</strong>
        </div>
        <p>{record.technicianName}</p>
        {record.indexNumber && <p>{record.season} · Index {record.indexNumber} · Sample {formatSampleNo(record)}</p>}
        <p><QualityBadge record={record}/> {formatGrade(record.grade)} · {formatConfidence(record.confidence)}</p>
        <span>{formatDate(captureTime(record))}</span>
        <button className="kanban-card-move" type="button" onClick={(event) => {
            event.stopPropagation();
            onOpenStatus(event.currentTarget, record);
        }}>Move to...
        </button>
    </article>;
}

function Dashboard() {
    const queryClient = useQueryClient();
    const [view, setView] = useState<View>("row");
    const [filter, setFilter] = useState<Filter>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sort, setSort] = useState<SortOption>("name-asc");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [picker, setPicker] = useState<StatusPickerState | null>(null);
    const [activeKanbanTab, setActiveKanbanTab] = useState<ReviewStatus>("review");
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<ReviewStatus | null>(null);
    const {data: samples = [], error, isLoading, isError} = useQuery({
        queryKey: ["samples"],
        queryFn: fetchSamples
    });
    const records = useMemo(() => samples.flatMap((sample) => sample.replicates), [samples]);

    const updateMutation = useMutation({
        mutationFn: ({id, status}: { id: string; status: ReviewStatus }) => updateStatus(id, status),
        onMutate: async ({id, status}) => {
            await queryClient.cancelQueries({queryKey: ["samples"]});
            const previous = queryClient.getQueryData<SampleRecord[]>(["samples"]);
            queryClient.setQueryData<SampleRecord[]>(["samples"], (current) => patchReplicate(current, id, {reviewStatus: status}));
            return {previous};
        },
        onError: (_error, _variables, context) => queryClient.setQueryData(["samples"], context?.previous),
        onSuccess: (updated) => queryClient.setQueryData<SampleRecord[]>(["samples"], (current) => patchReplicate(current, updated.id, {reviewStatus: updated.reviewStatus})),
        // The backend may auto-accept the sample after a status change, so always refetch the grouped records.
        onSettled: () => void queryClient.invalidateQueries({queryKey: ["samples"]}),
    });

    const overrideMutation = useMutation({
        mutationFn: ({id, overridden}: { id: string; overridden: boolean }) => setManualOverride(id, overridden),
        onSuccess: (updated) => queryClient.setQueryData<SampleRecord[]>(["samples"], (current) => patchReplicate(current, updated.id, {
            manuallyOverridden: updated.manuallyOverridden,
            quality: updated.quality,
            reviewStatus: updated.reviewStatus
        })),
        // An override can complete the sample (2 good photos), which changes its status and average.
        onSettled: () => void queryClient.invalidateQueries({queryKey: ["samples"]}),
    });

    // Uses the backend export endpoint, which exports every record.
    const exportMutation = useMutation({mutationFn: downloadReplicatesCsv});

    const visibleSamples = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = samples.filter((sample) => matchesFilter(sample, filter) && (!term || [sample.sampleId, sample.indexNumber, sample.season, sample.selectionName, ...sample.replicates.flatMap((record) => [record.id, record.replicateLabel, record.technicianName])].some((field) => (field ?? "").toLowerCase().includes(term))));
        const [key, direction] = sort.split("-") as ["name" | "date", "asc" | "desc"];
        return filtered.toSorted((left, right) => {
            const comparison = key === "name" ? left.sampleId.localeCompare(right.sampleId) : sampleCaptureTime(left).localeCompare(sampleCaptureTime(right));
            return direction === "asc" ? comparison : -comparison;
        });
    }, [filter, samples, searchTerm, sort]);

    const selectedSample = samples.find((sample) => sample.replicates.some((record) => record.id === selectedId)) ?? null;
    const selectedRecord = selectedSample?.replicates.find((record) => record.id === selectedId) ?? null;
    const selectedSibling = selectedSample ? findSiblingSample(selectedSample, samples) : null;
    // Kanban columns hold individual photos, so these counts are per photo.
    const counts = useMemo(() => Object.fromEntries(STATUS_COLUMNS.map(({key}) => [key, records.filter((record) => record.reviewStatus === key).length])) as Record<ReviewStatus, number>, [records]);
    const acceptedSamples = useMemo(() => samples.filter((sample) => sample.status === "accepted").length, [samples]);
    const openStatusPicker = (anchor: HTMLElement, record: Replicate) => setPicker({anchor, record});
    const changeStatus = (record: Replicate, status: ReviewStatus) => {
        if (record.reviewStatus !== status) updateMutation.mutate({id: record.id, status});
    };
    const toggleOverride = (record: Replicate) => overrideMutation.mutate({
        id: record.id,
        overridden: !record.manuallyOverridden
    });
    const toggleSort = (key: "name" | "date") => setSort((current) => {
        const [currentKey, direction] = current.split("-") as ["name" | "date", "asc" | "desc"];
        return currentKey === key ? `${key}-${direction === "asc" ? "desc" : "asc"}` as SortOption : `${key}-asc` as SortOption;
    });
    const openRecord = (record: Replicate) => setSelectedId(record.id);
    const openSample = (sample: SampleRecord) => setSelectedId(sample.replicates[0].id);
    const mutationError = updateMutation.error ?? overrideMutation.error ?? exportMutation.error;

    return <main className="app-shell">
        <aside className="sidebar"><p className="brand">Record checking</p>
            <nav aria-label="Dashboard views">
                <button className={view === "row" ? "current" : ""} type="button" onClick={() => setView("row")}>
                    <LayoutList size={18}/>Row view
                </button>
                <button className={view === "kanban" ? "current" : ""} type="button" onClick={() => setView("kanban")}>
                    <Columns3 size={18}/>Kanban View
                </button>
                <button type="button" onClick={() => supabase.auth.signOut({scope: "local"})}>
                    <LogOut size={18}/>Logout
                </button>
            </nav>
        </aside>
        <section className="main-content">
            <header className="page-header">
                <div><h1>Record checking</h1><p>Review AI-generated detections and confirm the outcome.</p></div>
                <div className="summary-row" aria-label="Record totals">
                    <div className="summary-chip"><strong>{samples.length}</strong><span>Samples</span></div>
                    <div className="summary-chip"><strong>{records.length}</strong><span>Photos</span></div>
                    <div className="summary-chip">
                        <strong>{samples.length - acceptedSamples}</strong><span>In review</span></div>
                    <div className="summary-chip"><strong>{acceptedSamples}</strong><span>Accepted</span></div>
                </div>
            </header>
            <section className={`view-panel row-view ${view === "row" ? "active" : ""}`} aria-hidden={view !== "row"}>
                <div className="toolbar-filter" aria-label="Record filters">
                    {FILTERS.map((option) => <button key={option.key}
                                                     className={filter === option.key ? "active" : ""}
                                                     type="button"
                                                     onClick={() => setFilter(option.key)}>{option.label}</button>)}
                </div>
                <div className="toolbar-secondary"><label className="search-field" htmlFor="record-search"><Search
                    size={17} aria-hidden="true"/><span className="visually-hidden">Search records</span><input
                    id="record-search" type="search"
                    placeholder="Search sample, index no., season, selection, technician"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}/></label><label className="sort-field"><span
                    className="visually-hidden">Sort records</span><select value={sort}
                                                                           onChange={(event) => setSort(event.target.value as SortOption)}>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="date-desc">Newest</option>
                    <option value="date-asc">Oldest</option>
                </select></label>
                    <button className="export-button" type="button"
                            title="Downloads every record from the server as CSV"
                            disabled={records.length === 0 || exportMutation.isPending}
                            onClick={() => exportMutation.mutate()}>
                        <Download size={16}
                                  aria-hidden="true"/>{exportMutation.isPending ? "Exporting..." : "Export CSV"}
                    </button>
                </div>
                <section className="record-list-container" aria-label="Record list">
                    {isLoading && <p className="view-message">Loading records...</p>}{isError &&
                    <p className="view-message error-message" role="alert">Could not load
                        records: {error instanceof Error ? error.message : "Unknown error"}</p>}{!isLoading && !isError && samples.length === 0 &&
                    <p className="view-message">No submissions yet.</p>}
                    {!isLoading && !isError && samples.length > 0 && <>
                        <div className="record-list-scroll">{visibleSamples.map((sample) => <SampleCard
                            key={sampleKey(sample)}
                            sample={sample}
                            onOpen={openSample}/>)}{visibleSamples.length === 0 &&
                            <p className="view-message">No records match the current filters.</p>}</div>
                        <div className="record-table-wrap">
                            <table>
                                <thead>
                                <tr>
                                    <th>
                                        <button type="button"
                                                onClick={() => toggleSort("name")}>Sample {sort.startsWith("name") && (sort.endsWith("asc") ?
                                            <ArrowDownAZ size={14}/> : <ArrowUpAZ size={14}/>)}</button>
                                    </th>
                                    <th>Index no.</th>
                                    <th>Season</th>
                                    <th>Samples</th>
                                    <th>Photos (replicate · quality · grade · confidence)</th>
                                    <th>Technician</th>
                                    <th>
                                        <button type="button"
                                                onClick={() => toggleSort("date")}>Captured {sort.startsWith("date") && (sort.endsWith("asc") ?
                                            <ArrowDownAZ size={14}/> : <ArrowUpAZ size={14}/>)}</button>
                                    </th>
                                    <th>Result</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>{visibleSamples.map((sample) => <tr key={sampleKey(sample)} tabIndex={0}
                                                                           onClick={() => openSample(sample)}
                                                                           onKeyDown={(event) => {
                                                                               if (event.key === "Enter") openSample(sample);
                                                                           }}>
                                    <td className="mono-cell">{sample.sampleId}</td>
                                    <td className="mono-cell">{sample.indexNumber ?? EM_DASH}</td>
                                    <td className="mono-cell">{sample.season ?? EM_DASH}</td>
                                    <td>{formatSampleNo(sample)}</td>
                                    <td><PhotoChips sample={sample}/></td>
                                    <td>{sampleTechnicians(sample)}</td>
                                    <td>{formatDate(sampleCaptureTime(sample))}</td>
                                    <td>{formatSampleResult(sample)}</td>
                                    <td><SampleStatusBadge sample={sample}/></td>
                                </tr>)}{visibleSamples.length === 0 && <tr>
                                    <td className="view-message" colSpan={9}>No records match the current filters.</td>
                                </tr>}</tbody>
                            </table>
                        </div>
                    </>}
                </section>
            </section>
            <section className={`view-panel kanban-view ${view === "kanban" ? "active" : ""}`}
                     aria-hidden={view !== "kanban"}>
                <div className="kanban-status-tabs" role="tablist"
                     aria-label="Kanban status columns">{STATUS_COLUMNS.map((column) => <button key={column.key}
                                                                                                className={`${column.key} ${activeKanbanTab === column.key ? "active" : ""}`}
                                                                                                type="button" role="tab"
                                                                                                aria-selected={activeKanbanTab === column.key}
                                                                                                onClick={() => setActiveKanbanTab(column.key)}>
                    <span className="status-dot"/>{column.label}<b>{counts[column.key]}</b></button>)}</div>
                <div className="kanban-column-mobile">
                    <div className="kanban-column-heading"><span
                        className={`status-dot ${activeKanbanTab}`}/>{statusLabel(activeKanbanTab)}<b>{counts[activeKanbanTab]}</b>
                    </div>
                    <div
                        className="kanban-column-body">{records.filter((record) => record.reviewStatus === activeKanbanTab).map((record) =>
                        <KanbanCard key={record.id} record={record} onOpen={openRecord} onOpenStatus={openStatusPicker}
                                    onDragStart={() => undefined} onDragEnd={() => undefined}/>)}</div>
                </div>
                <div className="kanban-board-desktop">{STATUS_COLUMNS.map((column) => <section key={column.key}
                                                                                               className={`kanban-column ${dropTarget === column.key ? "drag-over" : ""}`}
                                                                                               onDragOver={(event) => {
                                                                                                   event.preventDefault();
                                                                                                   setDropTarget(column.key);
                                                                                               }}
                                                                                               onDragLeave={(event) => {
                                                                                                   if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null);
                                                                                               }} onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/plain") || draggedId;
                    const record = records.find((candidate) => candidate.id === id);
                    if (record && record.reviewStatus !== column.key) changeStatus(record, column.key);
                    setDraggedId(null);
                    setDropTarget(null);
                }}>
                    <header className="kanban-column-heading"><span
                        className={`status-dot ${column.key}`}/>{column.label}<b>{counts[column.key]}</b></header>
                    <div
                        className="kanban-column-body">{records.filter((record) => record.reviewStatus === column.key).map((record) =>
                        <KanbanCard key={record.id} record={record} onOpen={openRecord} onOpenStatus={openStatusPicker}
                                    onDragStart={(event, candidate) => {
                                        event.dataTransfer.setData("text/plain", candidate.id);
                                        event.dataTransfer.effectAllowed = "move";
                                        setDraggedId(candidate.id);
                                    }} onDragEnd={() => {
                            setDraggedId(null);
                            setDropTarget(null);
                        }}/>)}</div>
                </section>)}</div>
            </section>
        </section>
        <nav className="mobile-tab-bar" aria-label="Dashboard views">
            <button className={view === "row" ? "current" : ""} type="button" onClick={() => setView("row")}><LayoutList
                size={20}/><span>Row view</span></button>
            <button className={view === "kanban" ? "current" : ""} type="button" onClick={() => setView("kanban")}>
                <Columns3 size={20}/><span>Kanban</span></button>
        </nav>
        {selectedSample && selectedRecord && <DetailOverlay sample={selectedSample} record={selectedRecord}
                                                            sibling={selectedSibling}
                                                            isOverriding={overrideMutation.isPending}
                                                            onClose={() => setSelectedId(null)}
                                                            onOpenStatus={openStatusPicker}
                                                            onSelectReplicate={openRecord}
                                                            onToggleOverride={toggleOverride}
                                                            onOpenSibling={openSample}/>}
        <StatusPicker picker={picker} isUpdating={updateMutation.isPending} onSelect={changeStatus}
                      onClose={() => setPicker(null)}/>
        {mutationError && <p className="mutation-toast"
                             role="alert">{mutationError instanceof Error ? mutationError.message : "Something went wrong. Please try again."}</p>}
    </main>;
}

function App() {
    return <AuthGate><Dashboard/></AuthGate>;
}

export default App;