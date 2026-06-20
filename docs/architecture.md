# Architecture

## Overview

Based is a local-first knowledge base application. It stores all data on the user's machine under `~/.based/` and uses a Next.js frontend with a SQLite database via Prisma.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Next.js 16 |
| Styling | CSS custom properties, no framework |
| Icons | lucide-react |
| Runtime | Bun |
| Database | SQLite (via Prisma 6) |
| PDF rendering | pdfjs-dist |
| Web reader | @mozilla/readability + linkedom |

## Data Storage

All user data lives in `~/.based/`:

```
~/.based/
├── config.toml
├── storage/
│   └── based.sqlite
└── documents/
    ├── pdf/
    ├── doc/
    ├── xlsx/
    ├── web/
    ├── paper/
    ├── notes/
    │   └── my-note.md
    └── attachments/
        └── images/
            └── 1718300000-pasted-image.png
```

- `config.toml` — generated on first run, stores directory paths.
- `based.sqlite` — single `documents` table. Created automatically via raw SQL on startup.
- `documents/<type>/` — uploaded files organized by type. Web sources store only the URL; notes store markdown files.
- `documents/attachments/images/` — images pasted into notes.

## Database Schema

Single table `documents`:

```sql
CREATE TABLE documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,       -- pdf, doc, xlsx, web, paper, note
  title        TEXT NOT NULL,
  source       TEXT NOT NULL,       -- filename or URL
  tags         TEXT NOT NULL,       -- JSON string array
  created_at   TEXT NOT NULL,       -- ISO 8601
  original_name TEXT NOT NULL,
  stored_path  TEXT NOT NULL,       -- absolute file path or URL
  size         INTEGER NOT NULL,    -- bytes (0 for web)
  pinned       INTEGER NOT NULL DEFAULT 0
);
```

## Notes

Notes are markdown files with YAML frontmatter:

```markdown
---
name: "My Note"
description: "A brief description"
tags: ["research", "ideas"]
created: "2026-06-14T03:10:01.358Z"
---

# Content here

Links to other notes use [[Wiki Link]] syntax.
```

The frontmatter is parsed/serialized by `src/app/lib/documents.ts`. Notes support:
- Wiki-style backlinks (`[[Title]]`)
- Image attachments (pasted via clipboard)
- Auto-save (debounced 900ms)
- Rendered preview with syntax highlighting

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Entry point → BasedApp
│   ├── layout.tsx            # Root layout with fonts
│   ├── globals.css           # All styles
│   ├── api/                      # API routes (see api.md)
│   │   ├── _lib/storage.ts       # Database + filesystem layer
│   │   ├── config/
│   │   ├── documents/
│   │   └── notes/
│   ├── components/
│   │   ├── BasedApp.tsx          # Main app shell, state management
│   │   ├── NoteEditor.tsx        # Split markdown editor + renderer
│   │   ├── DocumentGrid.tsx      # Document list/card views
│   │   ├── DocumentCard.tsx      # Individual document card
│   │   ├── Sidebar.tsx           # Navigation + tags
│   │   ├── PreviewSidebar.tsx    # PDF/web preview panel
│   │   ├── LinkPreviewBubble.tsx # Hover preview for links
│   │   └── ...modals
│   └── lib/
│       ├── api.ts                # Client-side fetch wrappers
│       ├── documents.ts          # Markdown parsing, slugification
│       └── types.ts              # TypeScript interfaces
```

## Key Design Decisions

- **Local-first**: No cloud sync, no auth. All data stays on disk.
- **SQLite via raw SQL**: The `documents` table is created with `CREATE TABLE IF NOT EXISTS` on every startup, so no migrations are needed.
- **File-based notes**: Notes are real markdown files on disk, making them portable and editable with external tools.
- **Bun runtime**: The app requires Bun for both dev and production. Scripts use `bunx --bun next`.
