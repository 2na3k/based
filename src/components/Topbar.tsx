import type { RefObject } from "react";
import { Search, Upload } from "lucide-react";

interface TopbarProps {
  fileInput: RefObject<HTMLInputElement | null>;
  searchQ: string;
  onFilesChange: (files: FileList | null) => void;
  onOpenSourceChooser: () => void;
  onSearchChange: (value: string) => void;
}

export function Topbar({ fileInput, searchQ, onFilesChange, onOpenSourceChooser, onSearchChange }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="search-wrap">
          <span className="search-icon">
            <Search size={14} />
          </span>
          <input
            id="searchInput"
            className="search-input"
            placeholder="Search documents..."
            value={searchQ}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <span className="search-kbd">⌘K</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
          <Upload size={13} /> Import
        </button>
        <button className="btn-primary" onClick={onOpenSourceChooser}>
          + Add
        </button>
        <input ref={fileInput} className="visually-hidden" type="file" onChange={(event) => onFilesChange(event.target.files)} />
      </div>
    </header>
  );
}
