import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { ConnectorConfigInput, ConnectorImportResult, ConnectorListItem } from "../lib/types";
import { Modal } from "./Modal";

interface ConnectorModalProps {
  connector: ConnectorListItem | null;
  importing: boolean;
  importResult: ConnectorImportResult | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConnect: () => void;
  onImport: () => void;
  onSaveConfig: (input: ConnectorConfigInput) => void;
}

function inputFromValues(values: Record<string, string>): ConnectorConfigInput {
  return {
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    apiKey: values.apiKey,
  };
}

export function ConnectorModal({
  connector,
  importing,
  importResult,
  open,
  saving,
  onClose,
  onConnect,
  onImport,
  onSaveConfig,
}: ConnectorModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const definition = connector?.definition;
  const status = connector?.status;

  useEffect(() => {
    setValues({});
    setAdvancedOpen(false);
  }, [connector?.definition.id]);

  const hasAnyValue = useMemo(() => Object.values(values).some((value) => value.trim()), [values]);
  const hasRequiredValues = useMemo(
    () =>
      definition?.configFields.every((field) => !field.required || status?.configured || values[field.name]?.trim()) ??
      false,
    [definition, status, values],
  );
  const canSave = Boolean(definition && hasAnyValue && hasRequiredValues && !saving);
  const supportsBrokerOAuth = Boolean(definition?.capabilities.supportsBrokerOAuth);
  const supportsTokenFallback = Boolean(definition?.capabilities.supportsTokenFallback);
  const supportsConfigFields = Boolean(definition?.configFields.length);
  const supportsAdvanced = Boolean((status?.connected && supportsConfigFields) || supportsTokenFallback);
  const showConfigFields = Boolean(
    (status?.needsConfig || (!status?.connected && supportsConfigFields) || (advancedOpen && supportsConfigFields)) &&
      supportsConfigFields,
  );
  const showReconnect = Boolean(advancedOpen && supportsBrokerOAuth && status?.connected);
  const canConnect = Boolean(supportsBrokerOAuth && status?.configured && !importing);
  const canImport = Boolean(status?.connected && !importing);
  const statusLabel = status?.connected ? "Connected" : "Not connected";
  const helperText = status?.needsConfig
    ? `Add OAuth credentials for ${definition?.name ?? "this connector"}.`
    : status?.connected
      ? definition?.description
      : `OAuth app credentials are saved. Update them here or sign in with ${definition?.name ?? "this service"}.`;
  const primaryLabel = status?.connected ? definition?.importLabel ?? "Import" : `Connect ${definition?.name ?? "connector"}`;
  const primaryDisabled = status?.connected ? !canImport : !canConnect;
  const handlePrimaryAction = status?.connected ? onImport : onConnect;

  return (
    <Modal open={open && Boolean(connector)} title={definition?.name ?? "Connector"} titleId="connectorTitle" onClose={onClose}>
      <div className="settings-body source-form">
        <div className="source-file">{status ? `${statusLabel}. ${helperText}` : definition?.description}</div>

        {supportsAdvanced ? (
          <button className="setting-row" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            <ChevronDown size={14} />
            <span className="setting-main">
              <span className="setting-name">Advanced</span>
              <span className="setting-desc">Connection tools and token fallback.</span>
            </span>
          </button>
        ) : null}

        {showReconnect ? (
          <button className="setting-row" disabled={!canConnect} onClick={onConnect}>
            <span aria-hidden="true" />
            <span className="setting-main">
              <span className="setting-name">Reconnect account</span>
              <span className="setting-desc">Sign in again if sync stops working or you changed accounts.</span>
            </span>
          </button>
        ) : null}

        {showConfigFields && definition?.helpUrl ? (
          <button className="setting-row" onClick={() => window.open(definition.helpUrl, "_blank", "noopener,noreferrer")}>
            <ExternalLink size={14} />
            <span className="setting-main">
              <span className="setting-name">{definition.helpLabel ?? "Open setup page"}</span>
              <span className="setting-desc">Open the provider settings page to create OAuth credentials.</span>
            </span>
            <span className="setting-meta">new</span>
          </button>
        ) : null}

        {showConfigFields && definition?.configFields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            <input
              type={field.type}
              placeholder={status?.configured && field.type === "password" ? "Leave blank to keep current value" : field.placeholder}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
            />
          </label>
        ))}

        {importResult ? (
          <div className="source-file">
            Imported {importResult.importedCount}, skipped {importResult.skippedCount}, fetched {importResult.totalFetched}.
          </div>
        ) : null}

        <div className="form-actions">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          {showConfigFields ? (
            <button className="btn-ghost" disabled={!canSave} onClick={() => onSaveConfig(inputFromValues(values))}>
              {saving ? "Saving..." : "Save config"}
            </button>
          ) : null}
          <button className="btn-primary" disabled={primaryDisabled} onClick={handlePrimaryAction}>
            {importing ? "Importing..." : primaryLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
