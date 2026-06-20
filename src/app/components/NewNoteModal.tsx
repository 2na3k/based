import { Modal } from "./Modal";
import { TagInput } from "./TagInput";

interface NewNoteModalProps {
  description: string;
  open: boolean;
  saving: boolean;
  tags: string;
  title: string;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onTagsChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}

export function NewNoteModal({
  description,
  open,
  saving,
  tags,
  title,
  onClose,
  onDescriptionChange,
  onSave,
  onTagsChange,
  onTitleChange,
}: NewNoteModalProps) {
  return (
    <Modal open={open} title="New note" titleId="newNoteTitle" onClose={onClose}>
      <div className="settings-body source-form">
        <label>
          <span>Name</span>
          <input autoFocus value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
        </label>
        <label>
          <span>Tags</span>
          <TagInput value={tags} onChange={onTagsChange} />
        </label>
        <div className="form-actions">
          <button className="btn-ghost" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving || !title.trim()} onClick={onSave}>
            {saving ? "Creating..." : "Create note"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
