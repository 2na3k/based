import { writeConnectorOAuth } from "./auth";
import { insertDedupedWebDocuments, type WebImportItem } from "./documents";
import { ConnectorError } from "./errors";
import type { ConnectorProvider } from "./providers";
import type { StoredConnectorAuth, StoredOAuthTokens } from "./auth";
import type { ConnectorImportResult } from "../../../../lib/types";

const RAINDROP_ID = "raindrop";
const RAINDROP_TOKEN_URL = "https://raindrop.io/oauth/access_token";
const RAINDROP_AUTHORIZE_URL = "https://raindrop.io/oauth/authorize";
const RAINDROP_ITEMS_URL = "https://api.raindrop.io/rest/v1/raindrops/0";
const RAINDROP_PER_PAGE = 50;
const MAX_IMPORT_PAGES = 2000;
const TOKEN_REFRESH_WINDOW_MS = 60_000;
const DEFAULT_EXPIRES_IN_SECONDS = 14 * 24 * 60 * 60;
const RAINDROP_CLIENT_ID_ENV = "RAINDROP_CLIENT_ID";
const RAINDROP_CLIENT_SECRET_ENV = "RAINDROP_CLIENT_SECRET";
const DEFAULT_RAINDROP_REDIRECT_ORIGIN = "http://127.0.0.1:3000";
const RAINDROP_SOURCE_TAG = "raindrop";

interface RaindropTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
}

interface RaindropPage {
  items: WebImportItem[];
  fetchedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function configuredRaindropOAuth(): { clientId: string; clientSecret: string } {
  const clientId = process.env[RAINDROP_CLIENT_ID_ENV]?.trim();
  const clientSecret = process.env[RAINDROP_CLIENT_SECRET_ENV]?.trim();
  if (!clientId || !clientSecret) {
    throw new ConnectorError(
      `Raindrop OAuth is not configured. Set ${RAINDROP_CLIENT_ID_ENV} and ${RAINDROP_CLIENT_SECRET_ENV} on the broker.`,
      500,
    );
  }
  return { clientId, clientSecret };
}

function configuredAuth(auth: StoredConnectorAuth): { clientId: string; clientSecret: string } {
  const clientId = process.env[RAINDROP_CLIENT_ID_ENV]?.trim() || auth.config?.clientId?.trim();
  const clientSecret = process.env[RAINDROP_CLIENT_SECRET_ENV]?.trim() || auth.config?.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    throw new ConnectorError(
      `Raindrop OAuth is not configured. Set ${RAINDROP_CLIENT_ID_ENV} and ${RAINDROP_CLIENT_SECRET_ENV} on the server.`,
      500,
    );
  }
  return { clientId, clientSecret };
}

function configuredRedirectOrigin(auth: StoredConnectorAuth): string {
  return auth.config?.redirectOrigin?.trim() || DEFAULT_RAINDROP_REDIRECT_ORIGIN;
}

export function normalizeRaindropAccessToken(value: string): string {
  return value
    .trim()
    .replace(/^authorization\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .trim();
}

export function raindropItemToWebImport(value: unknown): WebImportItem | null {
  if (!isRecord(value)) return null;
  const link = stringValue(value.link);
  if (!link) return null;
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    url: link,
    title: stringValue(value.title),
    tags: [RAINDROP_SOURCE_TAG, ...tags],
    createdAt: stringValue(value.created),
  };
}

function parseTokenResponse(payload: unknown): RaindropTokenResponse {
  if (!isRecord(payload)) throw new ConnectorError("Invalid Raindrop token response", 502);
  const accessToken = stringValue(payload.access_token);
  const refreshToken = stringValue(payload.refresh_token);
  const tokenType = stringValue(payload.token_type) ?? "Bearer";
  const expiresIn = numberValue(payload.expires_in) ?? DEFAULT_EXPIRES_IN_SECONDS;
  if (!accessToken) throw new ConnectorError("Raindrop did not return an access token", 502);
  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresIn,
  };
}

function tokensFromResponse(response: RaindropTokenResponse, fallbackRefreshToken = ""): StoredOAuthTokens {
  const refreshToken = response.refreshToken ?? fallbackRefreshToken;
  if (!refreshToken) throw new ConnectorError("Raindrop did not return a refresh token", 502);
  return {
    accessToken: response.accessToken,
    refreshToken,
    tokenType: response.tokenType,
    expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
  };
}

export async function raindropTokenRequest(body: Record<string, string>): Promise<RaindropTokenResponse> {
  const response = await fetch(RAINDROP_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ConnectorError(message || "Raindrop authorization failed", response.status);
  }

  return parseTokenResponse((await response.json()) as unknown);
}

async function activeTokens(auth: StoredConnectorAuth): Promise<StoredOAuthTokens> {
  const tokens = auth.oauth;
  if (!tokens) throw new ConnectorError("Connect Raindrop before importing", 401);
  const expiresAt = Date.parse(tokens.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + TOKEN_REFRESH_WINDOW_MS) {
    return tokens;
  }

  const { clientId, clientSecret } = configuredAuth(auth);
  const refreshed = await raindropTokenRequest({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const nextTokens = tokensFromResponse(refreshed, tokens.refreshToken);
  await writeConnectorOAuth(RAINDROP_ID, nextTokens);
  return nextTokens;
}

export function raindropAuthorizeUrl(clientId: string, callbackUrl: string, state: string): URL {
  const url = new URL(RAINDROP_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeRaindropOAuthCode(input: {
  code: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
}): Promise<StoredOAuthTokens> {
  try {
    const response = await raindropTokenRequest({
      grant_type: "authorization_code",
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.callbackUrl,
    });
    return tokensFromResponse(response);
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError && caught.message.toLowerCase().includes("redirect_uri")) {
      throw new ConnectorError(
        `Incorrect redirect_uri. In Raindrop app settings, set the redirect URI exactly to: ${input.callbackUrl}`,
        caught.status,
      );
    }
    throw caught;
  }
}

export function parseRaindropPage(payload: unknown): RaindropPage {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ConnectorError("Invalid Raindrop import response", 502);
  }
  const items = payload.items
    .map(raindropItemToWebImport)
    .filter((item): item is WebImportItem => Boolean(item));
  return {
    items,
    fetchedCount: payload.items.length,
  };
}

async function fetchRaindropPage(accessToken: string, page: number): Promise<RaindropPage> {
  const params = new URLSearchParams({
    page: String(page),
    perpage: String(RAINDROP_PER_PAGE),
  });
  const response = await fetch(`${RAINDROP_ITEMS_URL}?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ConnectorError(message || "Could not fetch Raindrop bookmarks", response.status);
  }

  return parseRaindropPage((await response.json()) as unknown);
}

async function fetchAllRaindrops(accessToken: string): Promise<RaindropPage> {
  const pages: RaindropPage[] = [];
  for (let page = 0; page < MAX_IMPORT_PAGES; page += 1) {
    const result = await fetchRaindropPage(accessToken, page);
    pages.push(result);
    if (result.fetchedCount < RAINDROP_PER_PAGE) break;
  }

  return {
    items: pages.flatMap((page) => page.items),
    fetchedCount: pages.reduce((total, page) => total + page.fetchedCount, 0),
  };
}

async function importDocuments(auth: StoredConnectorAuth): Promise<ConnectorImportResult> {
  const tokens = await activeTokens(auth);
  const page = await fetchAllRaindrops(tokens.accessToken);
  const result = await insertDedupedWebDocuments(page.items);
  return {
    connectorId: RAINDROP_ID,
    documents: result.documents,
    importedCount: result.documents.length,
    skippedCount: result.skippedCount + page.fetchedCount - page.items.length,
    totalFetched: page.fetchedCount,
  };
}

export const raindropProvider: ConnectorProvider = {
  capabilities: {
    supportsBrokerOAuth: true,
    supportsTokenFallback: false,
    canImport: true,
  },
  definition: {
    id: RAINDROP_ID,
    name: "Raindrop",
    description: "Import Raindrop bookmarks as web documents.",
    authKind: "oauth2",
    capabilities: {
      supportsBrokerOAuth: true,
      supportsTokenFallback: false,
      canImport: true,
    },
    importLabel: "Sync bookmarks",
    helpLabel: "Open Raindrop app settings",
    helpUrl: "https://app.raindrop.io/settings/integrations",
    configFields: [
      {
        name: "clientId",
        label: "Client ID",
        type: "text",
        required: true,
        placeholder: "Raindrop OAuth client ID",
      },
      {
        name: "clientSecret",
        label: "Client secret",
        type: "password",
        required: true,
        placeholder: "Raindrop OAuth client secret",
      },
    ],
  },
  status: (auth) => {
    const configured = Boolean(
      (process.env[RAINDROP_CLIENT_ID_ENV]?.trim() && process.env[RAINDROP_CLIENT_SECRET_ENV]?.trim()) ||
        (auth.config?.clientId?.trim() && auth.config.clientSecret?.trim()),
    );
    const connected = Boolean(auth.oauth?.accessToken && auth.oauth.refreshToken);
    return {
      id: RAINDROP_ID,
      configured,
      connected,
      needsConfig: !configured,
      redirectOrigin: configuredRedirectOrigin(auth),
      tokenExpiresAt: auth.oauth?.expiresAt,
    };
  },
  refreshAuth: activeTokens,
  oauthStartUrl: (auth, callbackUrl, state) => {
    const { clientId } = configuredAuth(auth);
    const redirectCallbackUrl = new URL("/api/connectors/raindrop/oauth/callback", configuredRedirectOrigin(auth)).toString();
    return raindropAuthorizeUrl(clientId, redirectCallbackUrl || callbackUrl, state);
  },
  oauthCallback: async (auth, code, callbackUrl) => {
    const { clientId, clientSecret } = configuredAuth(auth);
    return exchangeRaindropOAuthCode({
      code,
      callbackUrl,
      clientId,
      clientSecret,
    });
  },
  importDocuments,
};
