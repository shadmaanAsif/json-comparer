"use client";

import { useEffect, useState } from "react";
import type { ResponseSide } from "../types";

interface AddDataModalProps {
  side: ResponseSide;
  initialCommand: string;
  busy: boolean;
  onClose: () => void;
  onFile: (file?: File) => Promise<void>;
  onFetch: (command: string) => Promise<boolean>;
}

export function AddDataModal({
  side,
  initialCommand,
  busy,
  onClose,
  onFile,
  onFetch
}: AddDataModalProps) {
  const [command, setCommand] = useState(initialCommand);
  const [error, setError] = useState("");
  const credentialWarning =
    /(?:^|\s)(?:-u|--user|-b|--cookie)(?:\s|=)|authorization\s*:|cookie\s*:/i.test(command);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy, onClose]);

  const submit = async () => {
    if (!command.trim()) {
      setError("Enter a URL or a curl command first.");
      return;
    }
    setError("");
    try {
      if (await onFetch(command)) onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The fetch failed.");
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-modal-title"
        aria-describedby="add-modal-description"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Import data</p>
            <h2 id="add-modal-title">Add data to Response {side}</h2>
          </div>
          <button
            className="text-button modal-close"
            type="button"
            aria-label="Close Add Data dialog"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p id="add-modal-description">
          Upload a local file, or fetch an administrator-approved endpoint through the secure
          server.
        </p>
        <div className="modal-leg">
          <h3>Upload file</h3>
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={(event) => {
              setError("");
              void onFile(event.target.files?.[0]).catch((reason) =>
                setError(reason instanceof Error ? reason.message : "The file could not be read.")
              );
            }}
          />
        </div>
        <div className="modal-separator" aria-hidden="true">
          or
        </div>
        <div className="modal-leg">
          <label htmlFor="modal-curl">
            <strong>URL or cURL command</strong>
          </label>
          <textarea
            id="modal-curl"
            autoFocus
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="curl https://api.example.com/data -H 'Accept: application/json'"
          />
          <p className="security-note">
            Public targets require allowlisted HTTPS. Localhost HTTP is accepted only when the
            server enables its local-development exception. Redirects are revalidated. Authorization
            and Cookie headers are stripped unless the administrator explicitly enables credentials.
          </p>
          {credentialWarning && (
            <p className="warning" role="alert">
              This command contains credentials. They will be sent to this application server and
              are stripped by default. Remove secrets unless the administrator explicitly approved
              credential forwarding.
            </p>
          )}
          {error && (
            <p className="status error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Fetching…" : "Go"}
          </button>
        </div>
      </section>
    </div>
  );
}
