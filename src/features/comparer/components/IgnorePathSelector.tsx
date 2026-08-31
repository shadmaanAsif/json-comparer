"use client";

import { useId, useMemo, useState } from "react";
import { parseIgnorePatterns } from "@/domain/comparison/path";

export interface IgnorePathSelectorProps {
  selectedPaths: string[];
  suggestions: string[];
  disabled?: boolean;
  onChange: (paths: string[]) => void;
  onApply: (paths: string[]) => void;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
}

function pathsEqual(pathsA: string[], pathsB: string[]): boolean {
  return pathsA.length === pathsB.length && pathsA.every((path, index) => path === pathsB[index]);
}

export function IgnorePathSelector({
  selectedPaths,
  suggestions,
  disabled = false,
  onChange,
  onApply
}: IgnorePathSelectorProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const normalizedSelectedPaths = useMemo(() => uniquePaths(selectedPaths), [selectedPaths]);
  const availableSuggestions = useMemo(() => {
    const selected = new Set(normalizedSelectedPaths);
    const needle = query.trim().toLowerCase();
    return uniquePaths(suggestions).filter(
      (path) => !selected.has(path) && (!needle || path.toLowerCase().includes(needle))
    );
  }, [normalizedSelectedPaths, query, suggestions]);

  const addPaths = (paths: string[]) => {
    const next = uniquePaths([...normalizedSelectedPaths, ...paths]);
    if (!pathsEqual(next, normalizedSelectedPaths)) onChange(next);
    setQuery("");
    setActiveOptionIndex(0);
    setIsOpen(true);
  };

  const pathsWithCommittedEdit = (): string[] => {
    if (!editingPath) return normalizedSelectedPaths;
    const replacements = parseIgnorePatterns(editValue);
    if (!replacements.length) return normalizedSelectedPaths;
    return uniquePaths(
      normalizedSelectedPaths.flatMap((path) => (path === editingPath ? replacements : [path]))
    );
  };

  const stopEditing = () => {
    setEditingPath(null);
    setEditValue("");
  };

  const saveEditedPath = () => {
    if (!editingPath || !parseIgnorePatterns(editValue).length) return;
    const next = pathsWithCommittedEdit();
    if (!pathsEqual(next, normalizedSelectedPaths)) onChange(next);
    stopEditing();
  };

  const commitPendingPaths = (): string[] => {
    const editedPaths = pathsWithCommittedEdit();
    const next = uniquePaths([...editedPaths, ...parseIgnorePatterns(query)]);
    if (!pathsEqual(next, normalizedSelectedPaths)) onChange(next);
    stopEditing();
    setQuery("");
    setActiveOptionIndex(0);
    return next;
  };

  const commitQuery = () => {
    const activeSuggestion = availableSuggestions[activeOptionIndex];
    const paths = activeSuggestion ? [activeSuggestion] : parseIgnorePatterns(query);
    if (paths.length) addPaths(paths);
  };

  return (
    <div className="ignore-field-controls">
      <div className={`ignore-path-selector${isOpen ? " is-open" : ""}`}>
        <div className="ignore-path-input-shell">
          {normalizedSelectedPaths.map((path) =>
            editingPath === path ? (
              <span className="ignore-path-chip is-editing" key={path}>
                <input
                  className="ignore-path-chip-editor"
                  type="text"
                  aria-label={`Edit ignored path ${path}`}
                  value={editValue}
                  autoFocus
                  disabled={disabled}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveEditedPath();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      stopEditing();
                    }
                  }}
                />
                <button
                  className="ignore-path-chip-action save"
                  type="button"
                  aria-label={`Save ignored path ${path}`}
                  title="Save path"
                  disabled={disabled || !parseIgnorePatterns(editValue).length}
                  onClick={saveEditedPath}
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  className="ignore-path-chip-action cancel"
                  type="button"
                  aria-label={`Cancel editing ignored path ${path}`}
                  title="Cancel editing"
                  disabled={disabled}
                  onClick={stopEditing}
                >
                  <span aria-hidden="true">↩</span>
                </button>
              </span>
            ) : (
              <span className="ignore-path-chip" key={path}>
                <button
                  className="ignore-path-chip-label"
                  type="button"
                  aria-label={`Edit ignored path ${path}`}
                  title="Edit ignored path"
                  disabled={disabled}
                  onClick={() => {
                    setEditingPath(path);
                    setEditValue(path);
                    setIsOpen(false);
                  }}
                >
                  <span>{path}</span>
                  <span className="ignore-path-edit-icon" aria-hidden="true">
                    ✎
                  </span>
                </button>
                <button
                  className="ignore-path-chip-action remove"
                  type="button"
                  aria-label={`Remove ignored path ${path}`}
                  title="Remove ignored path"
                  disabled={disabled}
                  onClick={() => onChange(normalizedSelectedPaths.filter((item) => item !== path))}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            )
          )}
          <input
            id="ignore-paths-input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={
              isOpen && availableSuggestions[activeOptionIndex]
                ? `${listboxId}-option-${activeOptionIndex}`
                : undefined
            }
            value={query}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onChange={(event) => {
              const nextQuery = event.target.value;
              if (/[,\n]$/.test(nextQuery)) addPaths(parseIgnorePatterns(nextQuery));
              else {
                setQuery(nextQuery);
                setActiveOptionIndex(0);
                setIsOpen(true);
              }
            }}
            onPaste={(event) => {
              const pastedPaths = parseIgnorePatterns(event.clipboardData.getData("text"));
              if (!pastedPaths.length) return;
              event.preventDefault();
              addPaths(pastedPaths);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIsOpen(true);
                setActiveOptionIndex((current) =>
                  Math.min(current + 1, Math.max(0, availableSuggestions.length - 1))
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveOptionIndex((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                commitQuery();
              } else if (event.key === "Escape") {
                setIsOpen(false);
              } else if (event.key === "Backspace" && !query && normalizedSelectedPaths.length) {
                onChange(normalizedSelectedPaths.slice(0, -1));
              }
            }}
            placeholder={
              normalizedSelectedPaths.length
                ? "Search or paste another path"
                : "Search or paste paths"
            }
          />
        </div>

        {isOpen && (
          <div className="ignore-path-dropdown">
            <div
              id={listboxId}
              className="ignore-path-options"
              role="listbox"
              aria-label="Detected difference paths"
              aria-multiselectable="true"
            >
              {availableSuggestions.length ? (
                availableSuggestions.map((path, index) => (
                  <button
                    id={`${listboxId}-option-${index}`}
                    className={index === activeOptionIndex ? "is-active" : ""}
                    key={path}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    onClick={() => addPaths([path])}
                  >
                    <span>{path}</span>
                    <small>Add</small>
                  </button>
                ))
              ) : (
                <p role="status">
                  {suggestions.length
                    ? "No matching unselected paths."
                    : "Compare responses to detect paths."}
                </p>
              )}
            </div>
            {query.trim() && !availableSuggestions.includes(query.trim()) && (
              <button
                className="ignore-path-custom-option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addPaths(parseIgnorePatterns(query))}
              >
                Add custom pattern <strong>{query.trim()}</strong>
              </button>
            )}
          </div>
        )}
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled}
        onClick={() => onApply(commitPendingPaths())}
      >
        Apply
      </button>
    </div>
  );
}
