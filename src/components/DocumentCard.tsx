import { MoreVertical } from "lucide-react";
import { formatMeta, TYPE_LABELS } from "../lib/documents";
import type { KnowledgeDocument } from "../lib/types";

interface DocumentCardProps {
  doc: KnowledgeDocument;
  selected: boolean;
  onSelect: (doc: KnowledgeDocument) => void;
  onShowMessage: (message: string) => void;
  onTagClick: (tag: string) => void;
}

export function DocumentCard({ doc, selected, onSelect, onShowMessage, onTagClick }: DocumentCardProps) {
  return (
    <article className={`doc-card${doc.pinned ? " pinned" : ""}${selected ? " selected" : ""}`} onClick={() => onSelect(doc)}>
      <div className="card-preview" aria-hidden="true">
        <div className="preview-lines">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="card-top">
        <span className="type-badge">{TYPE_LABELS[doc.type]}</span>
        <button
          className="icon-btn card-menu"
          onClick={(event) => {
            event.stopPropagation();
            onShowMessage(doc.originalName);
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
        <span className="card-meta">{formatMeta(doc)}</span>
        {doc.tags.length ? (
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
        ) : null}
      </div>
    </article>
  );
}
