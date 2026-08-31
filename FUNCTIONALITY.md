# JSON Comparer — Functionality

This file is the authoritative catalogue of functionality implemented in the JSON Comparer application. Update it whenever user-visible behavior changes. Planned requirements belong in `docs/reference/SRS.md`, while implementation gaps and source-specification parity are tracked in `docs/FEATURE_AUDIT.md`.

## Comparison terminology

- **Response A / Baseline:** the first JSON document and the structure-schema baseline.
- **Response B / Candidate:** the second JSON document being compared with the baseline.
- **Only in A:** the path exists in Response A and is missing from Response B.
- **Only in B:** the path exists in Response B and is missing from Response A.
- **Modified:** the path exists in both responses, but its value or JSON type differs.
- **Ignored:** the finding still exists in the comparison model but is excluded from visible counts, highlights, and result rows unless Show Ignored is active; category totals continue to represent all underlying findings.

## Aligned JSON display

- Response A is the display-order baseline for object keys shared by both responses.
- Keys found on only one side retain their original positions, and array elements are never reordered.
- One-sided fields and nested values are mirrored by JSON-safe blank line blocks in the opposite panel, keeping the next corresponding field on the same horizontal row.
- Placeholder blocks carry path metadata so missing-field highlighting and navigation work on both the real value and its opposite-side gap.
- The comparison worker returns the exact real-value and placeholder path-to-line maps used to render the aligned JSON. Highlights, gutter line numbers, minimap markers, and navigation therefore target the rendered row directly even in large or deeply nested documents; blank alignment gaps do not reset nested path context.
- Alignment runs after Compare, paste, file upload, secure fetch, and Load Sample when both panels contain valid JSON.
- Manual typing is not reformatted or interrupted. Findings are always computed from the original unaligned parsed values, so display alignment cannot change comparison results.

## Synchronized comparison and exact findings

- Structurally aligned JSON editors synchronize vertical scrolling by the same aligned line offset; temporarily unaligned manual input falls back to proportional scrolling.
- Programmatic partner scrolling is guarded so it cannot create feedback loops or visible jitter.
- Ordered comparisons recursively expand added or removed objects and arrays to the smallest meaningful leaf paths; empty containers remain meaningful findings at their own paths.
- The Differences section includes exact Only in A, Only in B, and Modified rows with only the relevant Source A and Target B values.
- Missing Fields rows are grouped under Only in A and Only in B.
- Nested paths such as `data.config.countries[0].phone` retain their exact JSON Pointer identity for findings, structure/schema output, filtering, full-width editor-row highlighting, line-number highlighting, minimap markers, and navigation.
- Result and JSON-highlight filters use independently selectable chips with explicit pressed states, side-specific colors, and keyboard operation.
- Expand All and Collapse All control the Structure Schema, Missing Fields, and Differences sections together while each section remains independently expandable.

## JSON input and navigation

- Independent Response A (baseline) and Response B (candidate) editors.
- A shared Expand Panels control increases both JSON editors and Tree views together; Collapse Panels restores the compact height.
- Paste, type, quick-upload, or use the shared Add Data dialog.
- Prettify validates and formats JSON without changing invalid input.
- Invalid non-empty JSON highlights the entire affected panel, marks its editor invalid for assistive technology, and shows a visible syntax-error state.
- Invalid syntax also highlights its JSON line, gutter, minimap marker, and navigation target; these overlays are not added to the Tree view.
- JSON and collapsible Tree tabs preserve the same underlying document.
- The Tree tab highlights matching nodes and leaves using the same Missing, Structure, and Changed categories already computed for the JSON view; category badges ensure color is not the only cue.
- A floating Tree finding navigator shows the categories present as colored dots, the active/total finding count, and previous/next arrows. Navigation wraps, reopens collapsed ancestors, centers the selected node, and focuses it without shifting the page.
- Find supports case-insensitive matching, match counts, Enter/Shift+Enter navigation, and Escape to close.
- Synchronized logical line-number gutters are displayed beside both JSON editors.
- Editor row overlays, gutters, placeholder gaps, and viewport calculations share the textarea's measured 22.4-pixel line height and padding. The slightly roomier rows improve scanning while preventing cumulative drift across long or deeply nested documents.
- Highlighted gutter lines are clickable and scroll the corresponding source line into view.
- A right-side minimap represents highlighted findings proportionally across the entire JSON document; each marker is keyboard/click navigable.
- Floating “N more above/below” arrow chips appear when highlighted findings are outside the visible editor viewport and jump to the nearest finding.
- A persistent color-coded previous/next finding stepper continues through every highlighted line and wraps at the beginning/end. Navigation centers the selected row using the current rendered panel height, keeps focus from shifting the page, and immediately synchronizes the partner panel.
- The active finding is emphasized in the full-row overlay, line gutter, and minimap in both compact and expanded modes.
- Expanded mode uses up to 86% of the viewport height, capped at 980 pixels, so substantially more JSON remains visible.
- Document byte limits protect the browser from unexpectedly large inputs.

## Add Data and secure cURL import

- The shared Add dialog targets the panel from which it was opened.
- Local JSON/text file upload remains entirely in the browser.
- Bare URLs and supported cURL commands can be fetched through `/api/fetch-proxy`. Public targets require HTTPS; an explicitly enabled local-development exception accepts HTTP only for `localhost`, `127.0.0.1`, and `::1`.
- Supported cURL options include method, headers, request data, Basic auth, user-agent, cookies, and common no-op flags.
- Successful JSON responses are detected by parsing and prettified; text remains unchanged.
- Non-2xx response bodies are still loaded so API error payloads can be compared.
- The editable inline cURL bar remains available after a fetch and supports Ctrl/Cmd+Enter reruns.
- Local development accepts any public HTTPS host through a guarded `*` policy. Production requires explicit `FETCH_PROXY_ALLOWLIST` hostnames and rejects the wildcard.
- `FETCH_PROXY_ALLOW_LOCALHOST=true` permits loopback HTTP/HTTPS and arbitrary development ports only when the app runs in non-production on a loopback origin. It does not permit private LAN targets, metadata addresses, public HTTP, production use, or access through a non-loopback app hostname.
- The proxy enforces public HTTPS/443, hostname allowlisting, DNS and redirect validation, pinned resolved addresses, restricted-address denial, header/method policies, credential stripping, timeout/body/response/redirect limits, rate limiting, and safe errors.

## Comparison behavior

- Explicit Ordered and Unordered array modes.
- Ordered arrays compare items by index.
- Unordered arrays use canonical multiset equality; duplicates remain significant.
- Findings distinguish fields added in B, removed from B, value changes, and type changes.
- Object key order does not affect comparison results.
- Internal path identity uses RFC 6901 JSON Pointer; readable paths are shown in the UI.
- Comparison runs in a cancellable Web Worker with depth and finding-count limits.
- Truncated results are clearly marked incomplete.

## Structure Schema Compare

- Structure results are separate from value differences.
- Response A acts as the schema baseline.
- Array objects are compared against the first Response A array item.
- Reports fields only in A, fields only in B, inconsistent objects within A, and the empty-A-array/non-empty-B case.
- Structure findings support path filtering and Show Ignored.
- Only in A (present in A, missing in B) and Only in B (present in B, missing in A) chips independently filter directional structure findings; internal Response A consistency findings remain visible because they are not directional missing-field results.

## Highlights and ignore rules

- Independent highlight chips control Missing Fields, Structure Schema, and Differences.
- Missing fields use direction-aware colors: red for values present only in A and green for values present only in B.
- Structure findings use purple; value/type differences use amber.
- When a one-sided path is both a Missing Fields finding and a Structure Schema finding, purple Structure Schema highlighting takes visual priority while that category is enabled; disabling Structure Schema falls back to the direction-aware Missing Fields color.
- Highlight markers appear in the JSON line-number gutters and right-side minimaps and jump to their source lines.
- Ignore rules accept exact JSON/dotted paths, single-segment `*`, and subtree `**` patterns. Exact paths implicitly include every descendant, and a terminal `*` includes each matched child subtree, so both `config.partnerConfig.MOT_config` and `config.partnerConfig.*` suppress nested findings without requiring `**`.
- Focusing Ignore Paths opens a searchable list of paths detected by the latest comparison. Suggestions and pasted comma/newline-separated patterns become editable, removable, deduplicated chips; free-typed text remains in the input until Enter or Apply explicitly commits it, and custom wildcard patterns remain supported. Selecting a chip label opens its inline editor: Enter or Save commits, Escape or Cancel restores the original, and Apply commits a valid active edit.
- The Apply button beside Ignore Paths reruns the current comparison so ignored flags, visible/total counts, result tables, structure findings, and JSON highlights refresh immediately.
- Ignored findings remain in the result model but are excluded from visible highlights and rows while Show Ignored is off.
- Show Ignored reveals ignored rows with visible labels and dimmed styling in Missing Fields, Structure Schema Compare, and Differences.
- Result rows, full-line JSON/Tree highlights, minimap markers, and previous/next navigation consume the same filtered projection, including path, source, schema-source, ignored, and highlight-category selections.

## Result sections and filters

- Structure Schema Compare is displayed before Missing Fields and Differences. Missing Fields opens by default, and every section remains independently collapsible. Each native disclosure header includes a visible right/down arrow that communicates its collapsed or expanded state.
- Missing Fields direction filters:
  - Only in A — present in A, missing in B.
  - Only in B — present in B, missing in A.
  - Show Ignored.
- A shared path search composes with the direction and ignored filters.
- The comparison outcome uses `{visible} of {total} differences shown in {duration} ms`; visible is after display filters and total is before them, including ignored findings. Each Structure Schema Compare, Missing Fields, and Differences disclosure reports the same visible/total semantics and updates immediately with active filters.
- Missing rows support persistent selection, a native three-option review-status radio group (Not reviewed, Reviewed, or Needed), and free-text notes.
- Long values use an exact 70-character preview with Show more/Show less.
- Differences has a dedicated value/type comparison table.
- Summary chips report Only in A, Only in B, changed, structure, and ignored totals.

## Markdown export and preview

- Export all Missing Fields or only selected rows.
- Downloads use `missing-fields-report.md` and `missing-fields-selected-report.md`.
- Every export opens a read-only in-page Markdown preview.
- Preview actions include Copy, Download again, and Close.
- Review statuses and notes are included when configured.
- Reports contain a privacy warning because compared values may be sensitive.

## Workspace behavior

- Load Sample populates both panels without automatically comparing.
- Clear removes documents, results, notes, selection, and cURL bars while preserving Ignore Paths.
- A shared accessible status region announces validation, comparison, fetch, and export results.
- Light and dark themes are available for the current session.
- The two panels stack on narrower screens.
- A Back to top control appears after scrolling down the page.

## Known remaining enhancements

The maintained coverage register is [`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md). Advanced artifact-parity enhancements still tracked there include source-line links in result tables, group filters, summary-triggered section animation, and persisted system-theme preference.
