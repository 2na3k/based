import { ChevronDown, ChevronsLeft, ChevronsRight, File, FileSpreadsheet, FileText, Hash, Moon, Settings, Sun } from "lucide-react";
import { FILTER_TYPES, TYPE_LABELS } from "../lib/documents";
import type { DocumentType, KnowledgeDocument } from "../lib/types";

interface SidebarProps {
  activeTag: string;
  activeType: DocumentType | "all";
  counts: Record<DocumentType, number>;
  documents: KnowledgeDocument[];
  documentsOpen: boolean;
  sidebarCollapsed: boolean;
  tags: string[];
  tagsOpen: boolean;
  theme: "light" | "dark";
  onActiveTagChange: (tag: string) => void;
  onActiveTypeChange: (type: DocumentType | "all") => void;
  onDocumentsOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onOpenSettings: () => void;
  onSidebarCollapsedChange: (collapsed: boolean | ((collapsed: boolean) => boolean)) => void;
  onTagsOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onThemeChange: (theme: "light" | "dark") => void;
}

export function Sidebar({
  activeTag,
  activeType,
  counts,
  documents,
  documentsOpen,
  sidebarCollapsed,
  tags,
  tagsOpen,
  theme,
  onActiveTagChange,
  onActiveTypeChange,
  onDocumentsOpenChange,
  onOpenSettings,
  onSidebarCollapsedChange,
  onTagsOpenChange,
  onThemeChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="wordmark">
          based<em>.</em>
        </div>
        <div className="head-actions">
          <button className="icon-btn" title="Toggle theme" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className={`nav-group${documentsOpen ? "" : " collapsed"}`}>
          <button
            className={`nav-item nav-parent${activeType === "all" ? " active" : ""}`}
            aria-expanded={documentsOpen}
            onClick={() => {
              onDocumentsOpenChange((open) => !open);
              onActiveTypeChange("all");
            }}
          >
            <FileText size={14} />
            <span className="nav-label">All documents</span>
            <ChevronDown className="nav-chevron" size={12} />
          </button>
          <div className="nav-children">
            {FILTER_TYPES.map((type) => (
              <button key={type} className={`nav-item nav-child${activeType === type ? " active" : ""}`} onClick={() => onActiveTypeChange(type)}>
                {type === "xlsx" ? <FileSpreadsheet size={14} /> : <File size={14} />}
                <span className="nav-label">{TYPE_LABELS[type]}</span>
                <span className="nav-count">{counts[type]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`nav-group tag-group${tagsOpen ? "" : " collapsed"}`}>
          <button className="nav-item nav-parent" aria-expanded={tagsOpen} onClick={() => onTagsOpenChange((open) => !open)}>
            <span className="tag-hash">#</span>
            <span className="nav-label">Tags</span>
            <ChevronDown className="nav-chevron" size={12} />
          </button>
          <div className="nav-children">
            <button className={`nav-item nav-child${activeTag === "all" ? " active" : ""}`} onClick={() => onActiveTagChange("all")}>
              <Hash size={14} />
              <span className="nav-label">All tags</span>
              <span className="nav-count">{tags.length}</span>
            </button>
            {tags.map((tag) => (
              <button key={tag} className={`nav-item nav-child${activeTag === tag ? " active" : ""}`} onClick={() => onActiveTagChange(tag)}>
                <span className="tag-hash">#</span>
                <span className="nav-label">{tag}</span>
                <span className="nav-count">{documents.filter((doc) => doc.tags.includes(tag)).length}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="sidebar-foot">
        <div className="foot-row">
          <button className="foot-btn settings-btn" title="Settings" onClick={onOpenSettings}>
            <Settings size={14} />
            <span className="foot-label">Settings</span>
          </button>
          <button
            className="foot-btn sidebar-toggle"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => onSidebarCollapsedChange((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            <span className="foot-label">{sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
