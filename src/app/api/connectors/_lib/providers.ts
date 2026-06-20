import { raindropProvider } from "./raindrop";
import type { StoredConnectorAuth, StoredOAuthTokens } from "./auth";
import type {
  ConnectorCapabilities,
  ConnectorConfigInput,
  ConnectorDefinition,
  ConnectorId,
  ConnectorImportResult,
  ConnectorListItem,
  ConnectorStatus,
} from "../../../../lib/types";

export interface ConnectorProvider {
  capabilities: ConnectorCapabilities;
  definition: ConnectorDefinition;
  status: (auth: StoredConnectorAuth) => ConnectorStatus;
  brokerStartUrl?: (auth: StoredConnectorAuth, callbackUrl: string, state: string) => URL;
  brokerExchange?: (transferCode: string, origin: string) => Promise<StoredOAuthTokens>;
  refreshAuth: (auth: StoredConnectorAuth) => Promise<StoredOAuthTokens>;
  oauthStartUrl?: (auth: StoredConnectorAuth, callbackUrl: string, state: string) => URL;
  oauthCallback?: (auth: StoredConnectorAuth, code: string, callbackUrl: string) => Promise<StoredOAuthTokens>;
  importDocuments: (auth: StoredConnectorAuth) => Promise<ConnectorImportResult>;
}

const PROVIDERS: Record<ConnectorId, ConnectorProvider> = {
  raindrop: raindropProvider,
};

export function isConnectorId(value: string): value is ConnectorId {
  return value in PROVIDERS;
}

export function connectorProvider(id: string): ConnectorProvider | null {
  return isConnectorId(id) ? PROVIDERS[id] : null;
}

export function connectorProviders(): ConnectorProvider[] {
  return Object.values(PROVIDERS);
}

export function connectorListItem(provider: ConnectorProvider, auth: StoredConnectorAuth): ConnectorListItem {
  return {
    definition: provider.definition,
    status: provider.status(auth),
  };
}

export function configInputFromPayload(payload: unknown): ConnectorConfigInput | Response {
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid connector config payload", { status: 400 });
  }
  const input = payload as { clientId?: unknown; clientSecret?: unknown; apiKey?: unknown; redirectOrigin?: unknown };
  return {
    clientId: typeof input.clientId === "string" ? input.clientId : undefined,
    clientSecret: typeof input.clientSecret === "string" ? input.clientSecret : undefined,
    apiKey: typeof input.apiKey === "string" ? input.apiKey : undefined,
    redirectOrigin: typeof input.redirectOrigin === "string" ? input.redirectOrigin : undefined,
  };
}

export function transferCodeFromPayload(payload: unknown): string | Response {
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid connector exchange payload", { status: 400 });
  }
  const input = payload as { transferCode?: unknown };
  if (typeof input.transferCode !== "string" || !input.transferCode.trim()) {
    return new Response("Transfer code is required", { status: 400 });
  }
  return input.transferCode.trim();
}
