import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { formatDate, TYPE_LABELS } from "../lib/documents";
import type { DocumentType, KnowledgeDocument } from "../lib/types";

export interface ActionsMenuPosition {
  left: number;
  top: number;
}

interface DocumentCardProps {
  doc: KnowledgeDocument;
  selected: boolean;
  onActions: (doc: KnowledgeDocument, position: ActionsMenuPosition) => void;
  onSelect: (doc: KnowledgeDocument) => void;
  onTagClick: (tag: string) => void;
}

function FilePreview({ type }: { type: DocumentType }) {
  return (
    <div className={`card-preview file-preview ${type}-preview`} aria-hidden="true">
      <div className="file-page">
        <span className="file-corner" />
        <span />
        <span />
        <span />
        <span className="short" />
      </div>
    </div>
  );
}

function PdfCoverPreview({ doc }: { doc: KnowledgeDocument }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <FilePreview type="pdf" />;

  return (
    <div className="card-preview pdf-card-preview pdf-render pdf-render-thumbnail" aria-hidden="true">
      <div className="pdf-pages">
        <div className="pdf-page">
          <img className="pdf-canvas" src={`/api/documents/${doc.id}/cover`} alt="" decoding="async" onError={() => setFailed(true)} />
        </div>
      </div>
    </div>
  );
}

function CardPreview({ doc }: { doc: KnowledgeDocument }) {
  if (doc.type === "pdf") {
    return <PdfCoverPreview doc={doc} />;
  }

  if (doc.type === "web") {
    return (
      <div className="card-preview web-preview" aria-hidden="true">
        <div className="web-bar">
          <span />
          <span>{doc.source.replace(/^https?:\/\//, "")}</span>
        </div>
        <div className="web-block wide" />
        <div className="web-block" />
        <div className="web-block short" />
      </div>
    );
  }

  if (doc.type === "xlsx") {
    return (
      <div className="card-preview sheet-preview" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }

  return <FilePreview type={doc.type} />;
}

export function DocumentCard({ doc, selected, onActions, onSelect, onTagClick }: DocumentCardProps) {
  return (
    <article className={`doc-card${doc.pinned ? " pinned" : ""}${selected ? " selected" : ""}`} onClick={() => onSelect(doc)}>
      <CardPreview doc={doc} />
      <div className="card-top">
        <span className="type-badge">{TYPE_LABELS[doc.type]}</span>
        <button
          className="icon-btn card-menu"
          title="Source actions"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onActions(doc, {
              left: Math.min(rect.left, window.innerWidth - 180),
              top: rect.bottom + 6,
            });
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-title">{doc.title}</div>
        <div className="card-source">{doc.source}</div>
      </div>
      <div className="card-foot">
        <span className="card-tags" aria-label="Document tags">
          {doc.tags.map((tag) => (
            <button
              key={tag}
              className="card-tag"
              onClick={(event) => {
                event.stopPropagation();
                onTagClick(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </span>
        <span className="card-meta">{formatDate(doc)}</span>
      </div>
    </article>
  );
}
