import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { formatMeta, TYPE_LABELS } from "../lib/documents";
import type { KnowledgeDocument } from "../lib/types";

interface PreviewSidebarProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function PreviewSidebar({ document, onClose, onResizeStart }: PreviewSidebarProps) {
  const canRenderPdf = document?.type === "pdf";
  const sourceUrl = document ? `/api/documents/${document.id}/content` : "";
  const pdfPreviewUrl = `${sourceUrl}#toolbar=0&navpanes=0&scrollbar=0`;
  const [pdfState, setPdfState] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!canRenderPdf) {
      setPdfState("idle");
      setPdfError("");
      return;
    }

    const controller = new AbortController();
    setPdfState("checking");
    setPdfError("");

    fetch(sourceUrl, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          const message = response.headers.get("x-preview-error") ?? (response.status === 404 ? "The original PDF file is missing from local storage." : null);
          throw new Error(message ?? `PDF preview failed (${response.status})`);
        }
        if (!response.headers.get("content-type")?.includes("application/pdf")) {
          throw new Error("Preview source is not a PDF file");
        }
        setPdfState("ready");
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setPdfState("error");
        setPdfError(caught instanceof Error ? caught.message : "Could not load PDF preview");
      });

    return () => controller.abort();
  }, [canRenderPdf, sourceUrl]);

  if (!document) return null;

  return (
    <aside className="preview-sidebar" aria-label="Document preview">
      <button className="preview-resize-handle" aria-label="Resize preview" title="Resize preview" onPointerDown={onResizeStart} />
      <div className="preview-head">
        <div className="preview-title-wrap">
          <span className="type-badge">{TYPE_LABELS[document.type]}</span>
          <div className="preview-title">{document.title}</div>
        </div>
        <button className="icon-btn" title="Close preview" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="preview-meta">
        <div className="preview-source">{document.source}</div>
        <div>{formatMeta(document)}</div>
        {document.tags.length ? (
          <div className="preview-tags">
            {document.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="preview-body">
        {canRenderPdf && pdfState === "checking" ? (
          <div className="preview-empty">
            <Loader2 className="preview-spinner" size={20} />
            <span>Checking PDF preview...</span>
          </div>
        ) : canRenderPdf && pdfState === "error" ? (
          <div className="preview-empty preview-error" role="alert">
            <AlertCircle size={22} />
            <span>{pdfError}</span>
          </div>
        ) : canRenderPdf && pdfState === "ready" ? (
          <iframe className="pdf-frame" title={`${document.title} preview`} src={pdfPreviewUrl} />
        ) : document.type === "web" ? (
          <a className="preview-empty" href={document.source} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            <span>Open web source</span>
          </a>
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
