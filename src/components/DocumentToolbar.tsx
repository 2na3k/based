import { Grid2X2, List } from "lucide-react";
import { FILTER_TYPES, TYPE_LABELS } from "../lib/documents";
import type { DocumentType, SortMode, ViewMode } from "../lib/types";

interface DocumentToolbarProps {
  activeType: DocumentType | "all";
  sortBy: SortMode;
  viewMode: ViewMode;
  onActiveTypeChange: (type: DocumentType | "all") => void;
  onSortChange: (sort: SortMode) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

export function DocumentToolbar({ activeType, sortBy, viewMode, onActiveTypeChange, onSortChange, onViewModeChange }: DocumentToolbarProps) {
  return (
    <div className="filter-bar">
      <button className={`chip${activeType === "all" ? " on" : ""}`} onClick={() => onActiveTypeChange("all")}>
        All
      </button>
      {FILTER_TYPES.map((type) => (
        <button key={type} className={`chip${activeType === type ? " on" : ""}`} onClick={() => onActiveTypeChange(type)}>
          {TYPE_LABELS[type]}
        </button>
      ))}
      <div className="filter-right">
        <div className="view-toggle" aria-label="View mode">
          <button className={`view-btn${viewMode === "list" ? " active" : ""}`} title="List view" onClick={() => onViewModeChange("list")}>
            <List size={14} />
          </button>
          <button className={`view-btn${viewMode === "card" ? " active" : ""}`} title="Card view" onClick={() => onViewModeChange("card")}>
            <Grid2X2 size={14} />
          </button>
        </div>
        <select className="sort-select" value={sortBy} onChange={(event) => onSortChange(event.target.value as SortMode)}>
          <option value="recent">Recent</option>
          <option value="alpha">A to Z</option>
          <option value="type">Type</option>
        </select>
      </div>
    </div>
  );
}
