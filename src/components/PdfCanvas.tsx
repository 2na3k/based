import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

type PdfJs = typeof import("pdfjs-dist");

interface PdfCanvasProps {
  className?: string;
  documentId: number;
  mode: "preview" | "thumbnail";
  title: string;
}

interface PdfPageCanvasProps {
  data: ArrayBuffer;
  pageNumber: number;
  scale: number;
}

let pdfJsPromise: Promise<PdfJs> | null = null;
const PREVIEW_PAGE_BATCH = 4;

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

function PdfPageCanvas({ data, pageNumber, scale }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const pageElement = pageRef.current;
    const textLayerElement = textLayerRef.current;
    if (!canvas || !pageElement || !textLayerElement) return;
    textLayerElement.replaceChildren();

    loadPdfJs()
      .then(async (pdfjs) => {
        const loadingTask = pdfjs.getDocument({ data: data.slice(0) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
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
        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        textLayerElement.style.width = `${Math.floor(viewport.width)}px`;
        textLayerElement.style.height = `${Math.floor(viewport.height)}px`;
        const textLayer = new pdfjs.TextLayer({
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
    };
  }, [data, pageNumber, scale]);

  return (
    <div className="pdf-page" ref={pageRef}>
      <canvas className="pdf-canvas" ref={canvasRef} />
      <div className="pdf-text-layer" ref={textLayerRef} />
    </div>
  );
}

export function PdfCanvas({ className = "", documentId, mode, title }: PdfCanvasProps) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [visiblePages, setVisiblePages] = useState(PREVIEW_PAGE_BATCH);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setPageCount(0);
    setVisiblePages(PREVIEW_PAGE_BATCH);
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
        const loadingTask = pdfjs.getDocument({ data: buffer.slice(0) });
        const pdf = await loadingTask.promise;
        if (controller.signal.aborted) return;
        setPageCount(pdf.numPages);
        setData(buffer);
        setState("ready");
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load PDF preview.");
        setState("error");
      });

    return () => controller.abort();
  }, [documentId]);

  if (state === "loading") {
    return (
      <div className={`pdf-render pdf-render-loading ${className}`}>
        <Loader2 className="preview-spinner" size={mode === "thumbnail" ? 16 : 20} />
        <span>{mode === "thumbnail" ? "Loading preview" : "Loading PDF preview..."}</span>
      </div>
    );
  }

  if (state === "error" || !data) {
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

  return (
    <div className={`pdf-render pdf-render-${mode} ${className}`} aria-label={`${title} PDF preview`}>
      {mode === "preview" ? (
        <div className="pdf-preview-toolbar">
          <span>
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
          <span>Scroll preview</span>
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
          <PdfPageCanvas key={page} data={data} pageNumber={page} scale={mode === "thumbnail" ? 0.42 : 1.2} />
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
