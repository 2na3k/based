# API Reference

All endpoints are under `http://localhost:3000`. The app uses Next.js App Router API routes.

## Types

### DocumentType

`"pdf" | "doc" | "xlsx" | "web" | "paper" | "note"`

### KnowledgeDocument

```ts
{
  id: number;
  type: DocumentType;
  title: string;
  source: string;        // filename or URL
  tags: string[];
  createdAt: string;     // ISO 8601
  originalName: string;
  storedPath: string;    // absolute path or URL
  size: number;          // bytes
  pinned: boolean;
}
```

### NoteMetadata

```ts
{
  name: string;
  description: string;
  tags: string[];
  created: string;       // ISO 8601
}
```

### NoteContent

```ts
{
  document: KnowledgeDocument;
  markdown: string; // full markdown with frontmatter
  metadata: NoteMetadata;
}
```

---

## Endpoints

### Config

#### `GET /api/config`

Returns the storage configuration and all documents.

**Response** `200`

```ts
{
  storage: {
    baseDir: string;
    configPath: string;
    storageDir: string;
    documentsDir: string;
    notesDir: string;
    attachmentsDir: string;
    imagesDir: string;
  };
  documents: KnowledgeDocument[];
}
```

---

### Documents

#### `POST /api/documents`

Upload a file document.

**Request** — `FormData`
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | yes | The file to upload |
| `title` | string | yes | Display title |
| `type` | string | yes | One of `DocumentType` |
| `tags` | string | no | JSON string array, e.g. `["tag1","tag2"]` |

**Response** `201` — `KnowledgeDocument`

**Errors**

- `400` — Invalid payload

---

#### `POST /api/documents/web`

Add a web source (no file download).

**Request** — JSON

```ts
{
  url: string;       // required, must be http/https
  title?: string;    // optional, defaults to hostname
  tags?: string[];
}
```

**Response** `201` — `KnowledgeDocument`

**Errors**

- `400` — Invalid URL or payload

---

#### `GET /api/documents/web/title?url=...`

Fetch a web page and extract its title for auto-fill.

**Query Params**
| Param | Required | Description |
|---|---|---|
| `url` | yes | The URL to fetch |

**Response** `200`

```ts
{
  source: string; // hostname
  title: string; // page <title>
  suggestedTitle: string; // computed display title
}
```

**Errors**

- `400` — Missing/invalid URL

---

#### `PATCH /api/documents/:id`

Update a document's title and tags.

**Path Params**
| Param | Type | Description |
|---|---|--
| `id` | integer | Document ID |

**Request** — JSON

```ts
{
  title: string;    // required, non-empty
  tags?: string[];  // optional
}
```

**Response** `200` — `KnowledgeDocument`

**Errors**

- `400` — Invalid ID or missing title
- `404` — Not found

---

#### `DELETE /api/documents/:id`

Delete a document and its stored file.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `204` — Empty

**Errors**

- `400` — Invalid ID
- `404` — Not found

---

#### `HEAD /api/documents/:id/content`

Check if a PDF document exists and get its headers.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `200` — Headers only (`content-type: application/pdf`, `content-length`, `content-disposition`)

**Errors**

- `400` — Invalid ID
- `404` — Not found or file missing
- `415` — Not a PDF

---

#### `GET /api/documents/:id/content`

Stream a PDF file for preview.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `200` — Binary PDF stream

**Errors**

- `400` — Invalid ID
- `404` — Not found or file missing
- `415` — Not a PDF

---

#### `GET /api/documents/:id/reader`

Fetch and parse a web source into reader-mode HTML.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `200`

```ts
{
  byline: string | null;
  content: string; // HTML with absolute URLs
  excerpt: string | null;
  length: number;
  siteName: string | null;
  title: string;
  url: string;
}
```

**Errors**

- `400` — Invalid ID
- `404` — Not found
- `415` — Not a web source
- `422` — Could not extract article
- `502` — Fetch failed

---

### Notes

#### `POST /api/notes`

Create a new note.

**Request** — JSON

```ts
{
  title?: string;       // defaults to "Untitled"
  description?: string; // defaults to ""
  tags?: string[];
}
```

**Response** `201` — `NoteContent`

---

#### `GET /api/notes/:id`

Read a note's content.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `200` — `NoteContent`

**Errors**

- `400` — Invalid ID
- `404` — Not found
- `415` — Document is not a note

---

#### `PUT /api/notes/:id`

Save/update a note.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Request** — JSON

```ts
{
  markdown: string;    // required, full markdown content
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    created?: string;
  };
}
```

**Response** `200` — `NoteContent`

**Errors**

- `400` — Invalid ID or payload
- `404` — Not found
- `415` — Not a note

---

#### `GET /api/notes/:id/backlinks`

Find all notes that reference this note.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Response** `200`

```ts
{
  backlinks: {
    document: KnowledgeDocument;
    excerpts: string[];  // matching lines
  }[];
}
```

**Errors**

- `400` — Invalid ID
- `404` — Not found

---

#### `POST /api/notes/:id/attachments/images`

Upload an image attachment for a note.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Document ID |

**Request** — `FormData`
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | yes | Image file (`image/*`) |

**Response** `200`

```ts
{
  markdownPath: string; // "attachments/images/<filename>"
  renderUrl: string; // "/api/notes/attachments/images/<filename>"
}
```

**Errors**

- `400` — Invalid ID or no file
- `404` — Note not found
- `415` — Not a note

---

#### `GET /api/notes/attachments/images/:fileName`

Serve a note image attachment.

**Path Params**
| Param | Type | Description |
|---|---|---|
| `fileName` | string | Image filename |

**Response** `200` — Binary image with appropriate `content-type` (`image/png`, `image/jpeg`, `image/webp`, `image/gif`)

**Errors**

- `404` — Image not found
