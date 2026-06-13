import { Search } from "lucide-react";
import type { KnowledgeDocument, ViewMode } from "../lib/types";
import { DocumentCard } from "./DocumentCard";

interface DocumentGridProps {
  documents: KnowledgeDocument[];
  error: string | null;
  loading: boolean;
  selectedDocumentId: number | null;
  viewMode: ViewMode;
  onDocumentSelect: (doc: KnowledgeDocument) => void;
  onShowMessage: (message: string) => void;
  onTagClick: (tag: string) => void;
}

export function DocumentGrid({
  documents,
  error,
  loading,
  selectedDocumentId,
  viewMode,
  onDocumentSelect,
  onShowMessage,
  onTagClick,
}: DocumentGridProps) {
  return (
    <>
      {loading ? (
        <div className="empty">
          <p>Loading local knowledge base...</p>
        </div>
      ) : null}
      {error ? (
        <div className="empty">
          <p>{error}</p>
        </div>
      ) : null}
      {!loading && !error && documents.length === 0 ? (
        <div className="empty">
          <Search size={32} />
          <p>No documents match</p>
        </div>
      ) : null}
      <div className={`doc-grid ${viewMode}`}>
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            selected={selectedDocumentId === doc.id}
            onSelect={onDocumentSelect}
            onShowMessage={onShowMessage}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    </>
  );
}
