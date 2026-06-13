import type { RefObject } from "react";
import { Link, Upload } from "lucide-react";
import { Modal } from "./Modal";

interface SourceChooserModalProps {
  fileInput: RefObject<HTMLInputElement | null>;
  open: boolean;
  onClose: () => void;
  onOpenWebPending: () => void;
}

export function SourceChooserModal({ fileInput, open, onClose, onOpenWebPending }: SourceChooserModalProps) {
  return (
    <Modal open={open} title="Add source" titleId="sourceChoiceTitle" className="source-choice-panel" onClose={onClose}>
      <div className="settings-body">
        <button className="setting-row" onClick={() => fileInput.current?.click()}>
          <Upload size={14} />
          <span className="setting-main">
            <span className="setting-name">Upload file</span>
            <span className="setting-desc">Add PDF, document, spreadsheet, or note files.</span>
          </span>
        </button>
        <button className="setting-row" onClick={onOpenWebPending}>
          <Link size={14} />
          <span className="setting-main">
            <span className="setting-name">Web URL</span>
            <span className="setting-desc">Save a website link with title and tags.</span>
          </span>
        </button>
      </div>
    </Modal>
  );
}
