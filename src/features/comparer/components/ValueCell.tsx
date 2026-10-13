"use client";

import { useState } from "react";

type ValueType = "string" | "number" | "boolean" | "null" | "array" | "object";

function describeValue(value: unknown): { text: string; type: ValueType } {
  if (typeof value === "string") return { text: JSON.stringify(value), type: "string" };
  if (value === null) return { text: "null", type: "null" };
  if (Array.isArray(value)) return { text: JSON.stringify(value, null, 2), type: "array" };
  if (typeof value === "object") return { text: JSON.stringify(value, null, 2), type: "object" };
  return { text: String(value), type: typeof value === "boolean" ? "boolean" : "number" };
}

export function ValueCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (value === undefined) return <span>—</span>;
  // Strings keep their JSON quotes so the string "true" never reads as the boolean true.
  const { text, type } = describeValue(value);
  const truncated = text.length > 70;

  return (
    <div className="value-cell">
      <pre className={`value-${type}`} data-value-type={type} title={type}>
        {expanded || !truncated ? text : `${text.slice(0, 70)}…`}
      </pre>
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
