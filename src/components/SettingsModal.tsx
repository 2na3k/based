import { List, Moon, Sun, Upload } from "lucide-react";
import type { AppConfig, ViewMode } from "../lib/types";
import { Modal } from "./Modal";

interface SettingsModalProps {
  open: boolean;
  storage: AppConfig["storage"] | null;
  theme: "light" | "dark";
  onClose: () => void;
  onShowMessage: (message: string) => void;
  onThemeChange: (theme: "light" | "dark") => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

export function SettingsModal({ open, storage, theme, onClose, onShowMessage, onThemeChange, onViewModeChange }: SettingsModalProps) {
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
