import type { DocumentBacklink } from "../lib/types";

interface NoteBacklinksProps {
  backlinks: DocumentBacklink[];
  loading: boolean;
}

export function NoteBacklinks({ backlinks, loading }: NoteBacklinksProps) {
  return (
    <section className="note-backlinks">
      <div className="note-section-head">
        <span>Backlinks</span>
        <span>{loading ? "Loading" : backlinks.length}</span>
      </div>
      {loading ? <p className="note-muted">Finding linked notes...</p> : null}
      {!loading && backlinks.length === 0 ? <p className="note-muted">No backlinks yet.</p> : null}
      {backlinks.map((backlink) => (
        <article key={backlink.document.id} className="backlink-item">
          <div className="backlink-title">{backlink.document.title}</div>
          {backlink.excerpts.map((excerpt, index) => (
            <p key={`${backlink.document.id}-${index}`}>{excerpt}</p>
          ))}
        </article>
      ))}
    </section>
  );
}
