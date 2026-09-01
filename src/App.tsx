import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check, ChevronDown, Columns3, GripVertical, LayoutList, Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReplicates, imageUrl, updateStatus } from "./api";
import { PasswordGate } from "./PasswordGate";
import type { GrainBox, Replicate, ReviewStatus } from "./types";
import "./App.css";

const STATUS_COLUMNS: Array<{ key: ReviewStatus; label: string }> = [
  { key: "review", label: "Review" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "retraining", label: "Retraining" },
];

type View = "row" | "kanban";
type SortOption = "name-asc" | "name-desc" | "date-desc" | "date-asc";
interface StatusPickerState { record: Replicate; anchor: HTMLElement; }

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: ReviewStatus): string {
  return STATUS_COLUMNS.find((column) => column.key === status)?.label ?? status;
}

function StatusPill({ record, onOpen }: { record: Replicate; onOpen: (anchor: HTMLElement, record: Replicate) => void }) {
  return <button className={`status-pill ${record.reviewStatus}`} type="button" onClick={(event) => { event.stopPropagation(); onOpen(event.currentTarget, record); }}>
    {statusLabel(record.reviewStatus)} <ChevronDown size={14} aria-hidden="true" />
  </button>;
}

function StatusPicker({ picker, isUpdating, onSelect, onClose }: {
  picker: StatusPickerState | null;
  isUpdating: boolean;
  onSelect: (record: Replicate, status: ReviewStatus) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ left: 16, top: 16 });

  useEffect(() => {
    if (!picker || !window.matchMedia("(min-width: 900px)").matches) return;
    const rect = picker.anchor.getBoundingClientRect();
    setPosition({ left: Math.min(Math.max(16, rect.left), window.innerWidth - 216), top: Math.min(rect.bottom + 8, window.innerHeight - 248) });
  }, [picker]);

  useEffect(() => {
    if (!picker) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, picker]);

  if (!picker) return null;
  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  return <div className="sheet-scrim" role="presentation" onMouseDown={onClose}>
    <section className="status-sheet open" aria-label={`Change status for ${picker.record.sampleId}`} onMouseDown={(event) => event.stopPropagation()} style={isDesktop ? { left: position.left, top: position.top } : undefined}>
      <div className="sheet-grabber" aria-hidden="true" />
      <p className="sheet-title">Move record to</p>
      <div className="status-sheet-options">
        {STATUS_COLUMNS.map((column) => {
          const isCurrent = column.key === picker.record.reviewStatus;
          return <button key={column.key} className={`status-option ${column.key} ${isCurrent ? "current" : ""}`} type="button" disabled={isCurrent || isUpdating} onClick={() => {
            const record = picker.record;
            onClose();
            onSelect(record, column.key);
          }}><span className="status-dot" /><span>{column.label}</span>{isCurrent && <Check size={16} aria-label="Current status" />}</button>;
        })}
      </div>
    </section>
  </div>;
}

function GrainCanvas({ image, grains, color }: { image: HTMLImageElement; grains: GrainBox[]; color?: string }) {
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;

  return <div className="grain-stage" style={{ position: "relative", width: "100%", aspectRatio: `${width} / ${height}` }}>
    <img src={image.src} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
    {grains.map((grain, index) => {
      const left = (grain.x / width) * 100;
      const top = (grain.y / height) * 100;
      const boxWidth = (grain.width / width) * 100;
      const boxHeight = (grain.height / height) * 100;

      return <div key={`${grain.x}-${grain.y}-${index}`} style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        width: `${boxWidth}%`,
        height: `${boxHeight}%`,
        border: `2px solid ${color ?? "#2f6f5e"}`,
        boxSizing: "border-box",
        borderRadius: 2,
        background: "transparent",
      }}>
        <span style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translateY(-100%)",
          background: color ?? "#2f6f5e",
          color: "#fff",
          fontSize: 10,
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: "2px 2px 0 0",
          whiteSpace: "nowrap",
        }}>object</span>
      </div>;
    })}
  </div>;
}

function ImageTiers({ record }: { record: Replicate }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => { setImage(source); setFailed(false); };
    source.onerror = () => { setImage(null); setFailed(true); };
    source.src = imageUrl(record.id);
    return () => { source.onload = null; source.onerror = null; };
  }, [record.id]);

  const frame = (grains: GrainBox[], color?: string) => {
    if (failed) return <p className="image-message">Image unavailable</p>;
    if (!image) return <p className="image-message">Loading image...</p>;
    return <GrainCanvas image={image} grains={grains} color={color} />;
  };

  return <>
    <div className="overlay-legend" aria-label="Bounding-box legend"><span><i className="legend-swatch ai" />AI box</span><span><i className="legend-swatch reviewer" />Reviewer correction</span></div>
    <div className="tier-grid">
      <figure className="tier-cell"><div className="tier-frame">{frame([])}</div><figcaption>Raw input</figcaption></figure>
      <figure className="tier-cell"><div className="tier-frame">{frame(record.aiPredictedGrains, "#2f6f5e")}</div><figcaption>AI prediction</figcaption></figure>
      <figure className="tier-cell"><div className="tier-frame">{frame(record.confirmedGrains, "#b5750d")}</div><figcaption>Reviewer correction</figcaption></figure>
    </div>
  </>;
}

function DetailOverlay({ record, onClose, onOpenStatus }: { record: Replicate; onClose: () => void; onOpenStatus: (anchor: HTMLElement, record: Replicate) => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="detail-overlay open" role="presentation" onMouseDown={onClose}>
    <section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="detail-header"><div><h2 id="detail-title">Record detail</h2><p>{record.id}</p></div><button className="icon-button" type="button" aria-label="Close record detail" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      <div className="detail-body"><ImageTiers record={record} /><dl className="record-metadata"><div><dt>Sample ID</dt><dd>{record.sampleId}</dd></div><div><dt>Technician</dt><dd>{record.technicianName}</dd></div><div><dt>Captured</dt><dd>{formatDate(record.createdAt)}</dd></div><div><dt>Grade</dt><dd>{record.grade}</dd></div><div><dt>Immature weight</dt><dd>{record.immatureWeight}</dd></div><div><dt>Percentage</dt><dd>{record.percentage}%</dd></div></dl></div>
      <footer className="detail-footer"><span>Status</span><StatusPill record={record} onOpen={onOpenStatus} /></footer>
    </section>
  </div>;
}

function RecordCard({ record, onOpen, onOpenStatus }: { record: Replicate; onOpen: (record: Replicate) => void; onOpenStatus: (anchor: HTMLElement, record: Replicate) => void }) {
  return <article className="record-card" tabIndex={0} onClick={() => onOpen(record)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(record); } }}>
    <div className="record-card-top"><strong>{record.sampleId}</strong><StatusPill record={record} onOpen={onOpenStatus} /></div><p>{record.technicianName}</p><span>{formatDate(record.createdAt)}</span>
  </article>;
}

function KanbanCard({ record, onOpen, onOpenStatus, onDragStart, onDragEnd }: {
  record: Replicate;
  onOpen: (record: Replicate) => void;
  onOpenStatus: (anchor: HTMLElement, record: Replicate) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, record: Replicate) => void;
  onDragEnd: () => void;
}) {
  const didDrag = useRef(false);
  return <article className="kanban-card" draggable tabIndex={0} onDragStart={(event) => { didDrag.current = true; onDragStart(event, record); }} onDragEnd={() => { onDragEnd(); window.setTimeout(() => { didDrag.current = false; }, 0); }} onClick={(event) => { if (didDrag.current || (event.target as HTMLElement).closest(".kanban-card-move")) return; onOpen(record); }} onKeyDown={(event) => { if (event.key === "Enter") onOpen(record); }}>
    <div className="kanban-card-title"><GripVertical size={15} aria-hidden="true" /><strong>{record.sampleId}</strong></div><p>{record.technicianName}</p><span>{formatDate(record.createdAt)}</span>
    <button className="kanban-card-move" type="button" onClick={(event) => { event.stopPropagation(); onOpenStatus(event.currentTarget, record); }}>Move to...</button>
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
  const { data: records = [], error, isLoading, isError } = useQuery({ queryKey: ["replicates"], queryFn: fetchReplicates });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["replicates"] });
      const previous = queryClient.getQueryData<Replicate[]>(["replicates"]);
      queryClient.setQueryData<Replicate[]>(["replicates"], (current = []) => current.map((record) => record.id === id ? { ...record, reviewStatus: status } : record));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(["replicates"], context?.previous),
    onSuccess: (updated) => queryClient.setQueryData<Replicate[]>(["replicates"], (current = []) => current.map((record) => record.id === updated.id ? { ...record, reviewStatus: updated.reviewStatus } : record)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["replicates"] }),
  });

  const visibleRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = records.filter((record) => (filter === "all" || record.reviewStatus === filter) && (!term || [record.id, record.sampleId, record.technicianName].some((field) => field.toLowerCase().includes(term))));
    const [key, direction] = sort.split("-") as ["name" | "date", "asc" | "desc"];
    return filtered.toSorted((left, right) => {
      const comparison = key === "name" ? left.sampleId.localeCompare(right.sampleId) : left.createdAt.localeCompare(right.createdAt);
      return direction === "asc" ? comparison : -comparison;
    });
  }, [filter, records, searchTerm, sort]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;
  const counts = useMemo(() => Object.fromEntries(STATUS_COLUMNS.map(({ key }) => [key, records.filter((record) => record.reviewStatus === key).length])) as Record<ReviewStatus, number>, [records]);
  const openStatusPicker = (anchor: HTMLElement, record: Replicate) => setPicker({ anchor, record });
  const changeStatus = (record: Replicate, status: ReviewStatus) => { if (record.reviewStatus !== status) updateMutation.mutate({ id: record.id, status }); };
  const toggleSort = (key: "name" | "date") => setSort((current) => { const [currentKey, direction] = current.split("-") as ["name" | "date", "asc" | "desc"]; return currentKey === key ? `${key}-${direction === "asc" ? "desc" : "asc"}` as SortOption : `${key}-asc` as SortOption; });
  const openRecord = (record: Replicate) => setSelectedId(record.id);

  return <main className="app-shell">
    <aside className="sidebar"><p className="brand">Record checking</p><nav aria-label="Dashboard views"><button className={view === "row" ? "current" : ""} type="button" onClick={() => setView("row")}><LayoutList size={18} />Row view</button><button className={view === "kanban" ? "current" : ""} type="button" onClick={() => setView("kanban")}><Columns3 size={18} />Kanban View</button></nav></aside>
    <section className="main-content">
      <header className="page-header"><div><h1>Record checking</h1><p>Review AI-generated detections and confirm the outcome.</p></div><div className="summary-row" aria-label="Record totals"><div className="summary-chip"><strong>{records.length}</strong><span>Total</span></div>{STATUS_COLUMNS.map((column) => <div className="summary-chip" key={column.key}><strong>{counts[column.key]}</strong><span>{column.label}</span></div>)}</div></header>
      <section className={`view-panel row-view ${view === "row" ? "active" : ""}`} aria-hidden={view !== "row"}>
        <div className="toolbar-filter" aria-label="Record filters"><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>All</button>{STATUS_COLUMNS.map((column) => <button key={column.key} className={filter === column.key ? "active" : ""} type="button" onClick={() => setFilter(column.key)}>{column.label}</button>)}</div>
        <div className="toolbar-secondary"><label className="search-field" htmlFor="record-search"><Search size={17} aria-hidden="true" /><span className="visually-hidden">Search records</span><input id="record-search" type="search" placeholder="Search records" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label><label className="sort-field"><span className="visually-hidden">Sort records</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="date-desc">Newest</option><option value="date-asc">Oldest</option></select></label></div>
        <section className="record-list-container" aria-label="Record list">
          {isLoading && <p className="view-message">Loading records...</p>}{isError && <p className="view-message error-message" role="alert">Could not load records: {error instanceof Error ? error.message : "Unknown error"}</p>}{!isLoading && !isError && records.length === 0 && <p className="view-message">No submissions yet.</p>}
          {!isLoading && !isError && records.length > 0 && <><div className="record-list-scroll">{visibleRecords.map((record) => <RecordCard key={record.id} record={record} onOpen={openRecord} onOpenStatus={openStatusPicker} />)}{visibleRecords.length === 0 && <p className="view-message">No records match the current filters.</p>}</div><div className="record-table-wrap"><table><thead><tr><th><button type="button" onClick={() => toggleSort("name")}>Sample {sort.startsWith("name") && (sort.endsWith("asc") ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />)}</button></th><th>Technician</th><th><button type="button" onClick={() => toggleSort("date")}>Created {sort.startsWith("date") && (sort.endsWith("asc") ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />)}</button></th><th>Grade</th><th>Status</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id} tabIndex={0} onClick={() => openRecord(record)} onKeyDown={(event) => { if (event.key === "Enter") openRecord(record); }}><td className="mono-cell">{record.sampleId}</td><td>{record.technicianName}</td><td>{formatDate(record.createdAt)}</td><td>{record.grade}</td><td><StatusPill record={record} onOpen={openStatusPicker} /></td></tr>)}{visibleRecords.length === 0 && <tr><td className="view-message" colSpan={5}>No records match the current filters.</td></tr>}</tbody></table></div></>}
        </section>
      </section>
      <section className={`view-panel kanban-view ${view === "kanban" ? "active" : ""}`} aria-hidden={view !== "kanban"}>
        <div className="kanban-status-tabs" role="tablist" aria-label="Kanban status columns">{STATUS_COLUMNS.map((column) => <button key={column.key} className={`${column.key} ${activeKanbanTab === column.key ? "active" : ""}`} type="button" role="tab" aria-selected={activeKanbanTab === column.key} onClick={() => setActiveKanbanTab(column.key)}><span className="status-dot" />{column.label}<b>{counts[column.key]}</b></button>)}</div>
        <div className="kanban-column-mobile"><div className="kanban-column-heading"><span className={`status-dot ${activeKanbanTab}`} />{statusLabel(activeKanbanTab)}<b>{counts[activeKanbanTab]}</b></div><div className="kanban-column-body">{records.filter((record) => record.reviewStatus === activeKanbanTab).map((record) => <KanbanCard key={record.id} record={record} onOpen={openRecord} onOpenStatus={openStatusPicker} onDragStart={() => undefined} onDragEnd={() => undefined} />)}</div></div>
        <div className="kanban-board-desktop">{STATUS_COLUMNS.map((column) => <section key={column.key} className={`kanban-column ${dropTarget === column.key ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDropTarget(column.key); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || draggedId; const record = records.find((candidate) => candidate.id === id); if (record && record.reviewStatus !== column.key) changeStatus(record, column.key); setDraggedId(null); setDropTarget(null); }}><header className="kanban-column-heading"><span className={`status-dot ${column.key}`} />{column.label}<b>{counts[column.key]}</b></header><div className="kanban-column-body">{records.filter((record) => record.reviewStatus === column.key).map((record) => <KanbanCard key={record.id} record={record} onOpen={openRecord} onOpenStatus={openStatusPicker} onDragStart={(event, candidate) => { event.dataTransfer.setData("text/plain", candidate.id); event.dataTransfer.effectAllowed = "move"; setDraggedId(candidate.id); }} onDragEnd={() => { setDraggedId(null); setDropTarget(null); }} />)}</div></section>)}</div>
      </section>
    </section>
    <nav className="mobile-tab-bar" aria-label="Dashboard views"><button className={view === "row" ? "current" : ""} type="button" onClick={() => setView("row")}><LayoutList size={20} /><span>Row view</span></button><button className={view === "kanban" ? "current" : ""} type="button" onClick={() => setView("kanban")}><Columns3 size={20} /><span>Kanban</span></button></nav>
    {selectedRecord && <DetailOverlay record={selectedRecord} onClose={() => setSelectedId(null)} onOpenStatus={openStatusPicker} />}
    <StatusPicker picker={picker} isUpdating={updateMutation.isPending} onSelect={changeStatus} onClose={() => setPicker(null)} />
    {updateMutation.isError && <p className="mutation-toast" role="alert">{updateMutation.error instanceof Error ? updateMutation.error.message : "Could not update review status."}</p>}
  </main>;
}

function App() { return <PasswordGate><Dashboard /></PasswordGate>; }

export default App;
