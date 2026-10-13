"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseIgnorePatterns } from "@/domain/comparison/path";

export interface IgnorePathSelectorProps {
  selectedPaths: string[];
  suggestions: string[];
  /** Disables Apply only. The field itself stays editable (and pasteable) while a comparison runs. */
  applyDisabled?: boolean;
  onChange: (paths: string[]) => void;
  onApply: (paths: string[]) => void;
}

interface DropdownPlacement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const DROPDOWN_GAP = 6;
const DROPDOWN_MARGIN = 12;
const DROPDOWN_PREFERRED_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 120;

function cleanPaths(paths: string[]): string[] {
  return paths.map((path) => path.trim()).filter(Boolean);
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(cleanPaths(paths))];
}

function pathsEqual(pathsA: string[], pathsB: string[]): boolean {
  return pathsA.length === pathsB.length && pathsA.every((path, index) => path === pathsB[index]);
}

export function IgnorePathSelector({
  selectedPaths,
  suggestions,
  applyDisabled = false,
  onChange,
  onApply
}: IgnorePathSelectorProps) {
  const listboxId = useId();
  const selectorRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<DropdownPlacement | null>(null);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  // Chips are identified by position, not path: a repeated path is allowed (paste it, then edit
  // the copy), so two chips can share the same text.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  // The chips live outside the text input, so the browser's own select-all can't reach them.
  // Ctrl/Cmd+A on an empty field marks them all selected; Ctrl/Cmd+C then copies the paths.
  const [chipsSelected, setChipsSelected] = useState(false);
  const normalizedSelectedPaths = useMemo(() => cleanPaths(selectedPaths), [selectedPaths]);
  const allChipsSelected = chipsSelected && normalizedSelectedPaths.length > 0;

  // The list is position: fixed against the field, not absolute inside it: its ancestors
  // (.workspace) clip overflow, which cut the list off behind the results card below. Re-placed
  // as chips wrap the field onto more rows, and on scroll/resize.
  const chipCount = normalizedSelectedPaths.length;
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = selectorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - DROPDOWN_MARGIN - DROPDOWN_GAP;
      const above = rect.top - DROPDOWN_MARGIN - DROPDOWN_GAP;
      const openDown = below >= DROPDOWN_PREFERRED_HEIGHT || below >= above;
      setPlacement({
        left: rect.left,
        width: rect.width,
        top: openDown ? rect.bottom + DROPDOWN_GAP : undefined,
        bottom: openDown ? undefined : window.innerHeight - rect.top + DROPDOWN_GAP,
        maxHeight: Math.max(DROPDOWN_MIN_HEIGHT, openDown ? below : above)
      });
    };
    place();
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [isOpen, chipCount]);
  const availableSuggestions = useMemo(() => {
    const selected = new Set(normalizedSelectedPaths);
    const needle = query.trim().toLowerCase();
    return uniquePaths(suggestions).filter(
      (path) => !selected.has(path) && (!needle || path.toLowerCase().includes(needle))
    );
  }, [normalizedSelectedPaths, query, suggestions]);

  const addPaths = (paths: string[]) => {
    const added = cleanPaths(paths);
    if (added.length) onChange([...normalizedSelectedPaths, ...added]);
    setQuery("");
    setActiveOptionIndex(0);
    setIsOpen(true);
  };

  const pathsWithCommittedEdit = (): string[] => {
    if (editingIndex === null) return normalizedSelectedPaths;
    const replacements = parseIgnorePatterns(editValue);
    if (!replacements.length) return normalizedSelectedPaths;
    return normalizedSelectedPaths.flatMap((path, index) =>
      index === editingIndex ? replacements : [path]
    );
  };

  const stopEditing = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const removePathAt = (index: number) => {
    onChange(normalizedSelectedPaths.filter((_, position) => position !== index));
    if (editingIndex === null) return;
    if (index < editingIndex) setEditingIndex(editingIndex - 1);
    else if (index === editingIndex) stopEditing();
  };

  const saveEditedPath = () => {
    if (editingIndex === null || !parseIgnorePatterns(editValue).length) return;
    const next = pathsWithCommittedEdit();
    if (!pathsEqual(next, normalizedSelectedPaths)) onChange(next);
    stopEditing();
  };

  const commitPendingPaths = (): string[] => {
    const editedPaths = pathsWithCommittedEdit();
    const next = [...editedPaths, ...parseIgnorePatterns(query)];
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
      <div ref={selectorRef} className={`ignore-path-selector${isOpen ? " is-open" : ""}`}>
        <div className="ignore-path-input-shell">
          {normalizedSelectedPaths.map((path, index) =>
            editingIndex === index ? (
              <span className="ignore-path-chip is-editing" key={`${index}:${path}`}>
                <input
                  className="ignore-path-chip-editor"
                  type="text"
                  aria-label={`Edit ignored path ${path}`}
                  value={editValue}
                  autoFocus
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
                  disabled={!parseIgnorePatterns(editValue).length}
                  onClick={saveEditedPath}
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  className="ignore-path-chip-action cancel"
                  type="button"
                  aria-label={`Cancel editing ignored path ${path}`}
                  title="Cancel editing"
                  onClick={stopEditing}
                >
                  <span aria-hidden="true">↩</span>
                </button>
              </span>
            ) : (
              <span
                className={`ignore-path-chip${allChipsSelected ? " is-selected" : ""}`}
                key={`${index}:${path}`}
              >
                <button
                  className="ignore-path-chip-label"
                  type="button"
                  aria-label={`Edit ignored path ${path}`}
                  title="Edit ignored path"
                  onClick={() => {
                    setEditingIndex(index);
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
                  onClick={() => removePathAt(index)}
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
            onFocus={() => setIsOpen(true)}
            // Escape closes the list but leaves focus here, so onFocus alone can never reopen it.
            onClick={() => {
              setIsOpen(true);
              setChipsSelected(false);
            }}
            onBlur={() => {
              setIsOpen(false);
              setChipsSelected(false);
            }}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setChipsSelected(false);
              // Normally paste is caught by onPaste below, but some paste paths (middle-click
              // paste, certain mobile/IME flows) never fire a clipboard `paste` event and land
              // here instead — inputType still reports insertFromPaste, so treat it the same way
              // rather than leaving the pasted path stranded in the query box uncommitted.
              const isPastedInsert =
                (event.nativeEvent as InputEvent).inputType === "insertFromPaste";
              const pastedPaths =
                isPastedInsert || /[,\n]$/.test(nextQuery) ? parseIgnorePatterns(nextQuery) : [];
              if (pastedPaths.length) addPaths(pastedPaths);
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
            onCopy={(event) => {
              if (!allChipsSelected) return;
              event.preventDefault();
              // Same separators the paste handler splits on, so the list round-trips.
              event.clipboardData.setData("text/plain", normalizedSelectedPaths.join(", "));
            }}
            onKeyDown={(event) => {
              const hasModifier = event.ctrlKey || event.metaKey;
              const key = event.key.toLowerCase();
              // With text typed, Ctrl/Cmd+A keeps its native meaning: select that text.
              if (hasModifier && key === "a" && !query && normalizedSelectedPaths.length) {
                event.preventDefault();
                setChipsSelected(true);
                return;
              }
              if (allChipsSelected && hasModifier && key === "c") {
                // An input with no selected text may not fire `copy` in every browser, so write
                // the clipboard here as well; onCopy writes the same text where `copy` does fire.
                const text = normalizedSelectedPaths.join(", ");
                void navigator.clipboard?.writeText(text).catch(() => {});
                return;
              }
              if (allChipsSelected && !["shift", "control", "alt", "meta"].includes(key)) {
                setChipsSelected(false);
                // Only deselect: a stray Backspace must not also drop the last chip.
                if (key === "backspace" || key === "delete") {
                  event.preventDefault();
                  return;
                }
              }
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
                removePathAt(normalizedSelectedPaths.length - 1);
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
          <div
            className="ignore-path-dropdown"
            style={placement ?? undefined}
            // Keep focus in the input when the press lands on the list's padding or scrollbar,
            // otherwise the blur closes the list before the click can register.
            onMouseDown={(event) => event.preventDefault()}
          >
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
        disabled={applyDisabled}
        onClick={() => onApply(commitPendingPaths())}
      >
        Apply
      </button>
    </div>
  );
}
