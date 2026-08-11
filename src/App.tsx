import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReplicates, imageUrl, updateStatus } from "./api";
import type { GrainBox, Replicate } from "./types";
import "./App.css";

type ReviewDecision = "accepted" | "denied";

const statusLabels: Record<Replicate["reviewStatus"], string> = {
  unreviewed: "Unreviewed",
  accepted: "Accepted",
  denied: "Denied",
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function GrainCanvas({ image, grains, color }: { image: HTMLImageElement; grains: GrainBox[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    canvas.width = 1024;
    canvas.height = 1024;
    context.drawImage(image, 0, 0, 1024, 1024);
    context.strokeStyle = color;
    context.lineWidth = 2;

    for (const grain of grains) {
      context.strokeRect(grain.x, grain.y, grain.width, grain.height);
    }
  }, [color, grains, image]);

  return <canvas ref={canvasRef} className="grain-canvas" width="1024" height="1024" />;
}

function ComparisonPanel({ record }: { record: Replicate }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const source = new Image();
    source.onload = () => {
      setImage(source);
      setImageFailed(false);
    };
    source.onerror = () => {
      setImage(null);
      setImageFailed(true);
    };
    source.src = imageUrl(record.id);

    return () => {
      source.onload = null;
      source.onerror = null;
    };
  }, [record.id]);

  return (
    <div className="comparison-grid">
      <figure className="comparison-cell">
        <div className="canvas-frame">
          {imageFailed ? (
            <p className="image-message">Image unavailable</p>
          ) : image ? (
            <GrainCanvas image={image} grains={record.aiPredictedGrains} color="#2f6f5e" />
          ) : (
            <p className="image-message">Loading image...</p>
          )}
        </div>
        <figcaption>AI prediction</figcaption>
      </figure>
      <figure className="comparison-cell">
        <div className="canvas-frame">
          {imageFailed ? (
            <p className="image-message">Image unavailable</p>
          ) : image ? (
            <GrainCanvas image={image} grains={record.confirmedGrains} color="#a13d2e" />
          ) : (
            <p className="image-message">Loading image...</p>
          )}
        </div>
        <figcaption>Technician correction</figcaption>
      </figure>
    </div>
  );
}

function RecordDialog({ record, onClose }: { record: Replicate; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState(record);

  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: (status: ReviewDecision) => updateStatus(currentRecord.id, status),
    onSuccess: (updated) => {
      setCurrentRecord((previous) => ({ ...previous, reviewStatus: updated.reviewStatus }));
      setMutationError(null);
      void queryClient.invalidateQueries({ queryKey: ["replicates"] });
    },
    onError: () => {
      setMutationError("The review status could not be updated. Please try again.");
    },
  });

  const changeStatus = (status: ReviewDecision) => {
    setMutationError(null);
    mutation.mutate(status);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="record-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">Record detail</h2>
            <p className="record-id">{currentRecord.id}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}>
            <span aria-hidden="true">x</span>
          </button>
        </header>

        <div className="dialog-body">
          <ComparisonPanel record={currentRecord} />
          <dl className="record-metadata">
            <div>
              <dt>Sample ID</dt>
              <dd>{currentRecord.sampleId}</dd>
            </div>
            <div>
              <dt>Technician</dt>
              <dd>{currentRecord.technicianName}</dd>
            </div>
            <div>
              <dt>Captured</dt>
              <dd>{formatDate(currentRecord.createdAt)}</dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>{currentRecord.grade}</dd>
            </div>
            <div>
              <dt>Immature weight</dt>
              <dd>{currentRecord.immatureWeight}</dd>
            </div>
            <div>
              <dt>Percentage</dt>
              <dd>{currentRecord.percentage}%</dd>
            </div>
          </dl>
          {mutationError && <p className="mutation-error" role="alert">{mutationError}</p>}
        </div>

        <footer className="dialog-footer">
          <p className="current-status">
            Current status: <strong>{statusLabels[currentRecord.reviewStatus]}</strong>
          </p>
          <div className="action-group">
            <button
              className="review-button deny-button"
              type="button"
              disabled={mutation.isPending}
              onClick={() => changeStatus("denied")}
            >
              Disagree
            </button>
            <button
              className="review-button accept-button"
              type="button"
              disabled={mutation.isPending}
              onClick={() => changeStatus("accepted")}
            >
              Agree
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function App() {
  const [selectedRecord, setSelectedRecord] = useState<Replicate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Replicate["reviewStatus"]>("all");
  const { data: records = [], error, isLoading, isError } = useQuery({
    queryKey: ["replicates"],
    queryFn: fetchReplicates,
  });

  const visibleRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus = statusFilter === "all" || record.reviewStatus === statusFilter;
      const matchesSearch = !normalizedSearch || [record.sampleId, record.technicianName, record.id]
        .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [records, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => ({
    total: records.length,
    accepted: records.filter((record) => record.reviewStatus === "accepted").length,
    denied: records.filter((record) => record.reviewStatus === "denied").length,
    unreviewed: records.filter((record) => record.reviewStatus === "unreviewed").length,
  }), [records]);

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>Record checking</h1>
          <p>Review AI-generated detections and confirm the outcome.</p>
        </div>
        <div className="summary-row" aria-label="Record summary">
          <div className="summary-chip"><strong>{statusCounts.total}</strong><span>Total</span></div>
          <div className="summary-chip"><strong>{statusCounts.accepted}</strong><span>Accepted</span></div>
          <div className="summary-chip"><strong>{statusCounts.denied}</strong><span>Denied</span></div>
          <div className="summary-chip"><strong>{statusCounts.unreviewed}</strong><span>Unreviewed</span></div>
        </div>
      </header>

      <div className="toolbar">
        {(["all", "accepted", "denied", "unreviewed"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-button ${statusFilter === status ? "active" : ""}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : statusLabels[status]}
          </button>
        ))}
        <label className="visually-hidden" htmlFor="record-search">Search records</label>
        <input
          id="record-search"
          className="search-input"
          type="search"
          placeholder="Search by sample, technician, or ID"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <section className="table-card" aria-label="Replicate records">
        {isLoading ? (
          <p className="table-message">Loading records...</p>
        ) : isError ? (
          <p className="table-message error-message" role="alert">
            Could not load records: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : records.length === 0 ? (
          <p className="table-message">No submissions yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Sample ID</th>
                  <th scope="col">Technician</th>
                  <th scope="col">Created</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="visually-hidden">Open record</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="record-row"
                    tabIndex={0}
                    onClick={() => setSelectedRecord(record)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRecord(record);
                      }
                    }}
                  >
                    <td className="mono-cell">{record.sampleId}</td>
                    <td>{record.technicianName}</td>
                    <td className="mono-cell">{formatDate(record.createdAt)}</td>
                    <td>{record.grade}</td>
                    <td><span className={`status-badge ${record.reviewStatus}`}>{statusLabels[record.reviewStatus]}</span></td>
                    <td className="chevron" aria-hidden="true">›</td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr><td className="table-message" colSpan={6}>No records match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRecord && <RecordDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </main>
  );
}

export default App;
