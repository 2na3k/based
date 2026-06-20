import { List, Moon, Sun, Upload } from "lucide-react";
import { TYPE_LABELS } from "../lib/documents";
import type { AppConfig, DocumentType, OpenApp, OpenAppConfig, ViewMode } from "../lib/types";
import { Modal } from "./Modal";

const OPEN_APP_LABELS: Record<OpenApp, string> = {
  system: "System default",
  vscode: "VS Code",
  zed: "Zed",
  obsidian: "Obsidian",
};

const OPEN_APP_OPTIONS: readonly OpenApp[] = ["system", "vscode", "zed", "obsidian"];
const OPEN_APP_TYPES: readonly DocumentType[] = ["note", "pdf", "doc", "xlsx", "paper", "web"];

interface SettingsModalProps {
  open: boolean;
  storage: AppConfig["storage"] | null;
  theme: "light" | "dark";
  openApps: OpenAppConfig;
  onClose: () => void;
  onOpenAppChange: (type: DocumentType, app: OpenApp) => void;
  onShowMessage: (message: string) => void;
  onThemeChange: (theme: "light" | "dark") => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

export function SettingsModal({ open, storage, theme, openApps, onClose, onOpenAppChange, onShowMessage, onThemeChange, onViewModeChange }: SettingsModalProps) {
  return (
    <Modal open={open} title="Settings" titleId="settingsTitle" closeTitle="Close settings" onClose={onClose}>
      <div className="settings-body">
        <div className="setting-group">
          <button className="setting-row" onClick={() => onShowMessage("MCP export is not configured yet")}>
            <Upload size={14} />
            <span className="setting-main">
              <span className="setting-name">Export to MCP</span>
              <span className="setting-desc">Package current knowledge base for local tools.</span>
            </span>
            <span className="setting-meta">soon</span>
          </button>
        </div>
        <div className="setting-group">
          <div className="setting-section-title">Default open app</div>
          {OPEN_APP_TYPES.map((type) => (
            <label key={type} className="setting-row setting-select-row">
              <span className="setting-main">
                <span className="setting-name">{TYPE_LABELS[type]}</span>
                <span className="setting-desc">Used by Open in for this source type.</span>
              </span>
              <select className="setting-select" value={openApps[type] ?? "system"} onChange={(event) => onOpenAppChange(type, event.target.value as OpenApp)}>
                {OPEN_APP_OPTIONS.map((app) => (
                  <option key={app} value={app}>
                    {OPEN_APP_LABELS[app]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="setting-group">
          <button className="setting-row" onClick={() => onViewModeChange("list")}>
            <List size={14} />
            <span className="setting-main">
              <span className="setting-name">Default to list</span>
              <span className="setting-desc">Keep documents dense and scannable.</span>
            </span>
            <span className="setting-meta">on</span>
          </button>
          <button className="setting-row" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            <span className="setting-main">
              <span className="setting-name">Toggle theme</span>
              <span className="setting-desc">Switch between light and dark mode.</span>
            </span>
          </button>
          {storage ? (
            <div className="storage-note">
              <span>{storage.configPath}</span>
              <span>{storage.documentsDir}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
