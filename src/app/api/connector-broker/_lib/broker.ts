import { randomUUID } from "node:crypto";
import type { ConnectorId } from "../../../../lib/types";
import type { StoredOAuthTokens } from "../../connectors/_lib/auth";

const BROKER_STATE_TTL_MS = 10 * 60 * 1000;
const TRANSFER_CODE_TTL_MS = 2 * 60 * 1000;

export interface BrokerState {
  connectorId: ConnectorId;
  returnUrl: string;
  state: string;
  createdAt: number;
}

interface BrokerTransfer {
  connectorId: ConnectorId;
  tokens: StoredOAuthTokens;
  createdAt: number;
}

const globalForBroker = globalThis as typeof globalThis & {
  basedConnectorBroker?: {
    states: Map<string, BrokerState>;
    transfers: Map<string, BrokerTransfer>;
  };
};

function brokerStore() {
  const current =
    globalForBroker.basedConnectorBroker ??
    {
      states: new Map<string, BrokerState>(),
      transfers: new Map<string, BrokerTransfer>(),
    };
  globalForBroker.basedConnectorBroker = current;
  return current;
}

function isExpired(createdAt: number, ttlMs: number): boolean {
  return Date.now() - createdAt > ttlMs;
}

function cleanup() {
  const store = brokerStore();
  for (const [state, value] of store.states) {
    if (isExpired(value.createdAt, BROKER_STATE_TTL_MS)) store.states.delete(state);
  }
  for (const [code, value] of store.transfers) {
    if (isExpired(value.createdAt, TRANSFER_CODE_TTL_MS)) store.transfers.delete(code);
  }
}

export function isAllowedReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    return (url.protocol === "http:" || url.protocol === "https:") && localHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export function createBrokerState(input: Omit<BrokerState, "createdAt">): string {
  cleanup();
  const state = randomUUID();
  brokerStore().states.set(state, {
    ...input,
    createdAt: Date.now(),
  });
  return state;
}

export function takeBrokerState(state: string): BrokerState | null {
  cleanup();
  const store = brokerStore();
  const value = store.states.get(state);
  if (!value) return null;
  store.states.delete(state);
  return value;
}

export function createTransferCode(connectorId: ConnectorId, tokens: StoredOAuthTokens): string {
  cleanup();
  const code = randomUUID();
  brokerStore().transfers.set(code, {
    connectorId,
    tokens,
    createdAt: Date.now(),
  });
  return code;
}

export function takeTransferCode(connectorId: ConnectorId, code: string): StoredOAuthTokens | null {
  cleanup();
  const store = brokerStore();
  const value = store.transfers.get(code);
  if (!value || value.connectorId !== connectorId) return null;
  store.transfers.delete(code);
  return value.tokens;
}

export function appendReturnParams(returnUrl: string, params: Record<string, string>): URL {
  const url = new URL(returnUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}
