<div align="center">

# based.

**A local-first knowledge base for your documents, notes, and web bookmarks.**

[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma)](https://prisma.io)
[![Bun](https://img.shields.io/badge/Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)](https://typescriptlang.org)

</div>

---

## Features

- **Document Management** -- Upload and organize PDFs, Word docs, spreadsheets, and papers
- **Web Bookmarks** -- Save URLs with automatic reader mode extraction via Mozilla Readability
- **Markdown Notes** -- Full-featured editor with live preview, syntax highlighting, and auto-save
- **Wiki Links** -- Connect notes with `[[backlinks]]` and navigate your knowledge graph
- **PDF Viewer** -- Inline PDF rendering with zoom and navigation
- **Tag System** -- Organize everything with tags, filter across your entire library
- **Dark Mode** -- Light and dark theme support
- **Image Support** -- Paste or upload images directly into notes
- **Citations** -- Auto-generated citation footnotes from wiki links
- **Local-First** -- All data stored locally in `~/.based` -- no cloud, no accounts, no tracking

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Install

```bash
git clone https://github.com/your-username/based.git
cd based
bun install
```

### Run

```bash
bun run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

## Usage

### Adding Documents

- **Files** -- Drag & drop or click "Add Source" to upload PDFs, DOCX, XLSX files
- **Web Links** -- Paste a URL and based will fetch the title and content automatically
- **Notes** -- Click "New Note" to create a markdown document

### Writing Notes

Notes use markdown with some extras:

```markdown
---
name: "My Research Note"
description: "Notes on topic X"
tags: ["research", "topic-x"]
created: "2025-01-15T10:30:00.000Z"
---

# Heading

Link to another note using [[Wiki Links]].

- **Bold** and *italic* formatting
- `inline code` and code blocks
- Lists, blockquotes, and more
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/⌘ + K` | Focus search |
| `Ctrl/⌘ + S` | Save current note |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Y` | Redo |
| `Escape` | Close modals / deselect |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Lucide Icons |
| Database | SQLite via Prisma |
| PDF Rendering | pdfjs-dist |
| Web Reader | @mozilla/readability + linkedom |
| Runtime | Bun |
| Language | TypeScript (strict) |

## Project Structure

```
based/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/               # REST API routes
│   │   │   ├── config/        # App configuration
│   │   │   ├── documents/     # Document CRUD
│   │   │   └── notes/         # Note CRUD + attachments
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/            # React components
│   │   ├── BasedApp.tsx       # Root application shell
│   │   ├── NoteEditor.tsx     # Markdown editor
│   │   ├── DocumentGrid.tsx   # Document listing
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── PreviewSidebar.tsx # Document preview
│   │   └── ...
│   └── lib/
│       ├── api.ts             # Client-side API helpers
│       ├── documents.ts       # Document utilities
│       └── types.ts           # TypeScript types
└── package.json
```

## Storage

All data is stored locally under `~/.based/`:

```
~/.based/
├── config.toml           # App configuration
├── storage/
│   └── based.sqlite      # SQLite database
└── documents/
    ├── pdf/              # Uploaded PDFs
    ├── doc/              # Uploaded documents
    ├── xlsx/             # Uploaded spreadsheets
    ├── web/              # Web content cache
    ├── notes/            # Markdown notes
    └── attachments/
        └── images/       # Note images
```

## Development

```bash
# Start dev server
bun run dev

# Run type checking
bun run typecheck

# Run tests
bun test

# Build for production
bun run build

# Start production server
bun run start
```

Or use Make targets:

```bash
make dev          # Start dev server
make typecheck    # Type check
make build        # Production build
make start        # Start production server
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

---

<div align="center">

**based.** -- Your knowledge, locally stored.

</div>
