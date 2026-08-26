interface TreeNodeProps {
  name?: string;
  value: unknown;
}

function TreeNode({ name, value }: TreeNodeProps) {
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const label = Array.isArray(value)
      ? `[ ${entries.length} item${entries.length === 1 ? "" : "s"} ]`
      : `{ ${entries.length} field${entries.length === 1 ? "" : "s"} }`;
    if (!entries.length) {
      return (
        <div className="tree-leaf">
          <span className="tree-key">{name}</span> <span>{Array.isArray(value) ? "[]" : "{}"}</span>
        </div>
      );
    }
    return (
      <details className="tree-node" open>
        <summary>
          {name !== undefined && <span className="tree-key">{name}: </span>}
          {label}
        </summary>
        <div>
          {entries.map(([key, child]) => (
            <TreeNode key={key} name={key} value={child} />
          ))}
        </div>
      </details>
    );
  }
  return (
    <div className={`tree-leaf value-${value === null ? "null" : typeof value}`}>
      <span className="tree-key">{name}</span>
      {name !== undefined && ": "}
      <span>{typeof value === "string" ? JSON.stringify(value) : String(value)}</span>
    </div>
  );
}

export function JsonTree({ raw }: { raw: string }) {
  if (!raw.trim())
    return (
      <div className="empty-state">
        Nothing to show yet — paste or load JSON on the JSON tab first.
      </div>
    );
  let parsed: unknown;
  let parseError = "";
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
  if (parseError) return <div className="empty-state error">{parseError}</div>;
  return (
    <div className="json-tree">
      <TreeNode value={parsed} />
    </div>
  );
}
