import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { homedir } from "node:os";
import { PrismaClient, type Document } from "@prisma/client";
import { slugifyNoteTitle } from "../../../lib/documents";
import type { DocumentType, KnowledgeDocument, OpenApp, OpenAppConfig, StorageInfo } from "../../../lib/types";

const BASE_DIR = join(homedir(), ".based");
const STORAGE_DIR = join(BASE_DIR, "storage");
const DOCUMENTS_DIR = join(BASE_DIR, "documents");
const NOTES_DIR = join(DOCUMENTS_DIR, "notes");
const ATTACHMENTS_DIR = join(DOCUMENTS_DIR, "attachments");
const IMAGES_DIR = join(ATTACHMENTS_DIR, "images");
const CONFIG_PATH = join(BASE_DIR, "config.toml");
const DB_PATH = join(STORAGE_DIR, "based.sqlite");

export const TYPES: readonly DocumentType[] = ["pdf", "doc", "xlsx", "web", "paper", "note"];
export const OPEN_APPS: readonly OpenApp[] = ["system", "vscode", "zed", "obsidian"];
export const DEFAULT_OPEN_APPS: OpenAppConfig = {
  pdf: "system",
  doc: "system",
  xlsx: "system",
  web: "system",
  paper: "system",
  note: "system",
};

const globalForPrisma = globalThis as typeof globalThis & {
  basedPrisma?: PrismaClient;
};

export function storageInfo(): StorageInfo {
  return {
    baseDir: BASE_DIR,
    configPath: CONFIG_PATH,
    storageDir: STORAGE_DIR,
    documentsDir: DOCUMENTS_DIR,
    notesDir: NOTES_DIR,
    attachmentsDir: ATTACHMENTS_DIR,
    imagesDir: IMAGES_DIR,
  };
}

export async function ensureStorage() {
  await mkdir(STORAGE_DIR, { recursive: true });
  await mkdir(DOCUMENTS_DIR, { recursive: true });
  await mkdir(NOTES_DIR, { recursive: true });
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  await mkdir(IMAGES_DIR, { recursive: true });
  for (const type of TYPES) {
    await mkdir(join(DOCUMENTS_DIR, type), { recursive: true });
  }

  const config = [
    'base_dir = "~/.based"',
    'storage_dir = "~/.based/storage"',
    'documents_dir = "~/.based/documents"',
    'open_pdf = "system"',
    'open_doc = "system"',
    'open_xlsx = "system"',
    'open_web = "system"',
    'open_paper = "system"',
    'open_note = "system"',
    "",
  ].join("\n");

  try {
    await access(CONFIG_PATH);
  } catch {
    await writeFile(CONFIG_PATH, config);
  }
}

function tomlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseOpenApp(value: string | undefined): OpenApp | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^"|"$/g, "");
  return OPEN_APPS.includes(cleaned as OpenApp) ? (cleaned as OpenApp) : null;
}

export async function readOpenApps(): Promise<OpenAppConfig> {
  await ensureStorage();
  const config = await readFile(CONFIG_PATH, "utf8").catch(() => "");
  return TYPES.reduce<OpenAppConfig>((openApps, type) => {
    const match = config.match(new RegExp(`^open_${type}\\s*=\\s*(.+)$`, "m"));
    return {
      ...openApps,
      [type]: parseOpenApp(match?.[1]) ?? DEFAULT_OPEN_APPS[type],
    };
  }, DEFAULT_OPEN_APPS);
}

export async function writeOpenApps(openApps: OpenAppConfig): Promise<OpenAppConfig> {
  await ensureStorage();
  const nextOpenApps = TYPES.reduce<OpenAppConfig>(
    (next, type) => ({
      ...next,
      [type]: OPEN_APPS.includes(openApps[type]) ? openApps[type] : DEFAULT_OPEN_APPS[type],
    }),
    DEFAULT_OPEN_APPS,
  );
  const current = await readFile(CONFIG_PATH, "utf8").catch(() => "");
  const withoutOpenApps = current
    .split("\n")
    .filter((line) => !TYPES.some((type) => line.trimStart().startsWith(`open_${type} =`)))
    .join("\n")
    .trimEnd();
  const openAppLines = TYPES.map((type) => `open_${type} = ${tomlString(nextOpenApps[type])}`).join("\n");
  await writeFile(CONFIG_PATH, `${withoutOpenApps}\n${openAppLines}\n`);
  return nextOpenApps;
}

export async function prisma() {
  await ensureStorage();
  process.env.DATABASE_URL = `file:${DB_PATH}`;
  const client = globalForPrisma.basedPrisma ?? new PrismaClient();
  globalForPrisma.basedPrisma = client;
  await client.$executeRaw`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      size INTEGER NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0
    )
  `;
  return client;
}

export function isKnownType(value: string): value is DocumentType {
  return TYPES.includes(value as DocumentType);
}

export function rowToDocument(row: Document): KnowledgeDocument {
  const parsedTags: unknown = JSON.parse(row.tags);
  return {
    id: row.id,
    type: isKnownType(row.type) ? row.type : "note",
    title: row.title,
    source: row.source,
    tags: Array.isArray(parsedTags) ? parsedTags.filter((tag): tag is string => typeof tag === "string") : [],
    createdAt: row.createdAt,
    originalName: row.originalName,
    storedPath: row.storedPath,
    size: row.size,
    pinned: row.pinned === 1,
  };
}

export function safeName(name: string) {
  return basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function storedDocumentPath(type: DocumentType, fileName: string) {
  const fallback = `source${extname(fileName)}`;
  const storedName = `${Date.now()}-${safeName(fileName || fallback)}`;
  return join(DOCUMENTS_DIR, type, storedName);
}

export function noteFileName(title: string) {
  return `${slugifyNoteTitle(title)}.md`;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function storedNotePath(title: string, currentPath = "") {
  const slug = slugifyNoteTitle(title);
  const currentDir = currentPath ? dirname(currentPath) : "";
  const currentBase = currentPath ? basename(currentPath) : "";
  for (let index = 1; index < 1000; index += 1) {
    const fileName = index === 1 ? `${slug}.md` : `${slug}-${index}.md`;
    const candidate = join(NOTES_DIR, fileName);
    if (currentDir === NOTES_DIR && currentBase === fileName) return candidate;
    if (!(await pathExists(candidate))) return candidate;
  }
  return join(NOTES_DIR, `${slug}-${Date.now()}.md`);
}

export async function renameNotePath(currentPath: string, title: string) {
  const nextPath = await storedNotePath(title, currentPath);
  if (nextPath !== currentPath) {
    await rename(currentPath, nextPath);
  }
  return nextPath;
}

export function storedImagePath(fileName: string, mimeType: string) {
  const ext = extname(fileName) || extensionFromMime(mimeType) || ".png";
  const name = safeName(fileName.replace(/\.[^.]+$/, "") || "pasted-image");
  const storedName = `${Date.now()}-${name}${ext}`;
  return {
    absolutePath: join(IMAGES_DIR, storedName),
    fileName: storedName,
    markdownPath: `attachments/images/${storedName}`,
  };
}

export function attachmentImagePath(fileName: string) {
  return join(IMAGES_DIR, safeName(fileName));
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/png") return ".png";
  return "";
}

export function isDocumentType(value: FormDataEntryValue | null): value is DocumentType {
  return typeof value === "string" && TYPES.includes(value as DocumentType);
}

export function tagsFromUnknown(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

export function titleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
