import { ChevronDown, ChevronsLeft, ChevronsRight, FileText, Moon, Plug, Settings, Sun } from "lucide-react";
import type { ConnectorId, ConnectorListItem, DocumentType } from "../lib/types";

interface SidebarProps {
  activeFilterGroup: "documents" | "tags";
  activeConnectorId: ConnectorId | null;
  activeTag: string;
  activeType: DocumentType | "all";
  connectors: ConnectorListItem[];
  connectorsOpen: boolean;
  sidebarCollapsed: boolean;
  tags: string[];
  tagsOpen: boolean;
  theme: "light" | "dark";
  onActiveTagChange: (tag: string) => void;
  onActiveTypeChange: (type: DocumentType | "all") => void;
  onConnectorsOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onOpenSettings: () => void;
  onOpenConnector: (id: ConnectorId) => void;
  onSidebarCollapsedChange: (collapsed: boolean | ((collapsed: boolean) => boolean)) => void;
  onTagsOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onThemeChange: (theme: "light" | "dark") => void;
}

export function Sidebar({
  activeFilterGroup,
  activeConnectorId,
  activeTag,
  activeType,
  connectors,
  connectorsOpen,
  sidebarCollapsed,
  tags,
  tagsOpen,
  theme,
  onActiveTagChange,
  onActiveTypeChange,
  onConnectorsOpenChange,
  onOpenConnector,
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
        <div className="nav-group">
          <button
            className={`nav-item nav-parent${activeFilterGroup === "documents" && activeType === "all" ? " active" : ""}`}
            onClick={() => onActiveTypeChange("all")}
          >
            <FileText size={14} />
            <span className="nav-label">All documents</span>
          </button>
        </div>

        {connectors.length ? (
          <div className={`nav-group tag-group${connectorsOpen ? "" : " collapsed"}`}>
            <button className="nav-item nav-parent" aria-expanded={connectorsOpen} onClick={() => onConnectorsOpenChange((open) => !open)}>
              <Plug size={14} />
              <span className="nav-label">Connectors</span>
              <ChevronDown className="nav-chevron" size={12} />
            </button>
            <div className="nav-children">
              {connectors.map((connector) => (
                <button
                  key={connector.definition.id}
                  className={`nav-item nav-child${activeConnectorId === connector.definition.id ? " active" : ""}`}
                  onClick={() => onOpenConnector(connector.definition.id)}
                >
                  <Plug size={13} />
                  <span className="nav-label">{connector.definition.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={`nav-group tag-group${tagsOpen ? "" : " collapsed"}`}>
          <button className="nav-item nav-parent" aria-expanded={tagsOpen} onClick={() => onTagsOpenChange((open) => !open)}>
            <span className="tag-hash">#</span>
            <span className="nav-label">Tags</span>
            <ChevronDown className="nav-chevron" size={12} />
          </button>
          <div className="nav-children">
            <button
              className={`nav-item nav-child${activeFilterGroup === "tags" && activeTag === "all" ? " active" : ""}`}
              onClick={() => onActiveTagChange("all")}
            >
              <span className="tag-hash">#</span>
              <span className="nav-label">All tags</span>
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                className={`nav-item nav-child${activeFilterGroup === "tags" && activeTag === tag ? " active" : ""}`}
                onClick={() => onActiveTagChange(tag)}
              >
                <span className="tag-hash">#</span>
                <span className="nav-label">{tag}</span>
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
