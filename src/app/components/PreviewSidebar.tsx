import type { PointerEvent as ReactPointerEvent } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { openDocumentExternally } from "../lib/api";
import type { KnowledgeDocument } from "../lib/types";
import { PdfCanvas } from "./PdfCanvas";
import { WebReader } from "./WebReader";

interface PreviewSidebarProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function openTargetForDocument(document: KnowledgeDocument): string | null {
  if (document.type === "web") return document.source;
  return null;
}

export function PreviewSidebar({ document, onClose, onResizeStart }: PreviewSidebarProps) {
  const canRenderPdf = document?.type === "pdf";

  if (!document) return null;

  async function openInAnotherApp() {
    if (!document) return;

    const target = openTargetForDocument(document);
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await openDocumentExternally(document.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open source externally";
      window.alert(message);
    }
  }

  return (
    <aside className="preview-sidebar" aria-label="Document preview">
      <button className="preview-resize-handle" aria-label="Resize preview" title="Resize preview" onPointerDown={onResizeStart} />
      <div className="preview-head">
        <div className="preview-title-wrap">
          <div className="preview-title">{document.title}</div>
        </div>
        <div className="preview-actions">
          <button className="icon-btn" title="Open in another app" aria-label="Open in another app" onClick={openInAnotherApp}>
            <ExternalLink size={14} />
          </button>
          <button className="icon-btn" title="Close preview" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
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
