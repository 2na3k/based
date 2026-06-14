import { useLayoutEffect, useRef, useState } from "react";
import { TYPE_LABELS, formatMeta } from "../lib/documents";
import type { KnowledgeDocument } from "../lib/types";

export type PreviewTarget =
  | { kind: "document"; document: KnowledgeDocument }
  | { kind: "external"; url: string };

interface LinkPreviewBubbleProps {
  target: PreviewTarget;
  x: number;
  y: number;
}

const GAP = 12;

export function LinkPreviewBubble({ target, x, y }: LinkPreviewBubbleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x + GAP, top: y + GAP });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();

    let left = x + GAP;
    let top = y + GAP;

    if (left + rect.width > window.innerWidth - GAP) {
      left = x - rect.width - GAP;
    }
    if (top + rect.height > window.innerHeight - GAP) {
      top = y - rect.height - GAP;
    }
    if (left < GAP) left = GAP;
    if (top < GAP) top = GAP;

    setPosition({ left, top });
  }, [x, y, target]);

  return (
    <div
      ref={ref}
      className="link-preview-bubble"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
      }}
    >
      {target.kind === "document" ? (
        <DocumentPreview document={target.document} />
      ) : (
        <ExternalPreview url={target.url} />
      )}
    </div>
  );
}

function DocumentPreview({ document: doc }: { document: KnowledgeDocument }) {
  return (
    <div className="link-preview-inner">
      <div className="link-preview-head">
        <span className="link-preview-type">{TYPE_LABELS[doc.type]}</span>
        <span className="link-preview-meta">{formatMeta(doc)}</span>
      </div>
      <div className="link-preview-title" title={doc.title}>
        {doc.title}
      </div>
      <div className="link-preview-source" title={doc.source}>
        {doc.source}
      </div>
      {doc.tags.length > 0 && (
        <div className="link-preview-tags">
          {doc.tags.map((tag) => (
            <span key={tag} className="link-preview-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExternalPreview({ url }: { url: string }) {
  return (
    <div className="link-preview-inner">
      <div className="link-preview-head">
        <span className="link-preview-type">Link</span>
      </div>
      <div className="link-preview-source" title={url}>
        {url}
      </div>
    </div>
  );
}
