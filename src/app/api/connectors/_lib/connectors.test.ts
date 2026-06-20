import { describe, expect, test } from "bun:test";
import { createTransferCode, isAllowedReturnUrl, takeTransferCode } from "../../connector-broker/_lib/broker";
import { normalizeWebImportItem } from "./documents";
import { connectorProvider, connectorProviders } from "./providers";
import { requestOrigin } from "./routes";
import {
  exchangeRaindropOAuthCode,
  normalizeRaindropAccessToken,
  parseRaindropPage,
  raindropItemToWebImport,
  raindropProvider,
} from "./raindrop";

describe("connector registry", () => {
  test("resolves the Raindrop provider", () => {
    expect(connectorProvider("raindrop")?.definition.name).toBe("Raindrop");
    expect(connectorProvider("missing")).toBeNull();
    expect(connectorProviders().map((provider) => provider.definition.id)).toEqual(["raindrop"]);
  });

  test("exposes provider capabilities through connector metadata", () => {
    expect(raindropProvider.definition.capabilities).toEqual({
      supportsBrokerOAuth: true,
      supportsTokenFallback: false,
      canImport: true,
    });
  });
});

describe("connector status", () => {
  test("requires OAuth app credentials before connection", () => {
    expect(raindropProvider.status({})).toEqual({
      id: "raindrop",
      configured: false,
      connected: false,
      needsConfig: true,
      redirectOrigin: "http://127.0.0.1:3000",
      tokenExpiresAt: undefined,
    });
  });

  test("does not serialize connector secrets or tokens", () => {
    const status = raindropProvider.status({
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
      },
      oauth: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-06-15T00:00:00.000Z",
      },
    });

    expect(status).toEqual({
      id: "raindrop",
      configured: true,
      connected: true,
      needsConfig: false,
      redirectOrigin: "http://127.0.0.1:3000",
      tokenExpiresAt: "2026-06-15T00:00:00.000Z",
    });
    expect(JSON.stringify(status)).not.toContain("client-secret");
    expect(JSON.stringify(status)).not.toContain("access-token");
  });

  test("does not treat a personal token fallback as the setup path", () => {
    expect(
      raindropProvider.status({
        config: {
          apiKey: "personal-token",
        },
      }),
    ).toEqual({
      id: "raindrop",
      configured: false,
      connected: false,
      needsConfig: true,
      redirectOrigin: "http://127.0.0.1:3000",
      tokenExpiresAt: undefined,
    });
  });
});

describe("connector broker contract", () => {
  test("builds a provider OAuth start URL from saved app credentials", () => {
    const url = raindropProvider.oauthStartUrl?.(
      {
        config: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
      },
      "http://127.0.0.1:3000/api/connectors/raindrop/oauth/callback",
      "state-123",
    );

    expect(url?.toString()).toBe(
      "https://raindrop.io/oauth/authorize?client_id=client-id&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fconnectors%2Fraindrop%2Foauth%2Fcallback&response_type=code&state=state-123",
    );
  });

  test("uses configured redirect origin for provider OAuth start", () => {
    const url = raindropProvider.oauthStartUrl?.(
      {
        config: {
          clientId: "client-id",
          clientSecret: "client-secret",
          redirectOrigin: "http://127.0.0.1:3000",
        },
      },
      "http://localhost:3000/api/connectors/raindrop/oauth/callback",
      "state-123",
    );

    expect(url?.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3000/api/connectors/raindrop/oauth/callback");
  });

  test("allows local return URLs and rejects remote ones", () => {
    expect(isAllowedReturnUrl("http://127.0.0.1:3000/api/connectors/raindrop/oauth/callback")).toBe(true);
    expect(isAllowedReturnUrl("http://localhost:3000/api/connectors/raindrop/oauth/callback")).toBe(true);
    expect(isAllowedReturnUrl("https://example.com/callback")).toBe(false);
  });

  test("uses one-time transfer codes", () => {
    const tokens = {
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresAt: "2026-06-20T00:00:00.000Z",
    };
    const code = createTransferCode("raindrop", tokens);

    expect(takeTransferCode("raindrop", code)).toEqual(tokens);
    expect(takeTransferCode("raindrop", code)).toBeNull();
  });

  test("explains Raindrop redirect URI mismatches", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((() =>
      Promise.resolve(
        new Response("Incorrect redirect_uri", {
          status: 400,
        }),
      )) as unknown) as typeof fetch;

    try {
      await expect(
        exchangeRaindropOAuthCode({
          code: "code",
          callbackUrl: "http://127.0.0.1:3000/api/connectors/raindrop/oauth/callback",
          clientId: "client-id",
          clientSecret: "client-secret",
        }),
      ).rejects.toThrow(
        "Incorrect redirect_uri. In Raindrop app settings, set the redirect URI exactly to: http://127.0.0.1:3000/api/connectors/raindrop/oauth/callback",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("preserves the public host during OAuth callback token exchange", () => {
    const request = new Request("http://localhost:3000/api/connectors/raindrop/oauth/callback?code=code&state=state", {
      headers: {
        host: "127.0.0.1:3000",
      },
    });

    expect(requestOrigin(request)).toBe("http://127.0.0.1:3000");
  });

  test("preserves localhost when the connector flow starts from localhost", () => {
    const request = new Request("http://localhost:3000/api/connectors/raindrop/oauth/start");

    expect(requestOrigin(request)).toBe("http://localhost:3000");
  });
});

describe("Raindrop import normalization", () => {
  test("accepts a pasted authorization header as an access token", () => {
    expect(normalizeRaindropAccessToken("Authorization: Bearer token-123")).toBe("token-123");
    expect(normalizeRaindropAccessToken("Bearer token-456")).toBe("token-456");
  });

  test("maps Raindrop items into web imports", () => {
    expect(
      raindropItemToWebImport({
        title: "Example",
        link: "https://Example.com/path#section",
        tags: ["read", "later"],
        created: "2026-06-15T10:30:00.000Z",
      }),
    ).toEqual({
      url: "https://Example.com/path#section",
      title: "Example",
      tags: ["raindrop", "read", "later"],
      createdAt: "2026-06-15T10:30:00.000Z",
    });
  });

  test("normalizes web imports for storage and dedupe", () => {
    expect(
      normalizeWebImportItem({
        url: "https://Example.com/path#section",
        title: "  Example  ",
        tags: ["read", "read", " later "],
        createdAt: "2026-06-15T10:30:00.000Z",
      }),
    ).toEqual({
      url: "https://example.com/path",
      title: "Example",
      tags: ["read", "later"],
      createdAt: "2026-06-15T10:30:00.000Z",
    });
  });

  test("parses page counts separately from importable items", () => {
    const page = parseRaindropPage({
      items: [
        { title: "One", link: "https://example.com/one", tags: ["a"] },
        { title: "Missing link", tags: ["b"] },
      ],
    });

    expect(page).toEqual({
      fetchedCount: 2,
      items: [
        {
          url: "https://example.com/one",
          title: "One",
          tags: ["raindrop", "a"],
          createdAt: undefined,
        },
      ],
    });
  });
});
