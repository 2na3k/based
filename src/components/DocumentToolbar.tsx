import { Filter, Grid2X2, List } from "lucide-react";
import type { SortMode, ViewMode } from "../lib/types";

interface DocumentToolbarProps {
  filtersOpen: boolean;
  sortBy: SortMode;
  viewMode: ViewMode;
  onFiltersOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onSortChange: (sort: SortMode) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

export function DocumentToolbar({ filtersOpen, sortBy, viewMode, onFiltersOpenChange, onSortChange, onViewModeChange }: DocumentToolbarProps) {
  return (
    <div className="filter-bar">
      <button className={`chip${filtersOpen ? " on" : ""}`} onClick={() => onFiltersOpenChange((open) => !open)}>
        <Filter size={12} />
        Filters
      </button>
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
