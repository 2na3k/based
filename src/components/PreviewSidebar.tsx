import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, ExternalLink, FileText, Loader2, X } from "lucide-react";
import type { KnowledgeDocument } from "../lib/types";

interface PreviewSidebarProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function PreviewSidebar({ document, onClose, onResizeStart }: PreviewSidebarProps) {
  const canRenderPdf = document?.type === "pdf";
  const sourceUrl = document ? `/api/documents/${document.id}/content` : "";
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfState, setPdfState] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!canRenderPdf) {
      setPdfState("idle");
      setPdfError("");
      setPdfPreviewUrl("");
      return;
    }

    const controller = new AbortController();
    let objectUrl = "";
    setPdfState("checking");
    setPdfError("");
    setPdfPreviewUrl("");

    fetch(sourceUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const message = response.headers.get("x-preview-error") ?? (response.status === 404 ? "The original PDF file is missing from local storage." : null);
          throw new Error(message ?? `PDF preview failed (${response.status})`);
        }
        if (!response.headers.get("content-type")?.includes("application/pdf")) {
          throw new Error("Preview source is not a PDF file");
        }
        const blob = await response.blob();
        const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
        if (header !== "%PDF-") {
          throw new Error("This source is marked as a PDF, but the stored file is not a valid PDF.");
        }
        const tailStart = Math.max(0, blob.size - 2048);
        const tail = new TextDecoder().decode(await blob.slice(tailStart).arrayBuffer());
        if (!tail.includes("%%EOF")) {
          throw new Error("This PDF looks incomplete or damaged, so it cannot be previewed.");
        }
        objectUrl = URL.createObjectURL(blob);
        setPdfPreviewUrl(`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0`);
        setPdfState("ready");
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setPdfState("error");
        setPdfPreviewUrl("");
        setPdfError(caught instanceof Error ? caught.message : "Could not load PDF preview");
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canRenderPdf, sourceUrl]);

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
