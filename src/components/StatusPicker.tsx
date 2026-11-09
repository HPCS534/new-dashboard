import {useEffect, useState} from "react";
import {Check, ChevronDown} from "lucide-react";
import type {Replicate, ReviewStatus} from "../types";
import {STATUS_COLUMNS, statusLabel} from "./status";

export function StatusPill({record, onOpen}: { record: Replicate; onOpen: (anchor: HTMLElement, record: Replicate) => void }) {
    return <button className={`status-pill ${record.reviewStatus}`} type="button" onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget, record);
    }}>
        {statusLabel(record.reviewStatus)} <ChevronDown size={14} aria-hidden="true"/>
    </button>;
}

export interface StatusPickerState {
    record: Replicate;
    anchor: HTMLElement;
}

export function StatusPicker({picker, isUpdating, onSelect, onClose}: {
    picker: StatusPickerState | null;
    isUpdating: boolean;
    onSelect: (record: Replicate, status: ReviewStatus) => void;
    onClose: () => void;
}) {
    const [position, setPosition] = useState({left: 16, top: 16});

    useEffect(() => {
        if (!picker || !window.matchMedia("(min-width: 900px)").matches) return;
        const rect = picker.anchor.getBoundingClientRect();
        setPosition({
            left: Math.min(Math.max(16, rect.left), window.innerWidth - 216),
            top: Math.min(rect.bottom + 8, window.innerHeight - 248)
        });
    }, [picker]);

    useEffect(() => {
        if (!picker) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose, picker]);

    if (!picker) return null;
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    return <div className="sheet-scrim" role="presentation" onMouseDown={onClose}>
        <section className="status-sheet open" aria-label={`Change status for ${picker.record.sampleId}`}
                 onMouseDown={(event) => event.stopPropagation()}
                 style={isDesktop ? {left: position.left, top: position.top} : undefined}>
            <div className="sheet-grabber" aria-hidden="true"/>
            <p className="sheet-title">Move record to</p>
            <div className="status-sheet-options">
                {STATUS_COLUMNS.map((column) => {
                    const isCurrent = column.key === picker.record.reviewStatus;
                    return <button key={column.key}
                                   className={`status-option ${column.key} ${isCurrent ? "current" : ""}`} type="button"
                                   disabled={isCurrent || isUpdating} onClick={() => {
                        const record = picker.record;
                        onClose();
                        onSelect(record, column.key);
                    }}><span className="status-dot"/><span>{column.label}</span>{isCurrent &&
                        <Check size={16} aria-label="Current status"/>}</button>;
                })}
            </div>
        </section>
    </div>;
}
