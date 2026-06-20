import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { OPEN_APPS, prisma } from "../../../_lib/storage";
import type { OpenApp } from "../../../../lib/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

type OpenCommand = {
  command: string;
  args: string[];
};

async function documentIdFromContext(context: RouteContext): Promise<number | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }
  return documentId;
}

function commandForPath(path: string, platform: NodeJS.Platform): OpenCommand {
  if (platform === "darwin") return { command: "open", args: [path] };
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", path] };
  return { command: "xdg-open", args: [path] };
}

function editorCommandsForPath(path: string, platform: NodeJS.Platform): OpenCommand[] {
  if (platform === "darwin") {
    return [
      { command: "open", args: ["-a", "Visual Studio Code", path] },
      { command: "open", args: ["-a", "Zed", path] },
      { command: "open", args: ["-a", "Obsidian", path] },
    ];
  }
  if (platform === "win32") {
    return [
      { command: "code", args: [path] },
      { command: "zed", args: [path] },
    ];
  }
  return [
    { command: "code", args: [path] },
    { command: "zed", args: [path] },
  ];
}

function commandForApp(path: string, app: OpenApp, platform: NodeJS.Platform): OpenCommand | null {
  if (app === "system") return commandForPath(path, platform);
  if (platform === "darwin") {
    const appNames: Record<Exclude<OpenApp, "system">, string> = {
      vscode: "Visual Studio Code",
      zed: "Zed",
      obsidian: "Obsidian",
    };
    return { command: "open", args: ["-a", appNames[app], path] };
  }
  if (app === "obsidian") return null;
  return { command: app === "vscode" ? "code" : "zed", args: [path] };
}

function runOpenCommand(openCommand: OpenCommand): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn(openCommand.command, openCommand.args, {
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

async function runFirstAvailable(commands: OpenCommand[]): Promise<boolean> {
  for (const command of commands) {
    if (await runOpenCommand(command)) return true;
  }
  return false;
}

export async function POST(request: Request, context: RouteContext) {
  const documentId = await documentIdFromContext(context);
  if (documentId instanceof Response) return documentId;

  const client = await prisma();
  const document = await client.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return new Response("Document not found", { status: 404 });
  }

  if (document.type === "web") {
    return new Response("Web sources open directly from the browser", { status: 415 });
  }

  try {
    await access(document.storedPath);
    const appParam = new URL(request.url).searchParams.get("app");
    const app = OPEN_APPS.includes(appParam as OpenApp) ? (appParam as OpenApp) : null;
    const opened =
      app && app !== "system"
        ? await runFirstAvailable([commandForApp(document.storedPath, app, process.platform), commandForPath(document.storedPath, process.platform)].filter((command): command is OpenCommand => Boolean(command)))
        : appParam === "editor" && document.type === "note"
          ? await runFirstAvailable([...editorCommandsForPath(document.storedPath, process.platform), commandForPath(document.storedPath, process.platform)])
          : await runOpenCommand(commandForPath(document.storedPath, process.platform));
    if (!opened) {
      return new Response("Could not open the stored source file", { status: 500 });
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Could not open the stored source file", { status: 500 });
  }
}
