import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

interface PdfCanvasProps {
  className?: string;
  documentId: number;
  mode: "preview" | "thumbnail";
  title: string;
}

interface PdfPageCanvasProps {
  lazy: boolean;
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  renderTextLayer: boolean;
  scale: number;
}

let pdfJsPromise: Promise<PdfJs> | null = null;
const PREVIEW_PAGE_BATCH = 4;
const DEFAULT_PREVIEW_SCALE = 1.2;
const MIN_PREVIEW_SCALE = 0.7;
const MAX_PREVIEW_SCALE = 2.4;
const ZOOM_STEP = 0.2;

function loadPdfJs() {
  pdfJsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfJsPromise;
}

function validatePdfBytes(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new Error("This source is marked as a PDF, but the stored file is not a valid PDF.");
  }

  const tailStart = Math.max(0, bytes.length - 2048);
  const tail = new TextDecoder().decode(bytes.slice(tailStart));
  if (!tail.includes("%%EOF")) {
    throw new Error("This PDF looks incomplete or damaged, so it cannot be previewed.");
  }
}

function PdfPageCanvas({ lazy, pageNumber, pdfDocument, renderTextLayer, scale }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [renderEnabled, setRenderEnabled] = useState(true);

  useEffect(() => {
    if (!lazy) {
      setRenderEnabled(true);
      return;
    }

    const pageElement = pageRef.current;
    const scrollRoot = pageElement?.closest(".pdf-pages");
    if (!pageElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setRenderEnabled(entry.isIntersecting);
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "1200px 0px",
      },
    );
    observer.observe(pageElement);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    let cancelled = false;
    let page: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    const canvas = canvasRef.current;
    const pageElement = pageRef.current;
    const textLayerElement = textLayerRef.current;
    if (!canvas || !pageElement || !textLayerElement) return;
    textLayerElement.replaceChildren();
    if (!renderEnabled) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    pdfDocument
      .getPage(pageNumber)
      .then(async (loadedPage) => {
        page = loadedPage;
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        const deviceScale = window.devicePixelRatio || 1;
        pageElement.style.width = `${Math.floor(viewport.width)}px`;
        pageElement.style.height = `${Math.floor(viewport.height)}px`;
        canvas.width = Math.floor(viewport.width * deviceScale);
        canvas.height = Math.floor(viewport.height * deviceScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        renderTask = null;
        if (!renderTextLayer) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        textLayerElement.style.width = `${Math.floor(viewport.width)}px`;
        textLayerElement.style.height = `${Math.floor(viewport.height)}px`;
        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        textLayer = new pdfjs.TextLayer({
          container: textLayerElement,
          textContentSource: textContent,
          viewport,
        });
        await textLayer.render();
      })
      .catch(() => {
        if (!cancelled) {
          canvas.width = 0;
          canvas.height = 0;
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      textLayerElement.replaceChildren();
      page?.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [pageNumber, pdfDocument, renderEnabled, renderTextLayer, scale]);

  return (
    <div className="pdf-page" ref={pageRef}>
      <canvas className="pdf-canvas" ref={canvasRef} />
      <div className="pdf-text-layer" ref={textLayerRef} />
    </div>
  );
}

export function PdfCanvas({ className = "", documentId, mode, title }: PdfCanvasProps) {
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [visiblePages, setVisiblePages] = useState(PREVIEW_PAGE_BATCH);
  const [previewScale, setPreviewScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdfDocument(null);
    setError("");
    setPageCount(0);
    setVisiblePages(PREVIEW_PAGE_BATCH);
    setPreviewScale(DEFAULT_PREVIEW_SCALE);
    setState("loading");

    fetch(`/api/documents/${documentId}/content`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const message = response.headers.get("x-preview-error") ?? (response.status === 404 ? "The original PDF file is missing from local storage." : null);
          throw new Error(message ?? `PDF preview failed (${response.status})`);
        }
        if (!response.headers.get("content-type")?.includes("application/pdf")) {
          throw new Error("Preview source is not a PDF file.");
        }

        const buffer = await response.arrayBuffer();
        validatePdfBytes(buffer);

        const pdfjs = await loadPdfJs();
        loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        if (controller.signal.aborted || disposed) {
          await loadingTask.destroy().catch(() => undefined);
          return;
        }
        setPageCount(pdf.numPages);
        setPdfDocument(pdf);
        setState("ready");
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load PDF preview.");
        setState("error");
      });

    return () => {
      disposed = true;
      controller.abort();
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [documentId]);

  if (state === "loading") {
    return (
      <div className={`pdf-render pdf-render-loading ${className}`}>
        <Loader2 className="preview-spinner" size={mode === "thumbnail" ? 16 : 20} />
        <span>{mode === "thumbnail" ? "Loading preview" : "Loading PDF preview..."}</span>
      </div>
    );
  }

  if (state === "error" || !pdfDocument) {
    return (
      <div className={`pdf-render pdf-render-error ${className}`} role="alert">
        <AlertCircle size={mode === "thumbnail" ? 16 : 22} />
        <span>{mode === "thumbnail" ? "No preview" : error}</span>
      </div>
    );
  }

  const pagesToRender = mode === "thumbnail" ? [1] : Array.from({ length: Math.min(pageCount, visiblePages) }, (_, index) => index + 1);

  function loadMorePages() {
    setVisiblePages((current) => Math.min(pageCount, current + PREVIEW_PAGE_BATCH));
  }

  function updatePreviewScale(nextScale: number) {
    setPreviewScale(Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, Math.round(nextScale * 10) / 10)));
  }

  return (
    <div className={`pdf-render pdf-render-${mode} ${className}`} aria-label={`${title} PDF preview`}>
      {mode === "preview" ? (
        <div className="pdf-preview-toolbar">
          <span>
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
          <span className="pdf-zoom-actions" aria-label="PDF zoom controls">
            <button type="button" disabled={previewScale <= MIN_PREVIEW_SCALE} onClick={() => updatePreviewScale(previewScale - ZOOM_STEP)}>
              -
            </button>
            <span>{Math.round((previewScale / DEFAULT_PREVIEW_SCALE) * 100)}%</span>
            <button type="button" disabled={previewScale >= MAX_PREVIEW_SCALE} onClick={() => updatePreviewScale(previewScale + ZOOM_STEP)}>
              +
            </button>
            <button type="button" onClick={() => updatePreviewScale(DEFAULT_PREVIEW_SCALE)}>
              Reset
            </button>
          </span>
        </div>
      ) : null}
      <div
        className="pdf-pages"
        onScroll={(event) => {
          if (mode !== "preview" || visiblePages >= pageCount) return;
          const target = event.currentTarget;
          if (target.scrollTop + target.clientHeight >= target.scrollHeight - 600) {
            loadMorePages();
          }
        }}
      >
        {pagesToRender.map((page) => (
          <PdfPageCanvas
            key={page}
            lazy={mode === "preview"}
            pageNumber={page}
            pdfDocument={pdfDocument}
            renderTextLayer={mode === "preview"}
            scale={mode === "thumbnail" ? 0.42 : previewScale}
          />
        ))}
        {mode === "preview" && visiblePages < pageCount ? (
          <button className="pdf-load-more" type="button" onClick={loadMorePages}>
            Load more pages
          </button>
        ) : null}
      </div>
    </div>
  );
}
