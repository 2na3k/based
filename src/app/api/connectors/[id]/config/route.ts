import { NextResponse } from "next/server";
import { readConnectorAuth, writeConnectorConfig } from "../../_lib/auth";
import { ConnectorError } from "../../_lib/errors";
import { configInputFromPayload } from "../../_lib/providers";
import { connectorFromContext, type ConnectorRouteContext } from "../../_lib/routes";

export const runtime = "nodejs";

export async function PUT(request: Request, context: ConnectorRouteContext) {
  const connector = await connectorFromContext(context);
  if (connector instanceof Response) return connector;

  try {
    const input = configInputFromPayload((await request.json()) as unknown);
    if (input instanceof Response) return input;
    await writeConnectorConfig(connector.id, input);
    const auth = await readConnectorAuth(connector.id);
    return NextResponse.json({
      definition: connector.provider.definition,
      status: connector.provider.status(auth),
    });
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) {
      return new Response(caught.message, { status: caught.status });
    }
    return new Response(caught instanceof Error ? caught.message : "Could not save connector config", { status: 500 });
  }
}
