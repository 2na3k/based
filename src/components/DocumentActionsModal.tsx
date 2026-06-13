import type { KnowledgeDocument } from "../lib/types";
import { Modal } from "./Modal";

interface DocumentActionsModalProps {
  document: KnowledgeDocument | null;
  deleting: boolean;
  saving: boolean;
  tags: string;
  title: string;
  onClose: () => void;
  onDelete: () => void;
  onTagsChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onUpdate: () => void;
}

export function DocumentActionsModal({
  document,
  deleting,
  saving,
  tags,
  title,
  onClose,
  onDelete,
  onTagsChange,
  onTitleChange,
  onUpdate,
}: DocumentActionsModalProps) {
  return (
    <Modal open={Boolean(document)} title="Source actions" titleId="sourceActionsTitle" onClose={onClose}>
      <div className="settings-body source-form">
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <label>
          <span>Tags</span>
          <input placeholder="research, notes" value={tags} onChange={(event) => onTagsChange(event.target.value)} />
        </label>
        <div className="source-file">{document?.source}</div>
        <div className="form-actions split-actions">
          <button className="btn-danger" disabled={deleting || saving} onClick={onDelete}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <span />
          <button className="btn-ghost" disabled={deleting || saving} onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={deleting || saving || !title.trim()} onClick={onUpdate}>
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
