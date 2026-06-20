import { access } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "../../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface RevealCommand {
  command: string;
  args: string[];
}

async function documentIdFromContext(context: RouteContext): Promise<number | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }
  return documentId;
}

function commandForPath(path: string, platform: NodeJS.Platform): RevealCommand {
  if (platform === "darwin") return { command: "open", args: ["-R", path] };
  if (platform === "win32") return { command: "explorer", args: ["/select,", path] };
  return { command: "xdg-open", args: [dirname(path)] };
}

function runRevealCommand(revealCommand: RevealCommand): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(revealCommand.command, revealCommand.args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("close", (code) => {
      child.unref();
      resolve(code === 0);
    });
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const documentId = await documentIdFromContext(context);
  if (documentId instanceof Response) return documentId;

  const client = await prisma();
  const document = await client.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return new Response("Document not found", { status: 404 });
  }
  if (document.type === "web") {
    return new Response("Web sources are not stored in Finder", { status: 415 });
  }

  try {
    await access(document.storedPath);
    const revealed = await runRevealCommand(commandForPath(document.storedPath, process.platform));
    if (!revealed) {
      return new Response("Could not show the stored source file in Finder", { status: 500 });
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Could not show the stored source file in Finder", { status: 500 });
  }
}
