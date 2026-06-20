import { readConnectorAuth, writeConnectorOAuth } from "../../../_lib/auth";
import { ConnectorError } from "../../../_lib/errors";
import { connectorFromContext, requestOrigin, type ConnectorRouteContext } from "../../../_lib/routes";

export const runtime = "nodejs";

interface CallbackPayload {
  type: "based:connector-sync";
  connectorId: string;
  status: "synced" | "error";
  message?: string;
  importedCount?: number;
  skippedCount?: number;
  totalFetched?: number;
}

function fallbackUrl(request: Request, payload: CallbackPayload) {
  const url = new URL("/", new URL(request.url).origin);
  url.searchParams.set("connector", payload.connectorId);
  url.searchParams.set("connectorStatus", payload.status);
  if (payload.message) url.searchParams.set("connectorMessage", payload.message);
  if (typeof payload.importedCount === "number") url.searchParams.set("connectorImported", String(payload.importedCount));
  if (typeof payload.skippedCount === "number") url.searchParams.set("connectorSkipped", String(payload.skippedCount));
  if (typeof payload.totalFetched === "number") url.searchParams.set("connectorFetched", String(payload.totalFetched));
  return url.toString();
}

function escapedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function connectorCallbackPage(request: Request, payload: CallbackPayload) {
  const href = fallbackUrl(request, payload);
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>Returning to Based</title>",
    "</head>",
    "<body>",
    "<p>Returning to Based...</p>",
    `<p><a href="${href}">Return to Based</a></p>`,
    "<script>",
    `const payload = ${escapedJson(payload)};`,
    `const fallback = ${escapedJson(href)};`,
    "if (window.opener && !window.opener.closed) {",
    "  window.opener.postMessage(payload, '*');",
    "  window.close();",
    "} else {",
    "  window.location.href = fallback;",
    "}",
    "</script>",
    "</body>",
    "</html>",
  ].join("");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export async function GET(request: Request, context: ConnectorRouteContext) {
  const connector = await connectorFromContext(context);
  if (connector instanceof Response) return connector;

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return connectorCallbackPage(request, {
      type: "based:connector-sync",
      connectorId: connector.id,
      status: "error",
      message: error,
    });
  }

  const transferCode = url.searchParams.get("transfer_code");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if ((!code && !transferCode) || !state) {
    return new Response("Missing OAuth callback parameters", { status: 400 });
  }

  try {
    const auth = await readConnectorAuth(connector.id);
    if (!auth.oauthState || auth.oauthState !== state) {
      return new Response("Invalid OAuth state", { status: 400 });
    }
    const callbackUrl = new URL(`/api/connectors/${connector.id}/oauth/callback`, requestOrigin(request)).toString();
    const tokens = transferCode
      ? await connector.provider.brokerExchange?.(transferCode, url.origin)
      : await connector.provider.oauthCallback?.(auth, code ?? "", callbackUrl);
    if (!tokens) {
      return new Response("Connector does not support OAuth callback exchange", { status: 400 });
    }
    await writeConnectorOAuth(connector.id, tokens);
    const result = await connector.provider.importDocuments({
      ...auth,
      oauth: tokens,
      oauthState: undefined,
    });
    return connectorCallbackPage(request, {
      type: "based:connector-sync",
      connectorId: connector.id,
      status: "synced",
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      totalFetched: result.totalFetched,
    });
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) {
      return connectorCallbackPage(request, {
        type: "based:connector-sync",
        connectorId: connector.id,
        status: "error",
        message: caught.message,
      });
    }
    return connectorCallbackPage(request, {
      type: "based:connector-sync",
      connectorId: connector.id,
      status: "error",
      message: caught instanceof Error ? caught.message : "Could not complete connector OAuth",
    });
  }
}
