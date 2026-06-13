import { FILTER_TYPES, TYPE_LABELS } from "../lib/documents";
import type { DocumentType, PendingSource } from "../lib/types";
import { Modal } from "./Modal";

interface SourceFormModalProps {
  formTags: string;
  formTitle: string;
  formType: DocumentType;
  formUrl: string;
  pending: PendingSource | null;
  saving: boolean;
  onClose: () => void;
  onFormTagsChange: (value: string) => void;
  onFormTitleChange: (value: string) => void;
  onFormTypeChange: (type: DocumentType) => void;
  onFormUrlChange: (value: string) => void;
  onSave: () => void;
}

export function SourceFormModal({
  formTags,
  formTitle,
  formType,
  formUrl,
  pending,
  saving,
  onClose,
  onFormTagsChange,
  onFormTitleChange,
  onFormTypeChange,
  onFormUrlChange,
  onSave,
}: SourceFormModalProps) {
  return (
    <Modal open={Boolean(pending)} title="Add source" titleId="addTitle" onClose={onClose}>
      <div className="settings-body source-form">
        {pending?.kind === "web" ? (
          <label>
            <span>URL</span>
            <input placeholder="https://example.com" value={formUrl} onChange={(event) => onFormUrlChange(event.target.value)} />
          </label>
        ) : null}
        <label>
          <span>Title</span>
          <input value={formTitle} onChange={(event) => onFormTitleChange(event.target.value)} />
        </label>
        {pending?.kind === "file" ? (
          <label>
            <span>Type</span>
            <select value={formType} onChange={(event) => onFormTypeChange(event.target.value as DocumentType)}>
              {FILTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span>Tags</span>
          <input placeholder="research, notes" value={formTags} onChange={(event) => onFormTagsChange(event.target.value)} />
        </label>
        <div className="source-file">{pending?.kind === "file" ? pending.file.name : "Web source"}</div>
        <div className="form-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={saving || (pending?.kind === "file" && !formTitle.trim()) || (pending?.kind === "web" && !formUrl.trim())}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Save source"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
