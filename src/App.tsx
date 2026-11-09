import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {ArrowDownAZ, ArrowUpAZ, Columns3, Download, GripVertical, LayoutList, LogOut, Minus, Plus, Search, X} from "lucide-react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {fetchReplicates, updateStatus} from "./api";
import {AuthGate} from "./AuthGate";
import {supabase} from "./supabase";
import type {GrainBox, Replicate, ReviewStatus} from "./types";
import {exportCsv} from "./export";
import {StatusPicker, StatusPill, type StatusPickerState} from "./components/StatusPicker";
import {STATUS_COLUMNS, statusLabel} from "./components/status";
import "./App.css";

type View = "row" | "kanban";
type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function formatOptionalDate(value?: string | null): string {
    return value ? formatDate(value) : "—";
}

function processingTime(record: Replicate): string {
    if (!record.capturedAt || !record.submittedAt) return "—";
    const milliseconds = new Date(record.submittedAt).getTime() - new Date(record.capturedAt).getTime();
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
    const seconds = Math.round(milliseconds / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
            <div className="tier-frame" ref={frameRef} style={image ? {aspectRatio: `${width} / ${height}`} : undefined}>
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

function DetailOverlay({record, onClose, onOpenStatus, otherSample, onOpenRecord}: {
    record: Replicate;
    onClose: () => void;
    onOpenStatus: (anchor: HTMLElement, record: Replicate) => void;
    otherSample?: Replicate;
    onOpenRecord: (record: Replicate) => void;
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
                <div><h2 id="detail-title">Record detail</h2><p>{record.id}</p></div>
                <button className="icon-button" type="button" aria-label="Close record detail" onClick={onClose}><X
                    size={20} aria-hidden="true"/></button>
            </header>
            <div className="detail-body"><ImageTiers record={record}/>
                <dl className="record-metadata">
                    <div>
                        <dt>Sample ID</dt>
                        <dd>{record.sampleId}</dd>
                    </div>
                    <div>
                        <dt>Technician</dt>
                        <dd>{record.technicianName}</dd>
                    </div>
                    <div>
                        <dt>Season</dt>
                        <dd>{record.season || "—"}</dd>
                    </div>
                    <div>
                        <dt>Index number</dt>
                        <dd>{record.indexNumber || "—"}</dd>
                    </div>
                    <div>
                        <dt>Selection</dt>
                        <dd>{record.selectionName || "—"}</dd>
                    </div>
                    <div>
                        <dt>Sample</dt>
                        <dd>{record.sampleNo ? `${record.sampleNo} of 2` : "—"}</dd>
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
                        <dt>Saved</dt>
                        <dd>{formatDate(record.createdAt)}</dd>
                    </div>
                    <div>
                        <dt>Processing time</dt>
                        <dd>{processingTime(record)}</dd>
                    </div>
                    <div>
                        <dt>Grade</dt>
                        <dd>{record.grade}</dd>
                    </div>
                    <div>
                        <dt>Immature weight</dt>
                        <dd>{record.immatureWeight}</dd>
                    </div>
                    <div>
                        <dt>Percentage</dt>
                        <dd>{record.percentage}%</dd>
                    </div>
                    <div>
                        <dt>Recommended value</dt>
                        <dd>{record.meetsRecommendedValue == null ? "—" : record.meetsRecommendedValue ? "Yes" : "No"}</dd>
                    </div>
                </dl>
                {otherSample && <button className="related-record-link" type="button" onClick={() => onOpenRecord(otherSample)}>
                    Open sample {otherSample.sampleNo ?? "—"} of this entry
                </button>}
            </div>
            <footer className="detail-footer"><span>Status</span><StatusPill record={record} onOpen={onOpenStatus}/>
            </footer>
        </section>
    </div>;
}

function RecordCard({record, onOpen, onOpenStatus}: {
    record: Replicate;
    onOpen: (record: Replicate) => void;
    onOpenStatus: (anchor: HTMLElement, record: Replicate) => void
}) {
    return <article className="record-card" tabIndex={0} onClick={() => onOpen(record)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(record);
        }
    }}>
        <div className="record-card-top"><strong>{record.sampleId}</strong><StatusPill record={record}
                                                                                       onOpen={onOpenStatus}/></div>
        <p>{record.technicianName}</p><span>{record.season || "—"} · {record.indexNumber || "—"} · {formatDate(record.createdAt)}</span>
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
                                                         aria-hidden="true"/><strong>{record.sampleId}</strong></div>
        <p>{record.technicianName}</p><span>{formatDate(record.createdAt)}</span>
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
    const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sort, setSort] = useState<SortOption>("name-asc");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [picker, setPicker] = useState<StatusPickerState | null>(null);
    const [activeKanbanTab, setActiveKanbanTab] = useState<ReviewStatus>("review");
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<ReviewStatus | null>(null);
    const {data: records = [], error, isLoading, isError} = useQuery({
        queryKey: ["replicates"],
        queryFn: fetchReplicates
    });

    const updateMutation = useMutation({
        mutationFn: ({id, status}: { id: string; status: ReviewStatus }) => updateStatus(id, status),
        onMutate: async ({id, status}) => {
            await queryClient.cancelQueries({queryKey: ["replicates"]});
            const previous = queryClient.getQueryData<Replicate[]>(["replicates"]);
            queryClient.setQueryData<Replicate[]>(["replicates"], (current = []) => current.map((record) => record.id === id ? {
                ...record,
                reviewStatus: status
            } : record));
            return {previous};
        },
        onError: (_error, _variables, context) => queryClient.setQueryData(["replicates"], context?.previous),
        onSuccess: (updated) => queryClient.setQueryData<Replicate[]>(["replicates"], (current = []) => current.map((record) => record.id === updated.id ? {
            ...record,
            reviewStatus: updated.reviewStatus
        } : record)),
        onSettled: () => void queryClient.invalidateQueries({queryKey: ["replicates"]}),
    });

    const visibleRecords = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = records.filter((record) => (filter === "all" || record.reviewStatus === filter) && (!term || [record.id, record.sampleId, record.technicianName, record.indexNumber, record.season, record.selectionName].some((field) => field?.toLowerCase().includes(term))));
        const [key, direction] = sort.split("-") as ["name" | "date", "asc" | "desc"];
        return filtered.toSorted((left, right) => {
            const comparison = key === "name" ? left.sampleId.localeCompare(right.sampleId) : left.createdAt.localeCompare(right.createdAt);
            return direction === "asc" ? comparison : -comparison;
        });
    }, [filter, records, searchTerm, sort]);

    const sampleGroups = useMemo(() => {
        const groups = new Map<string, Replicate[]>();
        records.forEach((record) => {
            const key = `${record.season ?? ""}:${record.indexNumber ?? ""}`;
            groups.set(key, [...(groups.get(key) ?? []), record].sort((left, right) => (left.sampleNo ?? 0) - (right.sampleNo ?? 0)));
        });
        return groups;
    }, [records]);

    const samplePosition = (record: Replicate): string => {
        const group = sampleGroups.get(`${record.season ?? ""}:${record.indexNumber ?? ""}`);
        return group && group.length > 1 ? `${group.findIndex((candidate) => candidate.id === record.id) + 1} of ${group.length}` : "1 of 1";
    };

    const selectedRecord = records.find((record) => record.id === selectedId) ?? null;
    const counts = useMemo(() => Object.fromEntries(STATUS_COLUMNS.map(({key}) => [key, records.filter((record) => record.reviewStatus === key).length])) as Record<ReviewStatus, number>, [records]);
    const openStatusPicker = (anchor: HTMLElement, record: Replicate) => setPicker({anchor, record});
    const changeStatus = (record: Replicate, status: ReviewStatus) => {
        if (record.reviewStatus !== status) updateMutation.mutate({id: record.id, status});
    };
    const toggleSort = (key: "name" | "date") => setSort((current) => {
        const [currentKey, direction] = current.split("-") as ["name" | "date", "asc" | "desc"];
        return currentKey === key ? `${key}-${direction === "asc" ? "desc" : "asc"}` as SortOption : `${key}-asc` as SortOption;
    });
    const openRecord = (record: Replicate) => setSelectedId(record.id);

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
                    <div className="summary-chip"><strong>{records.length}</strong><span>Total</span></div>
                    {STATUS_COLUMNS.map((column) => <div className="summary-chip" key={column.key}>
                        <strong>{counts[column.key]}</strong><span>{column.label}</span></div>)}</div>
            </header>
            <section className={`view-panel row-view ${view === "row" ? "active" : ""}`} aria-hidden={view !== "row"}>
                <div className="toolbar-filter" aria-label="Record filters">
                    <button className={filter === "all" ? "active" : ""} type="button"
                            onClick={() => setFilter("all")}>All
                    </button>
                    {STATUS_COLUMNS.map((column) => <button key={column.key}
                                                            className={filter === column.key ? "active" : ""}
                                                            type="button"
                                                            onClick={() => setFilter(column.key)}>{column.label}</button>)}
                </div>
                <div className="toolbar-secondary"><label className="search-field" htmlFor="record-search"><Search
                    size={17} aria-hidden="true"/><span className="visually-hidden">Search records</span><input
                    id="record-search" type="search" placeholder="Search records" value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}/></label><label className="sort-field"><span
                    className="visually-hidden">Sort records</span><select value={sort}
                                                                           onChange={(event) => setSort(event.target.value as SortOption)}>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="date-desc">Newest</option>
                    <option value="date-asc">Oldest</option>
                </select></label><button className="export-button" type="button" disabled={visibleRecords.length === 0}
                                          onClick={() => exportCsv(visibleRecords)}><Download size={16}/>Export CSV</button></div>
                <section className="record-list-container" aria-label="Record list">
                    {isLoading && <p className="view-message">Loading records...</p>}{isError &&
                    <p className="view-message error-message" role="alert">Could not load
                        records: {error instanceof Error ? error.message : "Unknown error"}</p>}{!isLoading && !isError && records.length === 0 &&
                    <p className="view-message">No submissions yet.</p>}
                    {!isLoading && !isError && records.length > 0 && <>
                        <div className="record-list-scroll">{visibleRecords.map((record) => <RecordCard key={record.id}
                                                                                                        record={record}
                                                                                                        onOpen={openRecord}
                                                                                                        onOpenStatus={openStatusPicker}/>)}{visibleRecords.length === 0 &&
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
                                    <th>Technician</th>
                                    <th>Index No.</th>
                                    <th>Season</th>
                                    <th>Samples</th>
                                    <th>
                                        <button type="button"
                                                onClick={() => toggleSort("date")}>Created {sort.startsWith("date") && (sort.endsWith("asc") ?
                                            <ArrowDownAZ size={14}/> : <ArrowUpAZ size={14}/>)}</button>
                                    </th>
                                    <th>Grade</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>{visibleRecords.map((record) => <tr key={record.id} tabIndex={0}
                                                                           onClick={() => openRecord(record)}
                                                                           onKeyDown={(event) => {
                                                                               if (event.key === "Enter") openRecord(record);
                                                                           }}>
                                    <td className="mono-cell">{record.sampleId}</td>
                                    <td>{record.technicianName}</td>
                                    <td>{record.indexNumber || "—"}</td>
                                    <td>{record.season || "—"}</td>
                                    <td>{samplePosition(record)}</td>
                                    <td>{formatDate(record.createdAt)}</td>
                                    <td>{record.grade}</td>
                                    <td><StatusPill record={record} onOpen={openStatusPicker}/></td>
                                </tr>)}{visibleRecords.length === 0 && <tr>
                                    <td className="view-message" colSpan={8}>No records match the current filters.</td>
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
        {selectedRecord && <DetailOverlay record={selectedRecord} onClose={() => setSelectedId(null)}
                                          onOpenStatus={openStatusPicker}
                                          otherSample={sampleGroups.get(`${selectedRecord.season ?? ""}:${selectedRecord.indexNumber ?? ""}`)?.find((record) => record.id !== selectedRecord.id)}
                                          onOpenRecord={openRecord}/>}
        <StatusPicker picker={picker} isUpdating={updateMutation.isPending} onSelect={changeStatus}
                      onClose={() => setPicker(null)}/>
        {updateMutation.isError && <p className="mutation-toast"
                                      role="alert">{updateMutation.error instanceof Error ? updateMutation.error.message : "Could not update review status."}</p>}
    </main>;
}

function App() {
    return <AuthGate><Dashboard/></AuthGate>;
}

export default App;