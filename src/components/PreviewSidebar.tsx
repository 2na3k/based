import type { PointerEvent as ReactPointerEvent } from "react";
import { FileText, X } from "lucide-react";
import type { KnowledgeDocument } from "../lib/types";
import { PdfCanvas } from "./PdfCanvas";
import { WebReader } from "./WebReader";

interface PreviewSidebarProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function PreviewSidebar({ document, onClose, onResizeStart }: PreviewSidebarProps) {
  const canRenderPdf = document?.type === "pdf";

  if (!document) return null;

  return (
    <aside className="preview-sidebar" aria-label="Document preview">
      <button className="preview-resize-handle" aria-label="Resize preview" title="Resize preview" onPointerDown={onResizeStart} />
      <div className="preview-head">
        <div className="preview-title-wrap">
          <div className="preview-title">{document.title}</div>
        </div>
        <button className="icon-btn" title="Close preview" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="preview-body">
        {canRenderPdf ? (
          <PdfCanvas documentId={document.id} mode="preview" title={document.title} />
        ) : document.type === "web" ? (
          <WebReader document={document} />
        ) : (
          <div className="preview-empty">
            <FileText size={24} />
            <span>Preview is available for PDF files.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
