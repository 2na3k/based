import { chmod, readFile, writeFile } from "node:fs/promises";
import { authFilePath, ensureStorage } from "../../_lib/storage";
import type { ConnectorConfigInput, ConnectorId } from "../../../lib/types";

export interface StoredOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
}

export interface StoredConnectorAuth {
  config?: ConnectorConfigInput;
  oauth?: StoredOAuthTokens;
  oauthState?: string;
}

export interface ConnectorAuthStore {
  connectors: Partial<Record<ConnectorId, StoredConnectorAuth>>;
}

const EMPTY_STORE: ConnectorAuthStore = { connectors: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseConfig(value: unknown): ConnectorConfigInput | undefined {
  if (!isRecord(value)) return undefined;
  const config = {
    clientId: stringValue(value.clientId),
    clientSecret: stringValue(value.clientSecret),
    apiKey: stringValue(value.apiKey),
    redirectOrigin: stringValue(value.redirectOrigin),
  };
  return Object.values(config).some(Boolean) ? config : undefined;
}

function parseOAuth(value: unknown): StoredOAuthTokens | undefined {
  if (!isRecord(value)) return undefined;
  const accessToken = stringValue(value.accessToken);
  const refreshToken = stringValue(value.refreshToken);
  const tokenType = stringValue(value.tokenType) ?? "Bearer";
  const expiresAt = stringValue(value.expiresAt);
  if (!accessToken || !refreshToken || !expiresAt) return undefined;
  return { accessToken, refreshToken, tokenType, expiresAt };
}

function parseConnectorAuth(value: unknown): StoredConnectorAuth {
  if (!isRecord(value)) return {};
  return {
    config: parseConfig(value.config),
    oauth: parseOAuth(value.oauth),
    oauthState: stringValue(value.oauthState),
  };
}

function parseStore(value: unknown): ConnectorAuthStore {
  if (!isRecord(value) || !isRecord(value.connectors)) return EMPTY_STORE;
  return {
    connectors: {
      raindrop: parseConnectorAuth(value.connectors.raindrop),
    },
  };
}

function mergeConfig(current: ConnectorConfigInput | undefined, input: ConnectorConfigInput): ConnectorConfigInput {
  const entries = [
    ["clientId", input.clientId],
    ["clientSecret", input.clientSecret],
    ["apiKey", normalizeApiKey(input.apiKey)],
    ["redirectOrigin", normalizeOrigin(input.redirectOrigin)],
  ] as const;

  return entries.reduce<ConnectorConfigInput>(
    (next, [key, value]) => (value?.trim() ? { ...next, [key]: value.trim() } : next),
    current ?? {},
  );
}

function normalizeApiKey(value: string | undefined): string | undefined {
  return value
    ?.trim()
    .replace(/^authorization\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .trim();
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return undefined;
  }
}

export async function readAuthStore(): Promise<ConnectorAuthStore> {
  await ensureStorage();
  const content = await readFile(authFilePath(), "utf8").catch((caught: unknown) => {
    if (isRecord(caught) && caught.code === "ENOENT") return "";
    throw caught;
  });
  if (!content.trim()) return EMPTY_STORE;
  return parseStore(JSON.parse(content) as unknown);
}

export async function writeAuthStore(store: ConnectorAuthStore): Promise<void> {
  await ensureStorage();
  await writeFile(authFilePath(), `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await chmod(authFilePath(), 0o600).catch(() => undefined);
}

export async function readConnectorAuth(id: ConnectorId): Promise<StoredConnectorAuth> {
  const store = await readAuthStore();
  return store.connectors[id] ?? {};
}

export async function writeConnectorConfig(id: ConnectorId, input: ConnectorConfigInput): Promise<StoredConnectorAuth> {
  const store = await readAuthStore();
  const current = store.connectors[id] ?? {};
  const next = {
    ...current,
    config: mergeConfig(current.config, input),
  };
  await writeAuthStore({
    connectors: {
      ...store.connectors,
      [id]: next,
    },
  });
  return next;
}

export async function writeConnectorOAuth(id: ConnectorId, oauth: StoredOAuthTokens): Promise<StoredConnectorAuth> {
  const store = await readAuthStore();
  const current = store.connectors[id] ?? {};
  const next = {
    ...current,
    oauth,
    oauthState: undefined,
  };
  await writeAuthStore({
    connectors: {
      ...store.connectors,
      [id]: next,
    },
  });
  return next;
}

export async function writeConnectorOAuthState(id: ConnectorId, oauthState: string): Promise<StoredConnectorAuth> {
  const store = await readAuthStore();
  const current = store.connectors[id] ?? {};
  const next = {
    ...current,
    oauthState,
  };
  await writeAuthStore({
    connectors: {
      ...store.connectors,
      [id]: next,
    },
  });
  return next;
}
