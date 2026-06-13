import { FILTER_TYPES, TYPE_LABELS } from "../lib/documents";
import type { DocumentType } from "../lib/types";

interface CustomFilterPanelProps {
  activeTag: string;
  activeType: DocumentType | "all";
  open: boolean;
  tags: string[];
  onActiveTagChange: (tag: string) => void;
  onActiveTypeChange: (type: DocumentType | "all") => void;
}

export function CustomFilterPanel({ activeTag, activeType, open, tags, onActiveTagChange, onActiveTypeChange }: CustomFilterPanelProps) {
  if (!open) return null;

  return (
    <div className="custom-filter-panel">
      <div className="custom-filter-group">
        <span className="filter-label">Types</span>
        <div className="filter-chips">
          <button className={`chip${activeType === "all" ? " on" : ""}`} onClick={() => onActiveTypeChange("all")}>
            All
          </button>
          {FILTER_TYPES.map((type) => (
            <button key={type} className={`chip${activeType === type ? " on" : ""}`} onClick={() => onActiveTypeChange(type)}>
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
      <div className="custom-filter-group">
        <span className="filter-label">Tags</span>
        <div className="filter-chips">
          <button className={`chip${activeTag === "all" ? " on" : ""}`} onClick={() => onActiveTagChange("all")}>
            All tags
          </button>
          {tags.map((tag) => (
            <button key={tag} className={`chip${activeTag === tag ? " on" : ""}`} onClick={() => onActiveTagChange(tag)}>
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
