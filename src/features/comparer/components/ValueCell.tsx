"use client";

import { useState } from "react";

export function ValueCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (value === undefined) return <span>—</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const truncated = text.length > 70;

  return (
    <div className="value-cell">
      <pre>{expanded || !truncated ? text : `${text.slice(0, 70)}…`}</pre>
      {truncated && (
        <button
          className="text-button"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
