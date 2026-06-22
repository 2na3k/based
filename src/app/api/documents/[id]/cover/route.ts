import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { prisma, storageInfo } from "../../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

type DocumentCover = {
  coverPath: string;
  sourcePath: string;
};

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${code ?? "unknown status"}`));
    });
  });
}

async function documentCover(context: RouteContext): Promise<DocumentCover | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }

  const client = await prisma();
  const document = await client.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return new Response("Document not found", { status: 404 });
  }
  if (document.type !== "pdf") {
    return new Response("Covers are only available for PDF files", { status: 415 });
  }

  const fileStat = await stat(/* turbopackIgnore: true */ document.storedPath).catch(() => null);
  if (!fileStat) {
    return new Response("The original PDF file is missing from local storage.", { status: 404 });
  }

  const coversDir = join(storageInfo().storageDir, "covers");
  await mkdir(coversDir, { recursive: true });
  return {
    coverPath: join(coversDir, `${document.id}-${document.size}-${Math.floor(fileStat.mtimeMs)}.png`),
    sourcePath: document.storedPath,
  };
}

async function generateCover({ coverPath, sourcePath }: DocumentCover): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "based-cover-"));
  try {
    await run("qlmanage", ["-t", "-s", "700", "-o", tempDir, sourcePath]);
    await rename(/* turbopackIgnore: true */ join(tempDir, `${basename(sourcePath)}.png`), /* turbopackIgnore: true */ coverPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const cover = await documentCover(context);
  if (cover instanceof Response) return cover;

  let image = await readFile(/* turbopackIgnore: true */ cover.coverPath).catch(() => null);
  if (!image) {
    await generateCover(cover).catch(() => undefined);
    image = await readFile(/* turbopackIgnore: true */ cover.coverPath).catch(() => null);
  }

  if (!image) {
    return new Response("Could not generate PDF cover image", { status: 500 });
  }

  return new Response(image, {
    headers: {
      "cache-control": "public, max-age=86400",
      "content-length": String(image.byteLength),
      "content-type": "image/png",
    },
  });
}
