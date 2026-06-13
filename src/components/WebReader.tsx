import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import type { KnowledgeDocument } from "../lib/types";

interface WebReaderProps {
  document: KnowledgeDocument;
}

interface ReaderArticle {
  byline: string | null;
  content: string;
  excerpt: string | null;
  length: number;
  siteName: string | null;
  title: string;
  url: string;
}

export function WebReader({ document }: WebReaderProps) {
  const [article, setArticle] = useState<ReaderArticle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setArticle(null);
    setError("");
    setLoading(true);

    fetch(`/api/documents/${document.id}/reader`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Could not load reader mode (${response.status})`);
        }
        return response.json() as Promise<ReaderArticle>;
      })
      .then((nextArticle) => {
        if (!controller.signal.aborted) setArticle(nextArticle);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load reader mode.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [document.id]);

  if (loading) {
    return (
      <div className="preview-empty">
        <Loader2 className="preview-spinner" size={20} />
        <span>Loading reader mode...</span>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="preview-empty preview-error" role="alert">
        <AlertCircle size={22} />
        <span>{error || "Could not load reader mode."}</span>
        <a className="reader-open-link" href={document.source} target="_blank" rel="noreferrer">
          Open original
        </a>
      </div>
    );
  }

  return (
    <article className="reader-view">
      <header className="reader-head">
        <div className="reader-site">{article.siteName ?? new URL(article.url).hostname}</div>
        <h1>{article.title}</h1>
        {article.byline ? <div className="reader-byline">{article.byline}</div> : null}
        {article.excerpt ? <p className="reader-excerpt">{article.excerpt}</p> : null}
        <a className="reader-source" href={article.url} target="_blank" rel="noreferrer">
          <ExternalLink size={13} />
          Open original
        </a>
      </header>
      <div className="reader-content" dangerouslySetInnerHTML={{ __html: article.content }} />
    </article>
  );
}
