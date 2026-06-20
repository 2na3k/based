import { ExternalLink, FolderSearch, Pencil, Trash2 } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActionsMenuPosition } from "./DocumentCard";
import type { KnowledgeDocument } from "../lib/types";
import { Modal } from "./Modal";
import { TagInput } from "./TagInput";

interface DocumentActionsModalProps {
  document: KnowledgeDocument | null;
  deleting: boolean;
  menuPosition: ActionsMenuPosition | null;
  saving: boolean;
  tags: string;
  title: string;
  onClose: () => void;
  onDelete: () => void;
  onOpenExternal: () => void;
  onRevealInFinder: () => void;
  onTagsChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onUpdate: () => void;
}

const MENU_WIDTH = 168;
const MENU_HEIGHT = 172;
const MENU_MARGIN = 8;

function clampedMenuStyle(position: ActionsMenuPosition | null): CSSProperties {
  if (typeof window === "undefined") {
    return {
      left: position?.left ?? 0,
      top: position?.top ?? 0,
    };
  }

  return {
    left: Math.max(MENU_MARGIN, Math.min(position?.left ?? 0, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
    top: Math.max(MENU_MARGIN, Math.min(position?.top ?? 0, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)),
  };
}

export function DocumentActionsModal({
  document,
  deleting,
  menuPosition,
  saving,
  tags,
  title,
  onClose,
  onDelete,
  onOpenExternal,
  onRevealInFinder,
  onTagsChange,
  onTitleChange,
  onUpdate,
}: DocumentActionsModalProps) {
  const [mode, setMode] = useState<"menu" | "edit">("menu");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode("menu");
  }, [document?.id]);

  useEffect(() => {
    if (!document || mode !== "menu") return;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || menuRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [document, mode, onClose]);

  if (!document) return null;

  const menuStyle = clampedMenuStyle(menuPosition);

  if (mode === "menu") {
    return createPortal(
      <div ref={menuRef} className="action-popover" role="menu" style={menuStyle} aria-label="Source actions">
        <button className="action-row" role="menuitem" disabled={deleting || saving} onClick={onOpenExternal}>
          <ExternalLink size={15} />
          <span>Open in</span>
        </button>
        {document.type !== "web" ? (
          <button className="action-row" role="menuitem" disabled={deleting || saving} onClick={onRevealInFinder}>
            <FolderSearch size={15} />
            <span>Show in Finder</span>
          </button>
        ) : null}
        <button className="action-row" role="menuitem" disabled={deleting || saving} onClick={() => setMode("edit")}>
          <Pencil size={15} />
          <span>Edit</span>
        </button>
        <button className="action-row danger" role="menuitem" disabled={deleting || saving} onClick={onDelete}>
          <Trash2 size={15} />
          <span>{deleting ? "Deleting..." : "Delete"}</span>
        </button>
      </div>,
      globalThis.document.body,
    );
  }

  return (
    <Modal open title="Edit source" titleId="sourceActionsTitle" onClose={onClose}>
      <div className="settings-body source-form">
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <label>
          <span>Tags</span>
          <TagInput value={tags} onChange={onTagsChange} />
        </label>
        <div className="source-file">{document.source}</div>
        {document.type === "note" ? <div className="source-file">Title and tags sync to Markdown frontmatter.</div> : null}
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
